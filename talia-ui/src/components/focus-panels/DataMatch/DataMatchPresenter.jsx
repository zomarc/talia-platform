/**
 * Data Match Presenter Component
 * Displays data completeness as a cross-tab table using Tabulator
 * Shows matching vs missing record counts for each table per sail
 */

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { initTabulator } from '../../../lib/tabulatorConfig';
import { emitSailClear, emitSailSelect, SAIL_SELECT_EVENT } from '../../../lib/eventBus';
import { formatDayMon, formatMonYear } from '../../../lib/dateFormat';
const REPORT_GROUP_ACTION_EVENT = 'talia:report.groupAction';

const GROUP_BY = [
  (rowData) => rowData?.ship_code || 'Unknown Ship',
  (rowData) => rowData?.month_name || 'Unknown Month',
];
const GROUP_MAX_DEPTH = GROUP_BY.length;

const GROUP_HEADERS = [
  (value, count) => `<span class="data-match-group data-match-group--ship">${value} (${count})</span>`,
  (value, count) => `<span class="data-match-group data-match-group--month">${value} (${count})</span>`,
];

const DataMatchPresenter = ({ data, filters, onFiltersChange, onRefresh, panelInstanceId, panelComponentId }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const tableBuiltRef = useRef(false);
  const pendingGroupActionRef = useRef(null);
  const didApplyInitialGroupOpenRef = useRef(false);
  const groupCycleDepthRef = useRef(1);
  const lastDataRef = useRef(null);

  // Transform data into cross-tab format for Tabulator
  const transformedData = useMemo(() => {
    if (!data || !data.rows || !data.tables) return [];

    return data.rows.map(row => {
      // Parse date to extract month and year for grouping
      const date = new Date(row.departure_date);
      const month = date.getMonth() + 1; // 1-12
      const year = date.getFullYear();
      const monthYear = `${year}-${String(month).padStart(2, '0')}`;
      const monthName = formatMonYear(row.departure_date, 'Unknown Month');

      const rowData = {
        ship_code: row.ship_code,
        departure_date: row.departure_date,
        month_year: monthYear,
        month_name: monthName,
        sail_code: row.sail_code
      };

      // Add columns for each table (combined match/missing format)
      data.tables.forEach(tableName => {
        const match = row.tableMatches.find(tm => tm.tableName === tableName);
        const matchingCount = match?.matchingCount || 0;
        const missingCount = match?.missingCount || 0;
        rowData[tableName] = `${matchingCount}/${missingCount}`;
        // Store raw values for sorting/filtering
        rowData[`${tableName}_match`] = matchingCount;
        rowData[`${tableName}_missing`] = missingCount;
      });

      return rowData;
    });
  }, [data]);

  // Build column definitions dynamically based on tables
  const columns = useMemo(() => {
    if (!data || !data.tables) return [];

    const baseColumns = [
      {
        title: 'Ship Code',
        field: 'ship_code',
        width: 100,
        headerFilter: 'list',
        headerFilterParams: {
          valuesLookup: true,
          autocomplete: true
        },
        frozen: true
      },
      {
        title: 'Month',
        field: 'month_name',
        width: 120,
        headerFilter: 'list',
        headerFilterParams: {
          valuesLookup: true,
          autocomplete: true
        },
        frozen: true
      },
      {
        title: 'Departure Date',
        field: 'departure_date',
        width: 120,
        headerFilter: 'input',
        headerFilterPlaceholder: 'YYYY-MM-DD',
        formatter: (cell) => {
          const value = cell.getValue();
          if (!value) return '';
          return formatDayMon(value, '');
        },
        frozen: true
      },
      {
        title: 'Sail Code',
        field: 'sail_code',
        width: 120,
        headerFilter: 'input',
        frozen: true
      }
    ];

    // Add columns for each table (combined match/missing format)
    const tableColumns = data.tables.map(tableName => ({
      title: tableName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      field: tableName,
      hozAlign: 'center',
      widthGrow: 1, // Auto-resize to fill available width
      minWidth: 100, // Minimum width to ensure readability
      headerFilter: 'input',
      formatter: (cell) => {
        try {
          const value = cell.getValue();
          if (!value || typeof value !== 'string') return '<span>0/0</span>';
          
          const parts = value.split('/');
          if (parts.length !== 2) return `<span>${value}</span>`;
          
          const match = parseInt(parts[0]) || 0;
          const missing = parseInt(parts[1]) || 0;
          
          // Determine color based on match/missing counts
          let cellClass;
          if (match > 0 && missing === 0) {
            cellClass = 'data-match__count-chip data-match__count-chip--ok';
          } else if (match === 0 && missing > 0) {
            cellClass = 'data-match__count-chip data-match__count-chip--error';
          } else if (match > 0 && missing > 0) {
            cellClass = 'data-match__count-chip data-match__count-chip--warn';
          } else {
            cellClass = 'data-match__count-chip';
          }
          
          return `<span class="${cellClass}">${value}</span>`;
        } catch (e) {
          console.warn('[DataMatch] Error in formatter:', e);
          const value = cell.getValue();
          return `<span>${value || '0/0'}</span>`;
        }
      },
      sorter: (a, b) => {
        // Sort by match count (first number)
        try {
          const aMatch = parseInt(a.split('/')[0]) || 0;
          const bMatch = parseInt(b.split('/')[0]) || 0;
          return aMatch - bMatch;
        } catch {
          return 0;
        }
      }
    }));

    return [...baseColumns, ...tableColumns];
  }, [data]);

  const openFirstShipOnly = useCallback(() => {
    const table = instanceRef.current;
    if (!table) return;
    const topGroups = table.getGroups?.() || [];
    if (!topGroups.length) return;
    topGroups.forEach((group, index) => {
      if (!group) return;
      if (index === 0) {
        group.show?.();
        const monthGroups = group.getSubGroups?.() || [];
        monthGroups.forEach((subGroup, subIndex) => {
          if (!subGroup) return;
          if (subIndex === 0) subGroup.show?.();
          else subGroup.hide?.();
        });
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

  // Initialize table once when component mounts
  useEffect(() => {
    let cancelled = false;

    const initTable = async () => {
      if (!tableRef.current || cancelled) return;

      try {
        const Tabulator = await initTabulator();
        if (cancelled || !tableRef.current) return;

        if (instanceRef.current) {
          instanceRef.current.destroy();
        }

        instanceRef.current = new Tabulator(tableRef.current, {
          data: transformedData,
          columns: columns,
          layout: 'fitDataTable',
          height: '100%',
          headerFilterLiveFilter: true,
          headerFilterLiveFilterDelay: 300,
          selectableRows: 1, // Single row selection
          groupBy: GROUP_BY, // Group by ship_code first, then month_name
          groupHeader: GROUP_HEADERS,
          groupStartOpen: [true, false],
          groupToggleElement: 'header',
          pagination: true,
          paginationSize: 50,
          paginationSizeSelector: [25, 50, 100, 200],
          initialSort: [
            { column: 'ship_code', dir: 'asc' },
            { column: 'departure_date', dir: 'asc' }
          ],
          frozenRows: 0,
          frozenColumns: 4 // Ship Code, Month, Departure Date, Sail Code
        });

        instanceRef.current.on('tableBuilt', () => {
          tableBuiltRef.current = true;
          if (!didApplyInitialGroupOpenRef.current) {
            openFirstShipOnly();
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

        // Register event listeners using Tabulator's .on() method (same as SailingTablePresenter)
        instanceRef.current.on("rowClick", (e, row) => {
          try { row?.select?.(); } catch { /* noop */ }
        });

        instanceRef.current.on("rowSelected", (row) => {
          const data = row.getData();
          console.log("[DataMatch] Row selected:", data);
          
          // Create event detail object
          const eventDetail = {
            sail_code: data.sail_code,
            ship_code: data.ship_code,
            departure_date: data.departure_date,
            month_name: data.month_name,
            row_data: data,
            timestamp: new Date().toISOString()
          };
          
        // Create event with all key fields for persistence
        const event = new CustomEvent(SAIL_SELECT_EVENT, { detail: eventDetail });
          
          // Store for context restoration (components check these on mount)
          window.lastSailSelectEvent = event;
        window.latestEvent = {
          name: SAIL_SELECT_EVENT,
            detail: eventDetail,
            timestamp: new Date().toLocaleTimeString()
          };
          
          // Emit sail select event (other components listen to this)
        emitSailSelect(eventDetail);
        });

        instanceRef.current.on("rowDeselected", () => {
          console.log("[DataMatch] Row deselected");
          
          // Clear stored event
          window.lastSailSelectEvent = null;
          
          // Emit clear event
        emitSailClear({ timestamp: new Date().toISOString() });
        });

        console.log('[DataMatch] Table initialized with', transformedData.length, 'rows');
        lastDataRef.current = transformedData ? JSON.stringify(transformedData) : null;
      } catch (err) {
        console.error('[DataMatch] Error initializing table:', err);
      }
    };

    initTable();

    return () => {
      cancelled = true;
      tableBuiltRef.current = false;
      pendingGroupActionRef.current = null;
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
          instanceRef.current = null;
        } catch (e) {
          console.warn('[DataMatch] Error destroying table:', e);
        }
      }
    };
  }, [applyGroupDepth, collapseAllGroups, openAllGroups, openFirstShipOnly]); // Initialize once on mount

  // Update table data and columns when data changes
  useEffect(() => {
    if (!instanceRef.current) return;

    // Check if data actually changed
    const currentDataStr = transformedData ? JSON.stringify(transformedData) : null;
    if (lastDataRef.current === currentDataStr) {
      return;
    }

    try {
      console.log('[DataMatch] Updating table data:', transformedData.length, 'rows');
      
      // Update columns if they changed
      if (columns.length > 0) {
        instanceRef.current.setColumns(columns);
      }
      
      // Update data
      instanceRef.current.replaceData(transformedData);
      if (!didApplyInitialGroupOpenRef.current) {
        openFirstShipOnly();
        didApplyInitialGroupOpenRef.current = true;
      }
      lastDataRef.current = currentDataStr;
    } catch (e) {
      console.warn('[DataMatch] Error updating data:', e);
    }
  }, [columns, openFirstShipOnly, transformedData]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.__taliaPanelGroupActions = window.__taliaPanelGroupActions || {};
    const componentKey = panelComponentId || 'data-match';
    const actions = {
      openAll: openAllGroups,
      collapseAll: collapseAllGroups,
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
      const thisComponent = panelComponentId || 'data-match';
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
    <div className="focus-panel data-match data-match-panel">
      {/* Filter Panel */}
      <div className="data-match__filters talia-report-filters">
        <label className="data-match__label talia-report-filters__group">
          <span className="talia-report-filters__label">Ship Code:</span>
          <input
            type="text"
            value={filters.ship_code || ''}
            onChange={(e) => onFiltersChange({ ...filters, ship_code: e.target.value || null })}
            placeholder="Filter by ship code"
            className="data-match__input talia-report-filters__input"
          />
        </label>
        <label className="data-match__label talia-report-filters__group">
          <span className="talia-report-filters__label">Sail Code:</span>
          <input
            type="text"
            value={filters.sail_code || ''}
            onChange={(e) => onFiltersChange({ ...filters, sail_code: e.target.value || null })}
            placeholder="Filter by sail code"
            className="data-match__input talia-report-filters__input"
          />
        </label>
        <label className="data-match__label talia-report-filters__group">
          <span className="talia-report-filters__label">Date From:</span>
          <input
            type="date"
            value={filters.date_from || ''}
            onChange={(e) => onFiltersChange({ ...filters, date_from: e.target.value || null })}
            className="data-match__input data-match__input--date talia-report-filters__input"
          />
        </label>
        <label className="data-match__label talia-report-filters__group">
          <span className="talia-report-filters__label">Date To:</span>
          <input
            type="date"
            value={filters.date_to || ''}
            onChange={(e) => onFiltersChange({ ...filters, date_to: e.target.value || null })}
            className="data-match__input data-match__input--date talia-report-filters__input"
          />
        </label>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="talia-btn talia-btn--small data-match__refresh"
          >
            ↻ Refresh
          </button>
        )}
      </div>

      {/* Table */}
      <div 
        ref={tableRef} 
        className="focus-panel__table data-match__table data-match-table"
      />
    </div>
  );
};

export default DataMatchPresenter;

