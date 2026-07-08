import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import { formatDayMon } from '../../../lib/dateFormat';

const REPORT_GROUP_ACTION_EVENT = 'talia:report.groupAction';

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

  const voyageSailCodes = useMemo(
    () => new Set((selectedScope?.sail_codes || []).map((code) => String(code))),
    [selectedScope]
  );
  const scopeShipCode = selectedScope?.ship_code || null;

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = (dayRows || []).filter((row) => {
      if (scopeShipCode && row.ship_code !== scopeShipCode) return false;
      if (!term) return true;
      const haystack = [
        row.ship_name,
        row.ship_code,
        row.date,
        ...(row.sail_codes || []),
      ].join(' ').toLowerCase();
      return haystack.includes(term);
    });
    // Annotate voyage membership so the row formatter can highlight in-voyage days.
    return rows.map((row) => ({
      ...row,
      in_voyage: voyageSailCodes.size > 0
        && (row.sail_codes || []).some((code) => voyageSailCodes.has(String(code))),
    }));
  }, [dayRows, search, scopeShipCode, voyageSailCodes]);

  const filteredRowsRef = useRef(filteredRows);
  useEffect(() => {
    filteredRowsRef.current = filteredRows;
  }, [filteredRows]);

  useEffect(() => {
    dayRowsRef.current = dayRows;
  }, [dayRows]);

  const columns = useMemo(() => ([
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
        return `<span class="ms-berth-sails">${codes.map((code) => {
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
  ]), [voyageSailCodes]);

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

  // Focus the selected voyage: open its ship + months with voyage days, scroll into view.
  const focusSelectedVoyage = useCallback(() => {
    const table = instanceRef.current;
    if (!table || !tableBuiltRef.current) return;
    if (voyageSailCodes.size === 0) return;

    const shipGroups = table.getGroups?.() || [];
    let firstVoyageKey = null;
    shipGroups.forEach((shipGroup) => {
      shipGroup.show?.();
      const monthGroups = shipGroup.getSubGroups?.() || [];
      monthGroups.forEach((monthGroup) => {
        const rows = monthGroup.getRows?.() || [];
        const hasVoyage = rows.some((row) => row.getData?.()?.in_voyage);
        if (hasVoyage) {
          monthGroup.show?.();
          if (!firstVoyageKey) {
            const match = rows.find((row) => row.getData?.()?.in_voyage);
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
  }, [voyageSailCodes]);

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
          groupBy: GROUP_BY,
          groupStartOpen: [true, false],
          groupHeader: groupHeaders,
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
          try { instanceRef.current.replaceData(filteredRowsRef.current || []); } catch { /* noop */ }
          const pendingAction = pendingGroupActionRef.current;
          if (typeof pendingAction === 'string' && pendingAction.startsWith('depth:')) {
            pendingGroupActionRef.current = null;
            const depth = Number.parseInt(pendingAction.split(':')[1], 10);
            applyGroupDepth(Number.isNaN(depth) ? 1 : depth);
          }
          focusSelectedVoyage();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyGroupDepth, columns]);

  useEffect(() => {
    if (!instanceRef.current || !tableBuiltRef.current) return;
    try {
      instanceRef.current.replaceData(filteredRows || []);
      focusSelectedVoyage();
    } catch (error) {
      console.warn('[ShipDayBerth] Failed to update table data:', error);
    }
  }, [filteredRows, focusSelectedVoyage]);

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
  const subtitle = selectedScope
    ? `${selectedScope.ship_name || selectedScope.ship_code || 'Selected'} · ${filteredRows.length} ship-days · ${voyageDayCount} in voyage`
    : `${shipCount} ships · ${dayCount} ship-days · physical berth capacity / occupied / available`;

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
      {selectedScope && (
        <div className="ms-berth-selection">
          <span className="ms-berth-selection__label">Linked to</span>
          <span className="ms-berth-selection__chip">
            {selectedScope.reference_sail_code || selectedScope.ship_code}
            {selectedScope.ship_name ? ` · ${selectedScope.ship_name}` : ''}
          </span>
          <span className="ms-berth-selection__hint">via inventory reference</span>
          <button
            type="button"
            className="talia-btn talia-btn--ghost ms-berth-selection__clear"
            onClick={() => onClearSelection?.()}
          >
            Clear
          </button>
        </div>
      )}
      {summaries?.length > 0 && (
        <div className="ms-berth-summary">
          {summaries
            .filter((summary) => !scopeShipCode || summary.ship_code === scopeShipCode)
            .map((summary) => (
              <div key={summary.ship_code} className="ms-berth-summary__card">
                <span className="ms-berth-summary__ship">{summary.ship_name}</span>
                <span className="ms-berth-summary__metric">
                  Peak berths <strong>{formatCount(summary.peak_capacity)}</strong>
                </span>
                <span className="ms-berth-summary__metric">
                  Peak booked <strong>{formatCount(summary.peak_occupied)}</strong>
                </span>
                <span className="ms-berth-summary__metric">
                  Tightest availability <strong>{formatCount(summary.min_available)}</strong>
                </span>
              </div>
            ))}
        </div>
      )}
      <div className="master-sailing-panel__filters talia-report-filters">
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
        <button type="button" className="talia-btn talia-btn--secondary" onClick={openAllGroups}>
          Expand months
        </button>
        <button type="button" className="talia-btn talia-btn--secondary" onClick={collapseAllGroups}>
          Collapse
        </button>
      </div>
      <div ref={tableRef} className="focus-panel__table master-sailing-table ms-explorer-table ms-berth-table" />
    </div>
  );
};

export default ShipDayBerthPresenter;
