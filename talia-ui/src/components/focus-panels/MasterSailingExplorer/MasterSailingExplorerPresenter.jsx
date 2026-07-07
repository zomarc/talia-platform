import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import { emitSailSelect } from '../../../lib/eventBus';
import { formatDayMon, formatMonYear } from '../../../lib/dateFormat';
import { buildExplorerDisplayRows } from './masterSailingExplorerTransform';

const REPORT_GROUP_ACTION_EVENT = 'talia:report.groupAction';

const FILTER_FIELDS = [
  ['sail_code', 'Sail Code'],
  ['sail_date_from', 'Departure'],
  ['sail_days', 'Duration'],
  ['package_name', 'Package'],
  ['package_type', 'Type'],
  ['route', 'Route'],
];

const GROUP_BY = [
  (rowData) => {
    if (rowData?.row_type === 'day') {
      return rowData?.departure_month_label || 'Unknown month';
    }
    const dateValue = rowData?.sail_date_from;
    if (dateValue) {
      const formatted = formatMonYear(dateValue, '');
      if (formatted) return formatted;
    }
    return rowData?.departure_month_label || 'Unknown month';
  },
  (rowData) => rowData?.ship_group_label || 'Unknown ship',
];

const GROUP_MAX_DEPTH = GROUP_BY.length;

const groupHeaders = [
  (value, count) => `<span class="master-sailing-group master-sailing-group--month">${value} (${count})</span>`,
  (value, count) => `<span class="master-sailing-group master-sailing-group--ship">${value} (${count})</span>`,
];

const formatCount = (value) => {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return '—';
  return numeric.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

const buildSelectValues = (rows, field) => {
  const masterRows = (rows || []).filter((row) => row?.row_type === 'master');
  const values = [...new Set(
    masterRows
      .map((row) => row?.[field])
      .filter((value) => value !== null && value !== undefined && value !== '')
      .map((value) => String(value))
  )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  return values.reduce((acc, value) => {
    acc[value] = value;
    return acc;
  }, { '': 'All' });
};

const formatSegmentHighlights = (segments = []) => {
  if (!segments.length) return '<span class="ms-explorer-segments ms-explorer-segments--empty">—</span>';
  const items = segments.map((segment) => {
    const guests = Number.parseFloat(segment?.guests ?? segment?.booked);
    const guestsValue = Number.isFinite(guests) && guests > 0 ? guests : 0;
    const guestsLabel = `${guestsValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    const bookingClass = segment?.is_booking ? 'ms-explorer-segment--booking' : 'ms-explorer-segment--active';
    return `<span class="ms-explorer-segment ${bookingClass}" title="${segment.sail_code}: ${guestsLabel} guests (selling)"><span class="ms-explorer-segment__code">${segment.sail_code}</span><span class="ms-explorer-segment__metrics">${guestsLabel}</span></span>`;
  }).join('');
  return `<span class="ms-explorer-segments">${items}</span>`;
};

const MasterSailingExplorerPresenter = ({
  masters,
  dayDetailsByMaster,
  panelInstanceId,
  panelComponentId,
}) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const tableBuiltRef = useRef(false);
  const didApplyInitialGroupOpenRef = useRef(false);
  const suppressMonthAutoOpenRef = useRef(false);
  const suppressClearOnRefreshRef = useRef(false);
  const pendingGroupActionRef = useRef(null);
  const groupCycleDepthRef = useRef(1);
  const [expandedMasters, setExpandedMasters] = useState(() => new Set());
  const [filters, setFilters] = useState({
    sail_code: '',
    sail_date_from: '',
    sail_days: '',
    package_name: '',
    package_type: '',
    route: '',
  });

  const displayRows = useMemo(
    () => buildExplorerDisplayRows(masters, dayDetailsByMaster, expandedMasters),
    [masters, dayDetailsByMaster, expandedMasters]
  );
  const displayRowsRef = useRef(displayRows);
  useEffect(() => {
    displayRowsRef.current = displayRows;
  }, [displayRows]);

  const masterCount = masters?.length || 0;
  const filterOptions = useMemo(
    () => Object.fromEntries(FILTER_FIELDS.map(([field]) => [field, buildSelectValues(masters, field)])),
    [masters]
  );

  const toggleMasterExpanded = useCallback((masterCode) => {
    if (!masterCode) return;
    setExpandedMasters((prev) => {
      const next = new Set(prev);
      if (next.has(masterCode)) next.delete(masterCode);
      else next.add(masterCode);
      return next;
    });
  }, []);

  const handleExpandToggle = useCallback((event, rowData) => {
    event?.stopPropagation?.();
    if (rowData?.row_type !== 'master' || !rowData?.is_expandable) return;
    toggleMasterExpanded(rowData.sail_code);
  }, [toggleMasterExpanded]);

  const expandAllMasters = useCallback(() => {
    setExpandedMasters(new Set((masters || []).map((row) => String(row.sail_code || '').trim()).filter(Boolean)));
  }, [masters]);

  const collapseAllMasters = useCallback(() => {
    setExpandedMasters(new Set());
  }, []);

  const columns = useMemo(() => ([
    {
      field: 'expand_toggle',
      title: '',
      width: 34,
      hozAlign: 'center',
      headerSort: false,
      formatter: (cell) => {
        const row = cell.getRow().getData();
        if (row?.row_type !== 'master' || !row?.is_expandable) return '';
        return row?.is_expanded ? '▾' : '▸';
      },
      cellClick: (event, cell) => {
        handleExpandToggle(event, cell.getRow().getData());
      },
    },
    {
      field: 'row_label',
      title: 'Master Sail / Day',
      minWidth: 130,
      formatter: (cell) => {
        const row = cell.getRow().getData();
        if (row?.row_type === 'day') {
          return formatDayMon(row?.voyage_day_date, row?.day_label || '');
        }
        return row?.sail_code || '';
      },
      headerSort: false,
    },
    {
      field: 'contributing_segments',
      title: 'Segments',
      minWidth: 220,
      formatter: (cell) => {
        const row = cell.getRow().getData();
        if (row?.row_type === 'day') {
          return formatSegmentHighlights(row?.contributing_segments);
        }
        return formatSegmentHighlights(row?.segment_summaries || []);
      },
      headerSort: false,
    },
    {
      field: 'sail_date_from',
      title: 'Departure',
      width: 88,
      formatter: (cell) => {
        const row = cell.getRow().getData();
        if (row?.row_type === 'day') return `Day ${row?.voyage_day_index || ''}`;
        return formatDayMon(cell.getValue(), '');
      },
      headerSort: false,
    },
    {
      field: 'sail_days',
      title: 'Duration',
      hozAlign: 'center',
      width: 72,
      headerSort: false,
    },
    {
      field: 'package_name',
      title: 'Package',
      minWidth: 120,
      headerSort: false,
    },
    {
      field: 'route',
      title: 'Route',
      width: 96,
      headerSort: false,
    },
    {
      field: 'booked_display',
      title: 'Booked (berths)',
      hozAlign: 'right',
      width: 100,
      formatter: (cell) => {
        const row = cell.getRow().getData();
        const value = row?.row_type === 'day' ? row?.booked : row?.total_booked;
        return formatCount(value);
      },
      headerSort: false,
    },
    {
      field: 'capacity_display',
      title: 'Capacity (berths)',
      hozAlign: 'right',
      width: 108,
      formatter: (cell) => {
        const row = cell.getRow().getData();
        const value = row?.row_type === 'day' ? row?.capacity : row?.total_capacity;
        return formatCount(value);
      },
      headerSort: false,
    },
    {
      field: 'available_display',
      title: 'Available',
      hozAlign: 'right',
      width: 88,
      formatter: (cell) => {
        const row = cell.getRow().getData();
        const value = row?.row_type === 'day' ? row?.available : row?.total_available;
        return formatCount(value);
      },
      headerSort: false,
    },
  ]), [handleExpandToggle]);

  const openOnlyMonthGroup = useCallback((targetGroup) => {
    const table = instanceRef.current;
    if (!table || !targetGroup) return;
    const topGroups = table.getGroups?.() || [];
    topGroups.forEach((group) => {
      if (!group) return;
      if (group === targetGroup) group.show?.();
      else group.hide?.();
    });
  }, []);

  const openFirstMonthOnly = useCallback(() => {
    const table = instanceRef.current;
    if (!table) return;
    const topGroups = table.getGroups?.() || [];
    topGroups.forEach((group, index) => {
      if (!group) return;
      if (index === 0) {
        group.show?.();
        const shipGroups = group.getSubGroups?.() || [];
        if (shipGroups[0]) shipGroups[0].show?.();
      } else {
        group.hide?.();
      }
    });
  }, []);

  const applyGroupDepth = useCallback((depth) => {
    const table = instanceRef.current;
    const targetDepth = Math.max(0, Math.min(depth, GROUP_MAX_DEPTH));
    groupCycleDepthRef.current = targetDepth;
    if (!table) return targetDepth;
    if (!tableBuiltRef.current) {
      pendingGroupActionRef.current = `depth:${targetDepth}`;
      return targetDepth;
    }
    const groupStartOpen = Array.from({ length: GROUP_MAX_DEPTH }, (_unused, index) => index < targetDepth);
    table.setGroupStartOpen?.(groupStartOpen);
    table.setGroupBy?.(GROUP_BY);
    table.setData?.(table.getData?.() || []);
    return targetDepth;
  }, []);

  const collapseAllGroups = useCallback(() => {
    applyGroupDepth(0);
  }, [applyGroupDepth]);

  const openAllGroups = useCallback(() => {
    applyGroupDepth(GROUP_MAX_DEPTH);
  }, [applyGroupDepth]);

  const cycleGroupState = useCallback(() => {
    const nextDepth = (groupCycleDepthRef.current + 1) % (GROUP_MAX_DEPTH + 1);
    return applyGroupDepth(nextDepth);
  }, [applyGroupDepth]);

  const getGroupCycleState = useCallback(() => ({
    depth: groupCycleDepthRef.current,
    maxDepth: GROUP_MAX_DEPTH,
  }), []);

  useEffect(() => {
    let cancelled = false;

    const initTable = async () => {
      if (!tableRef.current) return;
      try {
        const Tabulator = await initTabulator();
        if (cancelled) return;

        if (instanceRef.current) {
          instanceRef.current.destroy();
        }

        instanceRef.current = new Tabulator(tableRef.current, getTabulatorOptions({
          data: [],
          columns,
          initialSort: [{ column: 'sail_date_from', dir: 'asc' }],
          height: '100%',
          selectableRows: 1,
          resizableColumns: true,
          movableColumns: true,
          pagination: false,
          groupBy: GROUP_BY,
          groupStartOpen: [true, true],
          groupHeader: groupHeaders,
          rowFormatter: (row) => {
            const data = row.getData();
            const element = row.getElement();
            if (!element || !data) return;
            element.classList.toggle('ms-explorer-row--day', data.row_type === 'day');
            element.classList.toggle('ms-explorer-row--master', data.row_type === 'master');
          },
        }));

        instanceRef.current.on('tableBuilt', () => {
          tableBuiltRef.current = true;
          try {
            instanceRef.current.replaceData(displayRowsRef.current || []);
          } catch { /* noop */ }
          if (!didApplyInitialGroupOpenRef.current) {
            openFirstMonthOnly();
            didApplyInitialGroupOpenRef.current = true;
          }
          const pendingAction = pendingGroupActionRef.current;
          if (pendingAction === 'openAll') {
            pendingGroupActionRef.current = null;
            openAllGroups();
          } else if (pendingAction === 'collapseAll') {
            pendingGroupActionRef.current = null;
            collapseAllGroups();
          } else if (typeof pendingAction === 'string' && pendingAction.startsWith('depth:')) {
            pendingGroupActionRef.current = null;
            const depth = Number.parseInt(pendingAction.split(':')[1], 10);
            applyGroupDepth(Number.isNaN(depth) ? 0 : depth);
          }
        });

        instanceRef.current.on('rowClick', (event, row) => {
          const rowData = row.getData();
          if (rowData?.row_type === 'day') return;
          if (event?.target?.closest?.('.tabulator-cell[tabulator-field="expand_toggle"]')) {
            handleExpandToggle(event, rowData);
            return;
          }
          try { row?.select?.(); } catch { /* noop */ }
        });

        instanceRef.current.on('rowSelected', (row) => {
          const rowData = row.getData();
          if (rowData?.row_type !== 'master') return;
          const managementSailCode = rowData.reference_sail_code || rowData.sail_code;
          emitSailSelect({
            sail_code: managementSailCode,
            reference_sail_code: managementSailCode,
            segment_sail_codes: rowData.segment_codes || [],
            sailing_role: rowData.sailing_role,
            row_data: rowData,
            timestamp: new Date().toISOString(),
          });
        });

        instanceRef.current.on('groupClick', (_event, group) => {
          if (suppressMonthAutoOpenRef.current) return;
          const level = group?.getLevel?.() ?? -1;
          if (level === 0) openOnlyMonthGroup(group);
        });
      } catch (error) {
        console.error('[MasterSailingExplorer] Failed to initialize table:', error);
      }
    };

    initTable();

    return () => {
      cancelled = true;
      tableBuiltRef.current = false;
      pendingGroupActionRef.current = null;
      if (instanceRef.current) {
        try { instanceRef.current.destroy(); } catch { /* noop */ }
      }
    };
  }, [
    applyGroupDepth,
    collapseAllGroups,
    columns,
    handleExpandToggle,
    openAllGroups,
    openFirstMonthOnly,
    openOnlyMonthGroup,
  ]);

  useEffect(() => {
    if (!instanceRef.current || !tableBuiltRef.current) return;
    try {
      suppressClearOnRefreshRef.current = true;
      instanceRef.current.replaceData(displayRows || []);
      if (!didApplyInitialGroupOpenRef.current) {
        openFirstMonthOnly();
        didApplyInitialGroupOpenRef.current = true;
      }
    } catch (error) {
      console.warn('[MasterSailingExplorer] Failed to update table data:', error);
    } finally {
      window.setTimeout(() => {
        suppressClearOnRefreshRef.current = false;
      }, 0);
    }
  }, [displayRows, openFirstMonthOnly]);

  useEffect(() => {
    if (!instanceRef.current) return;
    const activeFilters = Object.entries(filters)
      .filter(([, value]) => value)
      .map(([field, value]) => ({ field, type: '=', value }));
    if (activeFilters.length) instanceRef.current.setFilter(activeFilters);
    else instanceRef.current.clearFilter(true);
  }, [filters]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.__taliaPanelGroupActions = window.__taliaPanelGroupActions || {};
    const componentKey = panelComponentId || 'master-sailing-explorer';
    const actions = {
      openAll: () => {
        openAllGroups();
        expandAllMasters();
      },
      collapseAll: () => {
        collapseAllGroups();
        collapseAllMasters();
      },
      cycle: cycleGroupState,
      getCycleState: getGroupCycleState,
    };
    window.__taliaPanelGroupActions[componentKey] = actions;
    if (panelInstanceId) {
      window.__taliaPanelGroupActions[panelInstanceId] = actions;
    }
    return () => {
      if (!window.__taliaPanelGroupActions) return;
      delete window.__taliaPanelGroupActions[componentKey];
      if (panelInstanceId) delete window.__taliaPanelGroupActions[panelInstanceId];
    };
  }, [
    collapseAllGroups,
    collapseAllMasters,
    cycleGroupState,
    expandAllMasters,
    getGroupCycleState,
    openAllGroups,
    panelComponentId,
    panelInstanceId,
  ]);

  useEffect(() => {
    const handleGroupAction = (event) => {
      const detail = event?.detail || {};
      const thisComponent = panelComponentId || 'master-sailing-explorer';
      const isTargeted = !detail.panelId && !detail.panelComponent
        ? true
        : detail.panelId === panelInstanceId || detail.panelComponent === thisComponent;
      if (!isTargeted) return;
      if (detail.action === 'openAll') {
        openAllGroups();
        expandAllMasters();
      } else if (detail.action === 'collapseAll') {
        collapseAllGroups();
        collapseAllMasters();
      } else if (detail.action === 'cycle') {
        cycleGroupState();
      }
    };
    window.addEventListener(REPORT_GROUP_ACTION_EVENT, handleGroupAction);
    document.addEventListener(REPORT_GROUP_ACTION_EVENT, handleGroupAction);
    return () => {
      window.removeEventListener(REPORT_GROUP_ACTION_EVENT, handleGroupAction);
      document.removeEventListener(REPORT_GROUP_ACTION_EVENT, handleGroupAction);
    };
  }, [
    collapseAllGroups,
    collapseAllMasters,
    cycleGroupState,
    expandAllMasters,
    openAllGroups,
    panelComponentId,
    panelInstanceId,
  ]);

  return (
    <div className="focus-panel talia-report master-sailing-panel ms-explorer-panel">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Master Sailing Explorer</h2>
          <p className="talia-report__subtitle">
            {masterCount} master sailings · physical berths by day · segments show selling guests
          </p>
        </div>
        <div className="master-sailing-panel__actions">
          <button type="button" className="talia-btn talia-btn--ghost" onClick={expandAllMasters}>
            Expand all days
          </button>
          <button type="button" className="talia-btn talia-btn--ghost" onClick={collapseAllMasters}>
            Collapse days
          </button>
        </div>
      </header>
      <div className="master-sailing-panel__filters talia-report-filters">
        {FILTER_FIELDS.map(([field, label]) => (
          <label key={field} className="master-sailing-panel__filter talia-report-filters__group">
            <span className="talia-report-filters__label">{label}</span>
            <select
              className="talia-report-filters__input"
              value={filters[field] || ''}
              onChange={(event) => setFilters((prev) => ({ ...prev, [field]: event.target.value }))}
            >
              {Object.entries(filterOptions[field] || { '': 'All' }).map(([value, text]) => (
                <option key={`${field}-${value || 'all'}`} value={value}>{text}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div ref={tableRef} className="focus-panel__table master-sailing-table ms-explorer-table" />
    </div>
  );
};

export default MasterSailingExplorerPresenter;
