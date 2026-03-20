import React, { useEffect, useMemo, useRef, useState } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import { Chart } from 'chart.js/auto';
import taliaUserService from '../../../services/TaliaUserService';
import { formatDayMon } from '../../../lib/dateFormat';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import userActivityTracker from '../../../services/userActivityTracker';
import '../admin.css';

const WINDOW_OPTIONS = [
  { key: '1m', label: '1m', minutes: 1 },
  { key: '5m', label: '5m', minutes: 5 },
  { key: '10m', label: '10m', minutes: 10 },
  { key: '30m', label: '30m', minutes: 30 },
  { key: '1hour', label: '1 hour', minutes: 60 },
  { key: '3hour', label: '3 hour', minutes: 3 * 60 },
  { key: '24hour', label: '24 hour', minutes: 24 * 60 },
  { key: 'all', label: 'all', minutes: null },
];

const formatTimeOnly = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDateGroup = (value) => {
  if (!value) return 'Unknown Date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown Date';
  return date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatHourGroup = (value) => {
  if (!value) return 'Unknown Hour';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown Hour';
  return `${date.toLocaleTimeString([], { hour: '2-digit' })}:00`;
};

const summarizeUserEvents = (events) => {
  if (!events.length) {
    return {
      lastAccessAt: null,
      reportSummary: '—',
      avgPerfMs: null,
      lastCriteria: null
    };
  }
  const last = events[0];
  const reports = [...new Set(events.map((entry) => entry.report).filter(Boolean))].slice(0, 3);
  const perfValues = events.map((entry) => entry.performanceMs).filter((value) => Number.isFinite(value));
  const avgPerfMs = perfValues.length
    ? Math.round(perfValues.reduce((sum, value) => sum + value, 0) / perfValues.length)
    : null;
  return {
    lastAccessAt: last.at,
    reportSummary: reports.length ? reports.join(', ') : '—',
    avgPerfMs,
    lastCriteria: last.criteria || null
  };
};

const TaliaUserTable = () => {
  const { devUsers = [] } = useSupabaseAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [windowKey, setWindowKey] = useState('1hour');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sharedEvents, setSharedEvents] = useState([]);
  const tableElRef = useRef(null);
  const tableRef = useRef(null);
  const detailTableElRef = useRef(null);
  const detailTableRef = useRef(null);
  const chartCanvasRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const userList = await taliaUserService.getAllTaliaUsers();
      setUsers(userList);
    } catch (err) {
      console.error('Error loading users:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSharedEvents = async (minutes) => {
    const fetchMinutes = Number.isFinite(minutes) ? Math.max(minutes, 10) : null;
    const events = await userActivityTracker.fetchSharedEvents({
      sinceMinutes: fetchMinutes,
      limit: 3000
    });
    setSharedEvents(Array.isArray(events) ? events : []);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    const selected = WINDOW_OPTIONS.find((option) => option.key === windowKey) || WINDOW_OPTIONS[WINDOW_OPTIONS.length - 1];
    loadSharedEvents(selected.minutes);
  }, [windowKey]);

  useEffect(() => {
    const selected = WINDOW_OPTIONS.find((option) => option.key === windowKey) || WINDOW_OPTIONS[WINDOW_OPTIONS.length - 1];
    const timer = setInterval(() => {
      loadSharedEvents(selected.minutes);
    }, 15000);
    return () => clearInterval(timer);
  }, [windowKey]);

  const rows = useMemo(() => {
    const roleByEmail = new Map(
      devUsers.map((devUser) => [String(devUser.email || '').toLowerCase(), String(devUser.role || 'USER').toUpperCase()])
    );
    const byUser = new Map();
    sharedEvents.forEach((event) => {
      const key = event.userId || String(event.userEmail || '').toLowerCase();
      if (!key) return;
      const list = byUser.get(key) || [];
      list.push(event);
      byUser.set(key, list);
    });

    const dbRows = (users || [])
      .filter((user) => user?.email)
      .map((user) => ({
        ...summarizeUserEvents(byUser.get(user.id) || byUser.get(String(user.email).toLowerCase()) || []),
        id: user.id,
        taliaUserId: user.taliaUserId,
        email: user.email,
        name: user.name || user.email.split('@')[0] || '',
        role: roleByEmail.get(String(user.email).toLowerCase()) || 'USER',
        lastLogin: formatDayMon(user.lastLoginAt, 'N/A'),
        createdAt: formatDayMon(user.createdAt, 'N/A'),
        source: user.id?.startsWith('dev-user-') ? 'DEV' : 'DB'
      }))
      .sort((a, b) => Number(b.taliaUserId || 0) - Number(a.taliaUserId || 0));

    // If DB returns no rows, show current dev users as valid current session users.
    if (dbRows.length === 0 && devUsers.length > 0) {
      return devUsers.map((devUser) => ({
        ...summarizeUserEvents(byUser.get(devUser.id) || byUser.get(String(devUser.email || '').toLowerCase()) || []),
        id: devUser.id,
        taliaUserId: devUser.talia_user_id,
        email: devUser.email,
        name: devUser.name || devUser.email?.split('@')[0] || '',
        role: String(devUser.role || 'USER').toUpperCase(),
        lastLogin: 'Current Session',
        createdAt: 'Current Session',
        source: 'DEV'
      }));
    }

    return dbRows;
  }, [users, devUsers, sharedEvents]);

  const selectedUser = useMemo(
    () => rows.find((row) => row.id === selectedUserId) || rows[0] || null,
    [rows, selectedUserId]
  );

  const selectedWindowMinutes = useMemo(() => {
    const selected = WINDOW_OPTIONS.find((option) => option.key === windowKey);
    return selected?.minutes ?? null;
  }, [windowKey]);

  const detailRowsRaw = useMemo(() => {
    if (!selectedUser) return [];
    const now = Date.now();
    const start = Number.isFinite(selectedWindowMinutes)
      ? now - (selectedWindowMinutes * 60 * 1000)
      : null;
    return sharedEvents
      .filter((event) => {
        if (selectedUser.id && event.userId === selectedUser.id) return true;
        return String(event.userEmail || '').toLowerCase() === String(selectedUser.email || '').toLowerCase();
      })
      .filter((event) => {
        if (!Number.isFinite(start)) return true;
        const at = Date.parse(event.at);
        if (!Number.isFinite(at)) return false;
        return at >= start && at <= now;
      })
      .slice(0, 120)
      .map((entry) => ({
        id: entry.id,
        at: formatTimeOnly(entry.at),
        dateGroup: formatDateGroup(entry.at),
        hourGroup: formatHourGroup(entry.at),
        report: entry.report || 'unknown',
        kind: entry.kind || 'event',
        purpose: entry.purpose || '',
        status: entry.status || '',
        performanceMs: Number.isFinite(entry.performanceMs) ? `${entry.performanceMs}ms` : '—',
        criteriaHover: entry.criteria
          ? `${entry.criteria.rangeKey || 'all'} | ${entry.criteria.durationKey || 'all'} | ${entry.criteria.activeOnly ? 'active' : 'all'}`
          : '—',
        criteria: entry.criteria
          ? `${entry.criteria.rangeKey || 'all'} | ${entry.criteria.durationKey || 'all'} | ${entry.criteria.activeOnly ? 'active' : 'all'}`
          : '—',
      }));
  }, [selectedUser, sharedEvents, selectedWindowMinutes]);

  const detailKinds = useMemo(
    () => [...new Set(detailRowsRaw.map((row) => row.kind).filter(Boolean))].sort(),
    [detailRowsRaw]
  );

  const detailStatuses = useMemo(
    () => [...new Set(detailRowsRaw.map((row) => row.status).filter(Boolean))].sort(),
    [detailRowsRaw]
  );

  const detailRows = useMemo(
    () => detailRowsRaw.filter((row) => {
      if (typeFilter !== 'all' && row.kind !== typeFilter) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      return true;
    }),
    [detailRowsRaw, typeFilter, statusFilter]
  );

  const chartSeries = useMemo(() => {
    if (!selectedUser) return { labels: [], datasets: [] };
    const selected = WINDOW_OPTIONS.find((option) => option.key === windowKey) || WINDOW_OPTIONS[WINDOW_OPTIONS.length - 1];
    const now = Date.now();
    const selectedUserEvents = sharedEvents.filter((event) => {
      if ((selectedUser.id && event.userId === selectedUser.id)) return true;
      return String(event.userEmail || '').toLowerCase() === String(selectedUser.email || '').toLowerCase();
    });
    const oldestTs = selectedUserEvents.reduce((min, event) => {
      const at = Date.parse(event.at);
      if (!Number.isFinite(at)) return min;
      if (!Number.isFinite(min)) return at;
      return Math.min(min, at);
    }, Number.NaN);
    const isAllWindow = !Number.isFinite(selected.minutes);
    const baseStart = isAllWindow
      ? (Number.isFinite(oldestTs) ? oldestTs : (now - (24 * 60 * 60 * 1000)))
      : (now - (selected.minutes * 60 * 1000));
    // Small-window grace avoids "empty" charts from boundary jitter.
    const start = isAllWindow ? baseStart : (baseStart - (selected.minutes <= 5 ? 60 * 1000 : 0));
    const totalMinutes = Math.max(1, Math.ceil((now - start) / (60 * 1000)));
    const bucketMs = totalMinutes <= 10
      ? 60 * 1000
      : totalMinutes <= 60
        ? 5 * 60 * 1000
        : totalMinutes <= (3 * 60)
          ? 10 * 60 * 1000
          : totalMinutes <= (12 * 60)
          ? 30 * 60 * 1000
          : totalMinutes <= (24 * 60)
            ? 60 * 60 * 1000
            : totalMinutes <= (7 * 24 * 60)
              ? 2 * 60 * 60 * 1000
              : 6 * 60 * 60 * 1000;
    const bucketCount = Math.max(1, Math.ceil((now - start) / bucketMs));
    const buckets = Array.from({ length: bucketCount }, (_, index) => start + (index * bucketMs));

    const events = selectedUserEvents.filter((event) => {
      const at = Date.parse(event.at);
      return Number.isFinite(at) && at >= start && at <= now && Number.isFinite(event.performanceMs);
    });

    if (!events.length) {
      return {
        labels: buckets.map((ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
        datasets: []
      };
    }

    const grouped = new Map();
    events.forEach((event) => {
      const report = event.report || 'unknown';
      if (!grouped.has(report)) grouped.set(report, []);
      grouped.get(report).push(event);
    });

    const topReports = [...grouped.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5)
      .map(([name]) => name);

    const labels = buckets.map((ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const colors = ['#7bdff2', '#b2f7ef', '#eff7f6', '#f7d6e0', '#f2b5d4'];
    const datasets = topReports.map((reportName, index) => {
      const rows = grouped.get(reportName) || [];
      const values = buckets.map((bucketStart) => {
        const bucketEnd = bucketStart + bucketMs;
        const bucketEvents = rows.filter((row) => {
          const at = Date.parse(row.at);
          return at >= bucketStart && at < bucketEnd;
        });
        if (!bucketEvents.length) return null;
        const avg = bucketEvents.reduce((sum, row) => sum + Number(row.performanceMs || 0), 0) / bucketEvents.length;
        return Math.round(avg);
      });

      return {
        label: reportName,
        data: values,
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length],
        spanGaps: true,
        tension: 0.22,
      };
    });

    return { labels, datasets };
  }, [selectedUser, sharedEvents, windowKey]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!tableElRef.current || tableRef.current) return;
      const Tabulator = await initTabulator();
      if (!Tabulator || cancelled || !tableElRef.current) return;

      tableRef.current = new Tabulator(tableElRef.current, {
        ...getTabulatorOptions({
          layout: 'fitDataFill',
          selectableRows: 1,
          height: '100%',
          data: [],
          columns: [
            { title: 'Talia ID', field: 'taliaUserId', width: 100, hozAlign: 'center' },
            { title: 'Email', field: 'email', headerFilter: 'input' },
            { title: 'Name', field: 'name', headerFilter: 'input' },
            { title: 'Role', field: 'role', width: 110, headerFilter: 'list', headerFilterParams: { valuesLookup: true, clearable: true } },
            { title: 'Last Access', field: 'lastAccessAt', width: 120, formatter: (cell) => formatDayMon(cell.getValue(), '—') },
            { title: 'Reports', field: 'reportSummary', headerFilter: 'input' },
            { title: 'Avg Perf', field: 'avgPerfMs', width: 100, hozAlign: 'center', formatter: (cell) => Number.isFinite(cell.getValue()) ? `${cell.getValue()}ms` : '—' },
            {
              title: 'Criteria',
              field: 'lastCriteria',
              formatter: (cell) => {
                const value = cell.getValue();
                if (!value || typeof value !== 'object') return '—';
                const activeLabel = value.activeOnly ? 'active' : 'all';
                return `${value.rangeKey || 'all'} | ${value.durationKey || 'all'} | ${activeLabel}`;
              }
            }
          ]
        })
      });

      tableRef.current.on('rowClick', (_event, row) => {
        const data = row.getData();
        if (data?.id) setSelectedUserId(data.id);
      });
    };

    init();
    return () => {
      cancelled = true;
      if (tableRef.current) {
        try {
          tableRef.current.destroy();
        } catch {
          // noop
        }
        tableRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!tableRef.current) return;
    tableRef.current.setData(rows || []);
    requestAnimationFrame(() => tableRef.current?.redraw?.(true));
  }, [rows]);

  useEffect(() => {
    if (!rows.length) {
      setSelectedUserId(null);
      return;
    }
    if (!selectedUserId || !rows.some((row) => row.id === selectedUserId)) {
      setSelectedUserId(rows[0].id);
    }
  }, [rows, selectedUserId]);

  useEffect(() => {
    let cancelled = false;
    const initDetailTable = async () => {
      if (!detailTableElRef.current || detailTableRef.current) return;
      const Tabulator = await initTabulator();
      if (!Tabulator || cancelled || !detailTableElRef.current) return;

      detailTableRef.current = new Tabulator(detailTableElRef.current, {
        ...getTabulatorOptions({
          layout: 'fitDataFill',
          selectableRows: false,
          height: '100%',
          groupBy: ['dateGroup', 'hourGroup'],
          groupStartOpen: true,
          groupHeader: [
            (value, count) => `${value} (${count})`,
            (value, count) => `${value} (${count})`
          ],
          data: [],
          columns: [
            { title: 'When', field: 'at', width: 90 },
            { title: 'Report', field: 'report', headerFilter: 'input', tooltip: (e, cell) => cell.getRow().getData()?.criteriaHover || '—' },
            { title: 'Perf', field: 'performanceMs', width: 90, hozAlign: 'center' },
            { title: 'Purpose', field: 'purpose', headerFilter: 'input', tooltip: (e, cell) => cell.getRow().getData()?.criteriaHover || '—' }
          ]
        })
      });
    };

    initDetailTable();
    return () => {
      cancelled = true;
      if (detailTableRef.current) {
        try {
          detailTableRef.current.destroy();
        } catch {
          // noop
        }
        detailTableRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!detailTableRef.current) return;
    detailTableRef.current.setData(detailRows || []);
    requestAnimationFrame(() => detailTableRef.current?.redraw?.(true));
  }, [detailRows]);

  useEffect(() => {
    if (!chartCanvasRef.current) return;
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const hasData = chartSeries.datasets.some((ds) => ds.data.some((point) => point !== null));
    chartInstanceRef.current = new Chart(chartCanvasRef.current, {
      type: 'line',
      data: {
        labels: chartSeries.labels,
        datasets: chartSeries.datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 10, usePointStyle: true }
          },
          title: {
            display: true,
            text: hasData ? `Avg refresh time by report (${windowKey})` : `No activity in ${windowKey}`
          }
        },
        scales: {
          x: {
            ticks: {
              maxTicksLimit: 10,
              autoSkip: true
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Avg Refresh Time (ms)'
            }
          }
        }
      }
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [chartSeries, windowKey]);

  return (
    <div className="talia-report" role="region" aria-label="Talia users">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Talia Users</h2>
          <p className="talia-report__subtitle">Current backend users mapped to Talia IDs</p>
        </div>
        <div className="talia-report__header-right">
          <button
            className="talia-btn talia-btn--primary"
            type="button"
            onClick={async () => {
              const selected = WINDOW_OPTIONS.find((option) => option.key === windowKey) || WINDOW_OPTIONS[WINDOW_OPTIONS.length - 1];
              await Promise.all([loadUsers(), loadSharedEvents(selected.minutes)]);
            }}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </header>
      <main className="talia-report__content">
        {error ? <div className="admin-access__error">Error loading users: {error}</div> : null}
        <div className="admin-access__table admin-access__table--users" ref={tableElRef} />
        <div className="admin-access__table-caption">
          Activity detail for: <strong>{selectedUser?.email || '—'}</strong>
        </div>
        <div className="admin-access__activity-controls">
          <label className="admin-access__control">
            <span>Range</span>
            <select className="admin-access__select" value={windowKey} onChange={(event) => setWindowKey(event.target.value)}>
              {WINDOW_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="admin-access__control">
            <span>Type</span>
            <select className="admin-access__select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">All</option>
              {detailKinds.map((kind) => (
                <option key={kind} value={kind}>{kind}</option>
              ))}
            </select>
          </label>
          <label className="admin-access__control">
            <span>Status</span>
            <select className="admin-access__select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All</option>
              {detailStatuses.map((status) => (
                <option key={status} value={status}>{status || '—'}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="admin-access__activity-grid">
          <div className="admin-access__table admin-access__table--activity" ref={detailTableElRef} />
          <div className="admin-access__chart-card">
            <canvas ref={chartCanvasRef} className="admin-access__activity-chart" />
          </div>
        </div>
      </main>
      <div className="admin-access__loading">
        Total users: {rows.length} · Activity events ({windowKey}): {detailRows.length}
      </div>
    </div>
  );
};

export default TaliaUserTable;
