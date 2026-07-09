import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import { formatDayMon } from '../../../lib/dateFormat';
import { filterDayRowsByScope, scopeNeedsGroupExpansion } from './shipDayBerthTransform';

const REPORT_GROUP_ACTION_EVENT = 'talia:report.groupAction';
const VIEW_MODE_STORAGE_KEY = 'talia.ship-day-berth.viewMode';

const readStoredViewMode = () => {
  try {
    return localStorage.getItem(VIEW_MODE_STORAGE_KEY) === 'table' ? 'table' : 'nested';
  } catch {
    return 'nested';
  }
};

const GROUP_BY = [
  (rowData) => rowData?.ship_group_label || 'Unknown ship',
  (rowData) => rowData?.month_label || 'Unknown month',
];

const GROUP_MAX_DEPTH = GROUP_BY.length;

const groupHeaders = [
  (value, count) => `<span class="master-sailing-group master-sailing-group--ship">${value} (${count})</span>`,
  (value, count) => `<span class="master-sailing-group master-sailing-group--month">${value} (${count})</span>`,
];

const formatCount = (value) => {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return '—';
  return numeric.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

const formatOccupancy = (value) => {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return '—';
  return `${numeric.toFixed(0)}%`;
};

const occupancyClass = (pct) => {
  const numeric = Number.parseFloat(pct);
  if (!Number.isFinite(numeric)) return '';
  if (numeric >= 95) return 'ms-berth-occ--full';
  if (numeric >= 80) return 'ms-berth-occ--high';
  if (numeric >= 50) return 'ms-berth-occ--mid';
  return 'ms-berth-occ--low';
};

const ShipDayBerthPresenter = ({
  dayRows,
  summaries,
  selectedScope = null,
  onClearSelection,
  panelInstanceId,
  panelComponentId,
}) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const tableBuiltRef = useRef(false);
  const groupCycleDepthRef = useRef(1);
  const pendingGroupActionRef = useRef(null);
  const dayRowsRef = useRef(dayRows);
  const [search, setSearch] = useState('');
  const [viewMode, setViewModeState] = useState(readStoredViewMode);

  const setViewMode = useCallback((mode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch {
      // Ignore storage errors (private mode, quota, etc.)
    }
  }, []);

  const isNestedView = viewMode === 'nested';

  const voyageSailCodes = useMemo(
    () => new Set((selectedScope?.sail_codes || []).map((code) => String(code))),
    [selectedScope]
  );
  const scopeShipCode = selectedScope?.ship_code
    ? String(selectedScope.ship_code).trim()
    : null;

  const filteredRows = useMemo(
    () => filterDayRowsByScope(dayRows, selectedScope, search),
    [dayRows, search, selectedScope]
  );

  const filteredRowsRef = useRef(filteredRows);
  useEffect(() => {
    filteredRowsRef.current = filteredRows;
  }, [filteredRows]);

  useEffect(() => {
    dayRowsRef.current = dayRows;
  }, [dayRows]);

  const columns = useMemo(() => [
    {
      field: 'date',
      title: 'Date',
      width: 110,
      headerSort: false,
      formatter: (cell) => {
        const row = cell.getRow().getData();
        const label = formatDayMon(cell.getValue(), cell.getValue() || '');
        if (row?.in_voyage) {
          return `<span class="ms-berth-voyage-dot" title="Part of selected voyage"></span>${label}`;
        }
        return label;
      },
    },
    {
      field: 'sail_codes',
      title: 'Sail code(s)',
      minWidth: 150,
      headerSort: false,
      formatter: (cell) => {
        const codes = cell.getValue() || [];
        if (!codes.length) return '<span class="ms-berth-sail--empty">—</span>';
        const stackClass = isNestedView ? '' : ' ms-berth-sails--stacked';
        return `<span class="ms-berth-sails${stackClass}">${codes.map((code) => {
          const isVoyage = voyageSailCodes.has(String(code));
          return `<span class="ms-berth-sail ${isVoyage ? 'ms-berth-sail--voyage' : ''}">${code}</span>`;
        }).join('')}</span>`;
      },
    },
    {
      field: 'occupied',
      title: 'Booked (berths)',
      hozAlign: 'right',
      width: 120,
      headerSort: false,
      formatter: (cell) => formatCount(cell.getValue()),
    },
    {
      field: 'capacity',
      title: 'Capacity (berths)',
      hozAlign: 'right',
      width: 130,
      headerSort: false,
      formatter: (cell) => formatCount(cell.getValue()),
    },
    {
      field: 'available',
      title: 'Available',
      hozAlign: 'right',
      width: 100,
      headerSort: false,
      formatter: (cell) => formatCount(cell.getValue()),
    },
    {
      field: 'occupancy_pct',
      title: 'Occupancy',
      hozAlign: 'right',
      width: 110,
      headerSort: false,
      formatter: (cell) => {
        const value = cell.getValue();
        return `<span class="ms-berth-occ ${occupancyClass(value)}">${formatOccupancy(value)}</span>`;
      },
    },
  ], [isNestedView, voyageSailCodes]);

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

  const collapseAllGroups = useCallback(() => applyGroupDepth(0), [applyGroupDepth]);
  const openAllGroups = useCallback(() => applyGroupDepth(GROUP_MAX_DEPTH), [applyGroupDepth]);
  const cycleGroupState = useCallback(() => {
    const nextDepth = (groupCycleDepthRef.current + 1) % (GROUP_MAX_DEPTH + 1);
    return applyGroupDepth(nextDepth);
  }, [applyGroupDepth]);
  const getGroupCycleState = useCallback(() => ({
    depth: groupCycleDepthRef.current,
    maxDepth: GROUP_MAX_DEPTH,
  }), []);

  // Focus the linked scope: open ship/month groups and scroll voyage days into view.
  const focusSelectedScope = useCallback(() => {
    const table = instanceRef.current;
    if (!table || !tableBuiltRef.current || !isNestedView || !scopeNeedsGroupExpansion(selectedScope)) return;

    const run = () => {
      const shipGroups = table.getGroups?.() || [];
      let firstVoyageKey = null;
      const restrictToVoyage = voyageSailCodes.size > 0;

      shipGroups.forEach((shipGroup) => {
        const monthGroups = shipGroup.getSubGroups?.() || [];
        const shipRows = monthGroups.flatMap((monthGroup) => monthGroup.getRows?.() || []);
        const matchesShip = !scopeShipCode
          || shipRows.some((row) => String(row.getData?.()?.ship_code || '').trim() === scopeShipCode);

        if (!matchesShip) {
          shipGroup.hide?.();
          return;
        }

        shipGroup.show?.();
        monthGroups.forEach((monthGroup) => {
          const rows = monthGroup.getRows?.() || [];
          const hasVoyage = rows.some((row) => row.getData?.()?.in_voyage);
          const shouldOpen = restrictToVoyage ? hasVoyage : rows.length > 0;
          if (shouldOpen) {
            monthGroup.show?.();
            if (!firstVoyageKey) {
              const match = restrictToVoyage
                ? rows.find((row) => row.getData?.()?.in_voyage)
                : rows[0];
              firstVoyageKey = match?.getData?.()?.row_key || null;
            }
          } else {
            monthGroup.hide?.();
          }
        });
      });

      if (firstVoyageKey) {
        try { table.scrollToRow(firstVoyageKey, 'top', false); } catch { /* noop */ }
      }
    };

    window.requestAnimationFrame(run);
  }, [isNestedView, scopeShipCode, selectedScope, voyageSailCodes]);

  const afterTableDataRefresh = useCallback((refreshPromise) => {
    const apply = () => focusSelectedScope();
    if (refreshPromise && typeof refreshPromise.then === 'function') {
      refreshPromise.then(apply).catch(apply);
      return;
    }
    window.requestAnimationFrame(apply);
  }, [focusSelectedScope]);

  useEffect(() => {
    let cancelled = false;

    const initTable = async () => {
      if (!tableRef.current) return;
      try {
        const Tabulator = await initTabulator();
        if (cancelled) return;
        if (instanceRef.current) instanceRef.current.destroy();

        instanceRef.current = new Tabulator(tableRef.current, getTabulatorOptions({
          data: [],
          columns,
          index: 'row_key',
          height: '100%',
          selectableRows: 1,
          resizableColumns: true,
          movableColumns: true,
          pagination: false,
          groupBy: isNestedView ? GROUP_BY : false,
          groupStartOpen: isNestedView ? [true, false] : false,
          groupHeader: isNestedView ? groupHeaders : undefined,
          rowFormatter: (row) => {
            const element = row.getElement();
            const data = row.getData();
            if (!element) return;
            element.classList.add('ms-berth-row--day');
            element.classList.toggle('ms-berth-row--voyage', data?.in_voyage === true);
          },
        }));

        instanceRef.current.on('tableBuilt', () => {
          tableBuiltRef.current = true;
          try { afterTableDataRefresh(instanceRef.current.replaceData(filteredRowsRef.current || [])); } catch { /* noop */ }
          const pendingAction = pendingGroupActionRef.current;
          if (typeof pendingAction === 'string' && pendingAction.startsWith('depth:')) {
            pendingGroupActionRef.current = null;
            const depth = Number.parseInt(pendingAction.split(':')[1], 10);
            applyGroupDepth(Number.isNaN(depth) ? 1 : depth);
          }
        });
      } catch (error) {
        console.error('[ShipDayBerth] Failed to initialize table:', error);
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
  }, [afterTableDataRefresh, applyGroupDepth, columns, isNestedView]);

  useEffect(() => {
    if (!instanceRef.current || !tableBuiltRef.current) return;
    try {
      afterTableDataRefresh(instanceRef.current.replaceData(filteredRows || []));
    } catch (error) {
      console.warn('[ShipDayBerth] Failed to update table data:', error);
    }
  }, [afterTableDataRefresh, filteredRows]);

  useEffect(() => {
    if (!selectedScope || !tableBuiltRef.current || !isNestedView) return;
    focusSelectedScope();
  }, [focusSelectedScope, isNestedView, selectedScope]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.__taliaPanelGroupActions = window.__taliaPanelGroupActions || {};
    const componentKey = panelComponentId || 'ship-day-berth';
    const actions = {
      openAll: openAllGroups,
      collapseAll: collapseAllGroups,
      cycle: cycleGroupState,
      getCycleState: getGroupCycleState,
    };
    window.__taliaPanelGroupActions[componentKey] = actions;
    if (panelInstanceId) window.__taliaPanelGroupActions[panelInstanceId] = actions;
    return () => {
      if (!window.__taliaPanelGroupActions) return;
      delete window.__taliaPanelGroupActions[componentKey];
      if (panelInstanceId) delete window.__taliaPanelGroupActions[panelInstanceId];
    };
  }, [collapseAllGroups, cycleGroupState, getGroupCycleState, openAllGroups, panelComponentId, panelInstanceId]);

  useEffect(() => {
    const handleGroupAction = (event) => {
      const detail = event?.detail || {};
      const thisComponent = panelComponentId || 'ship-day-berth';
      const isTargeted = !detail.panelId && !detail.panelComponent
        ? true
        : detail.panelId === panelInstanceId || detail.panelComponent === thisComponent;
      if (!isTargeted) return;
      if (detail.action === 'openAll') openAllGroups();
      else if (detail.action === 'collapseAll') collapseAllGroups();
      else if (detail.action === 'cycle') cycleGroupState();
    };
    window.addEventListener(REPORT_GROUP_ACTION_EVENT, handleGroupAction);
    document.addEventListener(REPORT_GROUP_ACTION_EVENT, handleGroupAction);
    return () => {
      window.removeEventListener(REPORT_GROUP_ACTION_EVENT, handleGroupAction);
      document.removeEventListener(REPORT_GROUP_ACTION_EVENT, handleGroupAction);
    };
  }, [collapseAllGroups, cycleGroupState, openAllGroups, panelComponentId, panelInstanceId]);

  const shipCount = summaries?.length || 0;
  const dayCount = dayRows?.length || 0;
  const voyageDayCount = filteredRows.filter((row) => row.in_voyage).length;
  const restrictToVoyage = voyageSailCodes.size > 0;
  const sailCodesLabel = (selectedScope?.sail_codes || [])
    .map((code) => String(code))
    .filter(Boolean)
    .join(', ');
  const subtitle = selectedScope
    ? `${filteredRows.length} ship-days${restrictToVoyage ? ` · ${voyageDayCount} in voyage` : ''}`
    : `${shipCount} ships · ${dayCount} ship-days`;

  return (
    <div className="focus-panel talia-report master-sailing-panel ms-explorer-panel ms-berth-panel">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Ship × Day Berths</h2>
          <p className="talia-report__subtitle">
            {subtitle}
          </p>
        </div>
      </header>
      <div className="master-sailing-panel__filters talia-report-filters ms-berth-filters">
        {selectedScope && (
          <div className="ms-berth-criteria" aria-label="Linked selection criteria">
            <div className="ms-berth-criteria__item">
              <span className="ms-berth-criteria__label">Ship</span>
              <span className="ms-berth-criteria__value">
                {selectedScope.ship_name || selectedScope.ship_code || '—'}
              </span>
            </div>
            {selectedScope.reference_sail_code && (
              <div className="ms-berth-criteria__item">
                <span className="ms-berth-criteria__label">Voyage</span>
                <span className="ms-berth-criteria__value">{selectedScope.reference_sail_code}</span>
              </div>
            )}
            {sailCodesLabel && (
              <div className="ms-berth-criteria__item">
                <span className="ms-berth-criteria__label">Sail codes</span>
                <span className="ms-berth-criteria__value">{sailCodesLabel}</span>
              </div>
            )}
            <div className="ms-berth-criteria__item">
              <span className="ms-berth-criteria__label">Days</span>
              <span className="ms-berth-criteria__value">
                {filteredRows.length}
                {restrictToVoyage && voyageDayCount !== filteredRows.length
                  ? ` (${voyageDayCount} voyage)`
                  : ''}
              </span>
            </div>
            <button
              type="button"
              className="talia-btn talia-btn--ghost ms-berth-criteria__clear"
              onClick={() => onClearSelection?.()}
            >
              Clear
            </button>
          </div>
        )}
        <label className="master-sailing-panel__filter talia-report-filters__group">
          <span className="talia-report-filters__label">Search</span>
          <input
            className="talia-report-filters__input"
            type="text"
            placeholder="Ship, date, or sail code"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      <div className="talia-report__controls" aria-label="Ship day berth controls">
        <button
          type="button"
          className={`talia-btn ${isNestedView ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
          aria-pressed={isNestedView}
          onClick={() => setViewMode('nested')}
        >
          Nested
        </button>
        <button
          type="button"
          className={`talia-btn ${!isNestedView ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
          aria-pressed={!isNestedView}
          onClick={() => setViewMode('table')}
        >
          Table
        </button>
        {isNestedView && (
          <>
            <button type="button" className="talia-btn talia-btn--secondary" onClick={openAllGroups}>
              Expand months
            </button>
            <button type="button" className="talia-btn talia-btn--secondary" onClick={collapseAllGroups}>
              Collapse
            </button>
          </>
        )}
      </div>
      <div ref={tableRef} className="focus-panel__table master-sailing-table ms-explorer-table ms-berth-table" />
    </div>
  );
};

export default ShipDayBerthPresenter;
