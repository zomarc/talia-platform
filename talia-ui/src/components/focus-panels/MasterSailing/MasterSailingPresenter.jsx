import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initTabulator } from '../../../lib/tabulatorConfig';
import { emitSailClear, emitSailSelect } from '../../../lib/eventBus';
import { formatDayMon, formatMonYear } from '../../../lib/dateFormat';
const REPORT_GROUP_ACTION_EVENT = 'talia:report.groupAction';

const buildSelectValues = (rows, field) => {
  const values = [...new Set(
    (rows || [])
      .map((row) => row?.[field])
      .filter((value) => value !== null && value !== undefined && value !== '')
      .map((value) => String(value))
  )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  return values.reduce((acc, value) => {
    acc[value] = value;
    return acc;
  }, { '': 'All' });
};

const FILTER_FIELDS = [
  ['sail_code', 'Sail Code'],
  ['sail_date_from', 'Departure'],
  ['sail_days', 'Duration'],
  ['package_name', 'Package'],
  ['package_type', 'Type'],
  ['port_from', 'From'],
  ['port_to', 'To'],
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const estimateColumnWidth = (rows, field, title, min = 72, max = 260) => {
  const sample = rows.slice(0, 30);
  const maxDataLength = sample.reduce((largest, row) => {
    const value = row?.[field];
    return Math.max(largest, String(value ?? '').length);
  }, 0);
  const estimated = Math.max(title.length, maxDataLength) * 7 + 18;
  return clamp(estimated, min, max);
};

const groupHeaders = [
  (value, count) => `<span class="master-sailing-group master-sailing-group--month">${value} (${count})</span>`,
  (value, count) => `<span class="master-sailing-group master-sailing-group--ship">${value} (${count})</span>`,
];

const GROUP_BY = [
  (rowData) => {
    const dateValue = rowData?.sail_date_from;
    if (dateValue) {
      const formatted = formatMonYear(dateValue, '');
      if (formatted) return formatted;
    }
    return rowData?.departure_month_label || 'Unknown month';
  },
  (rowData) => rowData?.ship_group_label || 'Unknown ship'
];
const GROUP_MAX_DEPTH = GROUP_BY.length;

const MasterSailingPresenter = ({ data, panelInstanceId, panelComponentId }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const didApplyInitialGroupOpenRef = useRef(false);
  const suppressMonthAutoOpenRef = useRef(false);
  const tableBuiltRef = useRef(false);
  const pendingGroupActionRef = useRef(null);
  const groupCycleDepthRef = useRef(1);
  const [filters, setFilters] = useState({
    sail_code: '',
    sail_date_from: '',
    sail_days: '',
    package_name: '',
    package_type: '',
    port_from: '',
    port_to: '',
  });
  const filterOptions = useMemo(() => Object.fromEntries(
    FILTER_FIELDS.map(([field]) => [field, buildSelectValues(data || [], field)])
  ), [data]);
  const columns = useMemo(() => ([
    {
      field: 'sail_code',
      title: 'Sail Code',
      width: estimateColumnWidth(data || [], 'sail_code', 'Sail Code', 110, 220),
      headerSort: false,
    },
    {
      field: 'sail_date_from',
      title: 'Departure',
      width: estimateColumnWidth(data || [], 'sail_date_from', 'Departure', 80, 120),
      formatter: (cell) => {
        const value = cell.getValue();
        return formatDayMon(value, '');
      },
      headerSort: false,
    },
    {
      field: 'sail_days',
      title: 'Duration',
      hozAlign: 'center',
      width: estimateColumnWidth(data || [], 'sail_days', 'Duration', 68, 100),
      headerSort: false,
    },
    {
      field: 'package_name',
      title: 'Package',
      width: estimateColumnWidth(data || [], 'package_name', 'Package', 100, 300),
      headerSort: false,
    },
    {
      field: 'package_type',
      title: 'Type',
      width: estimateColumnWidth(data || [], 'package_type', 'Type', 72, 200),
      headerSort: false,
    },
    {
      field: 'port_from',
      title: 'From',
      width: estimateColumnWidth(data || [], 'port_from', 'From', 72, 180),
      headerSort: false,
    },
    {
      field: 'port_to',
      title: 'To',
      width: estimateColumnWidth(data || [], 'port_to', 'To', 72, 180),
      headerSort: false,
    }
  ]), [data]);

  const openOnlyMonthGroup = useCallback((targetGroup) => {
    const table = instanceRef.current;
    if (!table || !targetGroup) return;
    const topGroups = table.getGroups?.() || [];
    topGroups.forEach((group) => {
      if (!group) return;
      if (group === targetGroup) {
        group.show?.();
      } else {
        group.hide?.();
      }
    });
  }, []);

  const openFirstMonthOnly = useCallback(() => {
    const table = instanceRef.current;
    if (!table) return;
    const topGroups = table.getGroups?.() || [];
    if (!topGroups.length) return;
    topGroups.forEach((group, index) => {
      if (!group) return;
      if (index === 0) {
        group.show?.();
        // Also expand the first ship subgroup within this month
        const shipGroups = group.getSubGroups?.() || [];
        if (shipGroups.length > 0 && shipGroups[0]) {
          shipGroups[0].show?.();
        }
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
    const currentRows = table.getData?.() || [];
    table.setData?.(currentRows);
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

        instanceRef.current = new Tabulator(tableRef.current, {
          data,
          columns,
          layout: 'fitDataFill',
          initialSort: [{ column: 'sail_date_from', dir: 'asc' }],
          height: '100%',
          selectableRows: 1,
          resizableColumns: true,
          movableColumns: true,
          headerFilterLiveFilter: true,
          headerFilterLiveFilterDelay: 300,
          pagination: false,
          groupBy: GROUP_BY,
          groupStartOpen: [true, true],
          groupHeader: groupHeaders,
        });

        instanceRef.current.on('tableBuilt', () => {
          tableBuiltRef.current = true;
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

        instanceRef.current.on('rowClick', (_event, row) => {
          try { row?.select?.(); } catch { /* noop */ }
        });

        instanceRef.current.on('rowSelected', (row) => {
          const rowData = row.getData();
          emitSailSelect({
            sail_code: rowData.sail_code,
            row_data: rowData,
            timestamp: new Date().toISOString(),
          });
        });

        instanceRef.current.on('rowDeselected', () => {
          emitSailClear({ timestamp: new Date().toISOString() });
        });

        instanceRef.current.on('groupClick', (_event, group) => {
          if (suppressMonthAutoOpenRef.current) return;
          const level = group?.getLevel?.() ?? -1;
          if (level === 0) {
            openOnlyMonthGroup(group);
          }
        });

      } catch (error) {
        console.error('[MasterSailing] Failed to initialize table:', error);
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
  }, [applyGroupDepth, collapseAllGroups, columns, data, openAllGroups, openFirstMonthOnly, openOnlyMonthGroup]);

  useEffect(() => {
    if (!instanceRef.current || !tableBuiltRef.current) return;
    try {
      instanceRef.current.replaceData(data || []);
      if (!didApplyInitialGroupOpenRef.current) {
        openFirstMonthOnly();
        didApplyInitialGroupOpenRef.current = true;
      }
    } catch (error) {
      console.warn('[MasterSailing] Failed to update table data:', error);
    }
  }, [data, openFirstMonthOnly]);

  useEffect(() => {
    if (!instanceRef.current) return;
    const activeFilters = Object.entries(filters)
      .filter(([, value]) => value)
      .map(([field, value]) => ({ field, type: '=', value }));
    if (activeFilters.length) {
      instanceRef.current.setFilter(activeFilters);
    } else {
      instanceRef.current.clearFilter(true);
    }
  }, [filters]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.__taliaPanelGroupActions = window.__taliaPanelGroupActions || {};
    const componentKey = panelComponentId || 'master-sailing';
    window.__taliaPanelGroupActions[componentKey] = {
      openAll: openAllGroups,
      collapseAll: collapseAllGroups,
      cycle: cycleGroupState,
      getCycleState: getGroupCycleState,
    };
    if (panelInstanceId) {
      window.__taliaPanelGroupActions[panelInstanceId] = {
        openAll: openAllGroups,
        collapseAll: collapseAllGroups,
        cycle: cycleGroupState,
        getCycleState: getGroupCycleState,
      };
    }
    return () => {
      if (!window.__taliaPanelGroupActions) return;
      delete window.__taliaPanelGroupActions[componentKey];
      if (panelInstanceId) {
        delete window.__taliaPanelGroupActions[panelInstanceId];
      }
    };
  }, [collapseAllGroups, cycleGroupState, getGroupCycleState, openAllGroups, panelComponentId, panelInstanceId]);

  useEffect(() => {
    const handleGroupAction = (event) => {
      const detail = event?.detail || {};
      const action = detail.action;
      const targetPanelInstance = detail.panelId;
      const targetPanelComponent = detail.panelComponent;
      const thisComponent = panelComponentId || 'master-sailing';
      const isTargeted =
        !targetPanelInstance && !targetPanelComponent
          ? true
          : targetPanelInstance === panelInstanceId || targetPanelComponent === thisComponent;
      if (!isTargeted) return;
      if (action === 'openAll') {
        openAllGroups();
      } else if (action === 'collapseAll') {
        collapseAllGroups();
      } else if (action === 'cycle') {
        cycleGroupState();
      }
    };
    window.addEventListener(REPORT_GROUP_ACTION_EVENT, handleGroupAction);
    document.addEventListener(REPORT_GROUP_ACTION_EVENT, handleGroupAction);
    return () => {
      window.removeEventListener(REPORT_GROUP_ACTION_EVENT, handleGroupAction);
      document.removeEventListener(REPORT_GROUP_ACTION_EVENT, handleGroupAction);
    };
  }, [collapseAllGroups, cycleGroupState, openAllGroups, panelComponentId, panelInstanceId]);

  return (
    <div className="focus-panel master-sailing-panel">
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
      <div ref={tableRef} className="focus-panel__table master-sailing-table" />
    </div>
  );
};

export default MasterSailingPresenter;

