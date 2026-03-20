import React, { useEffect, useMemo, useRef, useState } from 'react';
import { gql } from '@apollo/client';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import userActivityTracker from '../../../services/userActivityTracker';
import { apolloClient } from '../../../lib/apolloClient';
import '../admin.css';

const WINDOW_OPTIONS = [
  { key: '10m', label: '10m', minutes: 10 },
  { key: '1h', label: '1h', minutes: 60 },
  { key: '3h', label: '3h', minutes: 180 },
  { key: '12h', label: '12h', minutes: 720 },
  { key: '24h', label: '24h', minutes: 1440 },
  { key: '48h', label: '48h', minutes: 2880 },
  { key: 'all', label: 'All', minutes: null },
];

const PURGE_OPTIONS = [
  { key: '24h', label: '24h', hours: 24 },
  { key: '72h', label: '72h', hours: 72 },
  { key: '7d', label: '7d', hours: 168 },
  { key: '30d', label: '30d', hours: 720 },
  { key: '90d', label: '90d', hours: 2160 },
];

const PURGE_UI_ACTIVITY_EVENTS_MUTATION = gql`
  mutation PurgeUiActivityEvents($olderThanHours: Int!) {
    purgeUiActivityEvents(olderThanHours: $olderThanHours)
  }
`;

const formatWhen = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCriteria = (criteria) => {
  if (!criteria || typeof criteria !== 'object') return '—';
  return `${criteria.rangeKey || 'all'} | ${criteria.durationKey || 'all'} | ${criteria.activeOnly ? 'active' : 'all'}`;
};

const AdminLogsPanel = () => {
  const [windowKey, setWindowKey] = useState('1h');
  const [kindFilter, setKindFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeKey, setPurgeKey] = useState('30d');
  const [error, setError] = useState(null);
  const tableElRef = useRef(null);
  const tableRef = useRef(null);

  const selectedWindowMinutes = useMemo(() => {
    const selected = WINDOW_OPTIONS.find((option) => option.key === windowKey);
    return selected?.minutes ?? null;
  }, [windowKey]);

  const loadRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const events = await userActivityTracker.fetchSharedEvents({
        sinceMinutes: selectedWindowMinutes,
        limit: 5000
      });
      const mapped = (events || []).map((event) => ({
        id: event.id,
        at: event.at,
        when: formatWhen(event.at),
        user: event.userEmail || event.userId || 'unknown',
        role: event.userRole || 'USER',
        report: event.report || 'unknown',
        kind: event.kind || 'event',
        status: event.status || '',
        purpose: event.purpose || '',
        performanceMs: Number.isFinite(event.performanceMs) ? `${event.performanceMs}ms` : '—',
        criteria: formatCriteria(event.criteria),
      }));
      setRows(mapped);
    } catch (err) {
      setError(err?.message || 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const handlePurge = async () => {
    const option = PURGE_OPTIONS.find((item) => item.key === purgeKey);
    const olderThanHours = option?.hours ?? 720;
    const confirmed = window.confirm(`Purge log events older than ${option?.label || '30d'}?`);
    if (!confirmed) return;

    setPurging(true);
    setError(null);
    try {
      const result = await apolloClient.mutate({
        mutation: PURGE_UI_ACTIVITY_EVENTS_MUTATION,
        variables: { olderThanHours },
      });
      const purged = Number(result?.data?.purgeUiActivityEvents || 0);
      await loadRows();
      window.alert(`Purged ${purged} log rows.`);
    } catch (err) {
      setError(err?.message || 'Failed to purge activity logs');
    } finally {
      setPurging(false);
    }
  };

  useEffect(() => {
    loadRows();
    const timer = setInterval(loadRows, 15000);
    return () => clearInterval(timer);
  }, [selectedWindowMinutes]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (kindFilter !== 'all' && row.kind !== kindFilter) return false;
    if (statusFilter !== 'all' && row.status !== statusFilter) return false;
    return true;
  }), [rows, kindFilter, statusFilter]);

  const kindOptions = useMemo(
    () => [...new Set(rows.map((row) => row.kind).filter(Boolean))].sort(),
    [rows]
  );
  const statusOptions = useMemo(
    () => [...new Set(rows.map((row) => row.status).filter(Boolean))].sort(),
    [rows]
  );

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!tableElRef.current || tableRef.current) return;
      const Tabulator = await initTabulator();
      if (!Tabulator || cancelled || !tableElRef.current) return;

      tableRef.current = new Tabulator(tableElRef.current, {
        ...getTabulatorOptions({
          layout: 'fitDataFill',
          selectableRows: false,
          height: '100%',
          data: [],
          columns: [
            { title: 'When', field: 'when', width: 130 },
            { title: 'User', field: 'user', width: 180, headerFilter: 'input' },
            { title: 'Role', field: 'role', width: 90, headerFilter: 'list', headerFilterParams: { valuesLookup: true, clearable: true } },
            { title: 'Report', field: 'report', width: 170, headerFilter: 'input' },
            { title: 'Type', field: 'kind', width: 90 },
            { title: 'Status', field: 'status', width: 90 },
            { title: 'Perf', field: 'performanceMs', width: 90, hozAlign: 'center' },
            { title: 'Purpose', field: 'purpose', width: 220, headerFilter: 'input' },
            { title: 'Criteria', field: 'criteria' },
          ]
        })
      });
    };

    init();
    return () => {
      cancelled = true;
      if (tableRef.current) {
        try {
          tableRef.current.destroy();
        } catch {
          // no-op
        }
        tableRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!tableRef.current) return;
    tableRef.current.setData(filteredRows);
    requestAnimationFrame(() => tableRef.current?.redraw?.(true));
  }, [filteredRows]);

  return (
    <div className="admin-access admin-logs">
      <div className="admin-access__top">
        <div className="admin-access__intro">
          <h2 className="admin-access__title">Runtime Logs</h2>
          <p className="admin-access__subtitle">Shared activity events across users and reports</p>
        </div>
        <div className="admin-access__create">
          <button type="button" className="talia-btn talia-btn--primary" onClick={loadRows} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
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
          <select className="admin-access__select" value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}>
            <option value="all">All</option>
            {kindOptions.map((kind) => (
              <option key={kind} value={kind}>{kind}</option>
            ))}
          </select>
        </label>
        <label className="admin-access__control">
          <span>Status</span>
          <select className="admin-access__select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
        <label className="admin-access__control">
          <span>Purge Older Than</span>
          <select className="admin-access__select" value={purgeKey} onChange={(event) => setPurgeKey(event.target.value)}>
            {PURGE_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="talia-btn"
          onClick={handlePurge}
          disabled={purging}
          title="Delete old log rows from database"
        >
          {purging ? 'Purging...' : 'Purge'}
        </button>
      </div>

      {error ? <div className="admin-access__error">Log error: {error}</div> : null}
      <div className="admin-access__table admin-logs__table" ref={tableElRef} />
      <div className="admin-access__loading">Rows: {filteredRows.length} (raw: {rows.length})</div>
    </div>
  );
};

export default AdminLogsPanel;
