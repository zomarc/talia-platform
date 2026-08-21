/**
 * Compact date × ship (or voyage) pressure grid. Details live in HoverPreview.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../lib/tabulatorConfig';
import { emitSailSelect, emitShipSelect, SAIL_CLEAR_EVENT, SAIL_SELECT_EVENT } from '../../../lib/eventBus';
import {
  DEMAND_UNIT_CABINS,
  demandUnitNoun,
  normalizeDemandUnit,
  toDemandVolume,
} from '../../../lib/demandUnit';
import {
  setGlobalShipCode,
  SHIP_FILTER_ALL,
  useGlobalShipFilter,
} from '../../../hooks/useGlobalShipFilter';
import {
  CABIN_CATEGORY_MODE,
  CABIN_CATEGORY_MODE_OPTIONS,
} from '../../../lib/cabinCategoryGroups';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import { resolveViewValue } from '../../../lib/componentOptionsCatalog';
import HoverPreview from '../../shared/HoverPreview';
import ReportSnapshot from '../../shared/ReportSnapshot';
import ReportDataDetails from '../../shared/ReportDataDetails';
import {
  BAR_SPLIT,
  DEFAULT_BAR_SPLIT,
  dateInRange,
  normalizeBarSplit,
  PRESSURE_FLAGS,
  PRESSURE_GRAINS,
  resolveSelectionRowBand,
} from './shipDayPressureTransform';

const FOLLOW_GLOBAL_CAT = '__global__';
const BAR_SPLIT_DEF = {
  id: 'barSplit',
  default: DEFAULT_BAR_SPLIT,
};

const resolveSelectedReference = (scope) => {
  if (!scope) return null;
  const code = scope.reference_sail_code
    || scope.canonical_scope?.reference_sail_code
    || scope.sail_code
    || null;
  const normalized = String(code || '').trim();
  return normalized || null;
};

const resolveSelectedSailCodes = (scope) => {
  const codes = new Set();
  const reference = resolveSelectedReference(scope);
  if (reference) codes.add(reference);
  const lists = [
    scope?.sail_codes,
    scope?.canonical_scope?.sail_codes,
  ];
  lists.forEach((list) => {
    (Array.isArray(list) ? list : []).forEach((code) => {
      const normalized = String(code || '').trim();
      if (normalized) codes.add(normalized);
    });
  });
  return codes;
};

const columnMatchesSelection = (col, selectedShip, selectedSailCodes) => {
  if (!col) return false;
  if (col.kind === 'voyage') {
    if (selectedSailCodes?.has?.(col.id)) return true;
    return (col.sail_codes || []).some((code) => selectedSailCodes?.has?.(String(code)));
  }
  // Day / ship / cabin columns: ship-level chrome only when no voyage is active.
  if (selectedSailCodes?.size) return false;
  if (!selectedShip) return false;
  return String(col.ship_code || '') === String(selectedShip);
};
const pct = (part, whole) => {
  if (!whole) return 0;
  return Math.max(0, Math.min(100, (part / whole) * 100));
};

const fmt = (value, digits = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
};

const flagLabel = (flag) => {
  if (flag === PRESSURE_FLAGS.BLOCKING) return 'Blocking';
  if (flag === PRESSURE_FLAGS.OVER) return 'Over';
  if (flag === PRESSURE_FLAGS.UNDER) return 'Under';
  if (flag === PRESSURE_FLAGS.SOFT_GROUP) return 'Soft group';
  return 'OK';
};

const isCabinsUnit = (demandUnit) => normalizeDemandUnit(demandUnit) === DEMAND_UNIT_CABINS;

/** Physical sellable in the active unit — never guests÷2 for cabin capacity. */
const cellSellable = (cell, demandUnit) => {
  if (!cell) return 0;
  if (isCabinsUnit(demandUnit)) {
    const cabins = Number(cell.sellable_cabins);
    if (Number.isFinite(cabins) && cabins > 0) return cabins;
    const nameplate = Number(cell.nameplate_cabins) || 0;
    const offsale = Number(cell.offsale_cabins) || 0;
    return Math.max(0, nameplate - offsale);
  }
  const berths = Number(cell.sellable_berths ?? cell.sellable);
  return Number.isFinite(berths) ? Math.max(0, berths) : 0;
};

const cellOccupiedDisplay = (cell, demandUnit) => {
  if (!cell) return 0;
  if (isCabinsUnit(demandUnit)) {
    const cabins = Number(cell.occupied_cabins);
    if (Number.isFinite(cabins) && cabins > 0) return cabins;
  }
  return toDemandVolume(cell.occupied, demandUnit) || 0;
};

const renderCellHtml = (cell, demandUnit, barSplit = DEFAULT_BAR_SPLIT) => {
  if (!cell) return '<span class="sdp-cell sdp-cell--empty"></span>';
  const cabinGrain = cell.grain === 'cabin';
  const cap = cabinGrain
    ? (Number(cell.sellable_cabins) || 0)
    : cellSellable(cell, demandUnit);
  const booked = cabinGrain
    ? (Number(cell.occupied_cabins) || 0)
    : (toDemandVolume(cell.booked, demandUnit) || 0);
  const useFitGroup = normalizeBarSplit(barSplit) === BAR_SPLIT.FIT_GROUP;
  let primary = 0;
  let secondary = 0;
  let primaryClass = 'sdp-cell__booked--master';
  let secondaryClass = 'sdp-cell__booked--segment';
  if (cabinGrain) {
    primary = booked;
  } else if (useFitGroup) {
    primary = toDemandVolume(cell.booked_fit, demandUnit) || 0;
    secondary = toDemandVolume(cell.booked_group, demandUnit) || 0;
    primaryClass = 'sdp-cell__booked--fit';
    secondaryClass = 'sdp-cell__booked--group';
    if (!primary && !secondary && booked) {
      primary = booked;
      primaryClass = 'sdp-cell__booked--master';
    }
  } else {
    primary = toDemandVolume(cell.booked_master ?? cell.booked, demandUnit) || 0;
    secondary = toDemandVolume(cell.booked_segment, demandUnit) || 0;
  }
  const estimated = cabinGrain ? 0 : (toDemandVolume(cell.estimated, demandUnit) || 0);
  const primaryPct = pct(primary, cap);
  const secondaryPct = pct(secondary, cap);
  const estPct = pct(estimated, cap);
  const flag = cell.flag || PRESSURE_FLAGS.OK;
  const blockingCats = (cell.blocking_categories || []).map((item) => item.category).filter(Boolean);
  const title = blockingCats.length ? `Blocking: ${blockingCats.join(', ')}` : '';
  const primarySpan = primaryPct > 0
    ? `<span class="sdp-cell__booked ${primaryClass}" style="width:${primaryPct}%"></span>`
    : '';
  const secondarySpan = secondaryPct > 0
    ? `<span class="sdp-cell__booked ${secondaryClass}" style="width:${secondaryPct}%"></span>`
    : '';
  return (
    `<div class="sdp-cell sdp-cell--${flag}" data-flag="${flag}"${title ? ` title="${title}"` : ''}>`
    + `<div class="sdp-cell__track" aria-hidden="true">`
    + primarySpan
    + secondarySpan
    + `<span class="sdp-cell__est" style="width:${estPct}%"></span>`
    + `</div></div>`
  );
};

const ShipDayPressurePresenter = ({
  bundle,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  grain,
  onGrainChange,
  shipFilter = SHIP_FILTER_ALL,
  onShipFilterChange,
  shipOptions = [],
  cabinCategoryMode = CABIN_CATEGORY_MODE.REAL,
  cabinCategoryModeOverride = null,
  onCabinCategoryModeChange,
  globalCabinCategoryMode = CABIN_CATEGORY_MODE.REAL,
  demandUnit,
  selectedScope = null,
  panelInstanceId,
  panelComponentId,
}) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const builtRef = useRef(false);
  const demandUnitRef = useRef(demandUnit);
  demandUnitRef.current = demandUnit;
  const [hover, setHover] = useState(null);
  /** Date row highlighted when this panel emitted the sail.select (cell click). */
  const [selectedDate, setSelectedDate] = useState(null);
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const globalShipCode = useGlobalShipFilter();
  const effectiveShipFilter = shipFilter || globalShipCode || SHIP_FILTER_ALL;
  const {
    showSnapshot,
    showDetails,
    showFilters,
    showControls,
    showTooltip,
    showLegends,
    reportShellClassName,
    viewsState,
  } = useReportShellOptions(panelComponentId || 'ship-day-pressure', panelInstanceId);
  const barSplit = normalizeBarSplit(resolveViewValue(viewsState, BAR_SPLIT_DEF));
  const barSplitRef = useRef(barSplit);
  barSplitRef.current = barSplit;
  const showTooltipRef = useRef(showTooltip);
  showTooltipRef.current = showTooltip;
  const noun = demandUnitNoun(demandUnit);
  const columns = bundle?.columns || [];
  const rows = bundle?.rows || [];
  const counts = bundle?.counts || {};
  const selectedShip = selectedScope?.ship_code ? String(selectedScope.ship_code).trim() : null;
  const selectedReference = resolveSelectedReference(selectedScope);
  const selectedSailCodes = useMemo(() => resolveSelectedSailCodes(selectedScope), [selectedScope]);
  const selectedSailCodesRef = useRef(selectedSailCodes);
  selectedSailCodesRef.current = selectedSailCodes;
  const selectedShipRef = useRef(selectedShip);
  selectedShipRef.current = selectedShip;
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const selectionBandRef = useRef({ focusDate: null, impactFrom: null, impactTo: null });
  const truncatedVoyages = grain === PRESSURE_GRAINS.VOYAGE && columns.filter((col) => col.kind === 'voyage').length >= 48;
  const fitGroupSplit = barSplit === BAR_SPLIT.FIT_GROUP;

  const snapshotItems = useMemo(() => ([
    { key: 'blocking', label: 'Blocking', value: counts.blocking || 0, tone: counts.blocking ? 'negative' : 'neutral' },
    { key: 'over', label: 'Over', value: counts.over || 0, tone: counts.over ? 'negative' : 'neutral' },
    { key: 'soft', label: 'Soft group', value: counts.soft_group || 0 },
    { key: 'under', label: 'Under', value: counts.under || 0, tone: counts.under ? 'positive' : 'neutral' },
  ]), [counts]);

  const applyRowBandClasses = useCallback((row) => {
    const data = row?.getData?.() || {};
    const band = selectionBandRef.current || {};
    const impact = dateInRange(data.date, band.impactFrom, band.impactTo);
    const focus = Boolean(band.focusDate && data.date === band.focusDate);
    const el = row?.getElement?.();
    el?.classList.toggle('sdp-row--impact', impact && !focus);
    el?.classList.toggle('sdp-row--selected', focus);
    el?.classList.remove('sdp-row--voyage-linked');
  }, []);

  const getTableHolder = useCallback((table) => (
    table?.rowManager?.element
    || table?.element?.querySelector?.('.tabulator-tableholder')
    || tableRef.current?.querySelector?.('.tabulator-tableholder')
    || null
  ), []);

  /**
   * Virtualized Tabulator only mounts ~visible rows, so getRows().find(date)
   * fails when the focus date is off-screen. Scroll by data index instead.
   */
  const scrollToFocusDate = useCallback((table, focusDate) => {
    if (!table || !focusDate) return false;
    const data = (
      (typeof table.getData === 'function' ? table.getData() : null)
      || rowsRef.current
      || []
    );
    const idx = data.findIndex((row) => row?.date === focusDate);
    if (idx < 0) return false;

    const holder = getTableHolder(table);
    const rowHeight = Number(table.options?.rowHeight) || 22;
    if (holder) {
      const target = Math.max(
        0,
        (idx * rowHeight) - (holder.clientHeight / 2) + (rowHeight / 2)
      );
      holder.scrollTop = target;
      holder.dispatchEvent(new Event('scroll'));
    }

    try {
      // Prefer Tabulator API when it can resolve the row (after scroll buffer fills).
      const matched = (table.searchRows?.('date', '=', focusDate) || [])[0];
      if (matched) {
        table.scrollToRow?.(matched, 'center', false);
      } else {
        table.scrollToRow?.(idx, 'center', false);
      }
    } catch {
      // holder scrollTop above is the reliable fallback
    }

    window.requestAnimationFrame(() => {
      try {
        (table.getRows?.() || []).forEach((row) => applyRowBandClasses(row));
      } catch {
        // noop
      }
    });
    return true;
  }, [applyRowBandClasses, getTableHolder]);

  const applySelectionChrome = useCallback((opts = {}) => {
    const table = instanceRef.current;
    if (!table || !builtRef.current) return;
    const sailCodes = selectedSailCodesRef.current;
    const ship = selectedShipRef.current;
    const cols = columnsRef.current || [];
    const voyageCol = cols.find((col) => (
      col.kind === 'voyage' && columnMatchesSelection(col, ship, sailCodes)
    ));
    const meta = bundle?.meta || {};
    // Row band = selected voyage occupancy (not the wider fetch/impact window).
    const voyageForBand = voyageCol || (meta.selectedVoyage
      ? {
        id: meta.selectedVoyage.reference_sail_code,
        date_from: meta.selectedVoyage.date_from,
        date_to: meta.selectedVoyage.date_to,
      }
      : null);
    const band = { ...resolveSelectionRowBand({
      voyageCol: voyageForBand,
      impactFrom: voyageForBand?.date_from,
      impactTo: voyageForBand?.date_to,
      rows: rowsRef.current,
    }) };
    if (selectedDateRef.current) {
      band.focusDate = selectedDateRef.current;
    } else if (band.focusDate) {
      selectedDateRef.current = band.focusDate;
      setSelectedDate((prev) => (prev === band.focusDate ? prev : band.focusDate));
    }
    selectionBandRef.current = band;

    cols.forEach((col) => {
      if (!col?.id || col.id === 'date_label') return;
      let column;
      try {
        column = table.getColumn(col.id);
      } catch {
        column = null;
      }
      if (!column) return;
      const selected = columnMatchesSelection(col, ship, sailCodes);
      const headerEl = column.getElement?.();
      headerEl?.classList.toggle('sdp-col--selected', selected);
      try {
        (column.getCells?.() || []).forEach((cell) => {
          cell.getElement?.()?.classList.toggle('sdp-col--selected', selected);
        });
      } catch {
        // noop
      }
    });

    try {
      (table.getRows?.() || []).forEach((row) => applyRowBandClasses(row));
    } catch {
      // noop
    }

    if (opts.scroll === false) return;

    const focusDate = band.focusDate;
    scrollToFocusDate(table, focusDate);
    // Remount/virtual buffer: retry scroll once layout settles.
    if (focusDate) {
      window.setTimeout(() => scrollToFocusDate(instanceRef.current, focusDate), 50);
      window.setTimeout(() => scrollToFocusDate(instanceRef.current, focusDate), 200);
    }

    if (voyageCol?.id) {
      try {
        const column = table.getColumn?.(voyageCol.id);
        const headerEl = column?.getElement?.();
        const holder = getTableHolder(table);
        if (headerEl && holder) {
          const holderRect = holder.getBoundingClientRect();
          const colRect = headerEl.getBoundingClientRect();
          const delta = (colRect.left + colRect.width / 2)
            - (holderRect.left + holderRect.width / 2);
          holder.scrollLeft = Math.max(0, holder.scrollLeft + delta);
        } else {
          table.scrollToColumn?.(voyageCol.id, 'center', false);
        }
      } catch {
        // noop
      }
    }
  }, [applyRowBandClasses, bundle?.meta, getTableHolder, scrollToFocusDate]);

  // Keep chrome in sync with the bus even when selectedScope prop timing lags.
  useEffect(() => {
    const syncFromBus = (event) => {
      const detail = event?.detail || window.lastSailSelectEvent?.detail || null;
      if (!detail) {
        selectedSailCodesRef.current = new Set();
        selectedShipRef.current = null;
        selectedDateRef.current = null;
        selectionBandRef.current = { focusDate: null, impactFrom: null, impactTo: null };
        setSelectedDate(null);
        applySelectionChrome({ scroll: false });
        return;
      }
      const origin = detail.selection_origin;
      const fromSelf = origin === 'ship-day-pressure';
      const reference = resolveSelectedReference(detail.canonical_scope || detail) || resolveSelectedReference(detail);
      const sailCodes = resolveSelectedSailCodes(detail.canonical_scope || detail);
      if (reference) sailCodes.add(reference);
      (detail.sail_codes || []).forEach((code) => {
        const normalized = String(code || '').trim();
        if (normalized) sailCodes.add(normalized);
      });
      selectedSailCodesRef.current = sailCodes;
      selectedShipRef.current = String(
        detail.ship_code
        || detail.canonical_scope?.ship_code
        || ''
      ).trim() || null;
      if (!fromSelf) {
        // Focus departure once columns are available (applySelectionChrome fills date_from).
        selectedDateRef.current = null;
        setSelectedDate(null);
      }
      applySelectionChrome({ scroll: true });
    };
    const handleClear = () => {
      selectedSailCodesRef.current = new Set();
      selectedShipRef.current = null;
      selectedDateRef.current = null;
      selectionBandRef.current = { focusDate: null, impactFrom: null, impactTo: null };
      setSelectedDate(null);
      applySelectionChrome({ scroll: false });
    };
    window.addEventListener(SAIL_SELECT_EVENT, syncFromBus);
    window.addEventListener(SAIL_CLEAR_EVENT, handleClear);
    if (window.lastSailSelectEvent?.detail) syncFromBus(window.lastSailSelectEvent);
    return () => {
      window.removeEventListener(SAIL_SELECT_EVENT, syncFromBus);
      window.removeEventListener(SAIL_CLEAR_EVENT, handleClear);
    };
  }, [applySelectionChrome]);

  useEffect(() => {
    if (!tableRef.current || !rows.length) return undefined;
    let cancelled = false;

    const mount = async () => {
      const TabGlobal = await initTabulator();
      if (cancelled || !TabGlobal || !tableRef.current) return;

      const dateCol = {
        title: 'Date',
        field: 'date_label',
        frozen: true,
        width: 64,
        minWidth: 56,
        widthGrow: 0,
        resizable: false,
        headerSort: false,
        sorter: false,
        headerFilter: false,
        cssClass: 'sdp-date-col',
      };

      const pressureCols = columns.map((col) => ({
        title: col.label,
        field: col.id,
        frozen: col.kind === 'day',
        ...(col.kind === 'day' ? { width: 72 } : {}),
        minWidth: col.kind === 'day' ? 72 : 64,
        widthGrow: col.kind === 'day' ? 0 : 1,
        resizable: false,
        headerSort: false,
        headerHozAlign: 'center',
        hozAlign: 'center',
        headerTooltip: col.kind === 'voyage'
          ? (col.title_full || col.id)
          : (col.label || col.id),
        cssClass: [
          'sdp-graphic-col',
          col.kind === 'day' ? '' : 'talia-equal-width-col',
          col.kind === 'day' ? 'sdp-day-col' : '',
          col.kind === 'voyage' ? 'sdp-voyage-col' : '',
          columnMatchesSelection(col, selectedShipRef.current, selectedSailCodesRef.current)
            ? 'sdp-col--selected'
            : '',
        ].filter(Boolean).join(' '),
        formatter: (cell) => renderCellHtml(
          cell.getValue(),
          demandUnitRef.current,
          barSplitRef.current
        ),
        headerClick: () => {
          if (col.kind === 'voyage') {
            const sailCodes = new Set([
              String(col.id),
              ...(col.sail_codes || []).map((code) => String(code)),
            ].filter(Boolean));
            selectedSailCodesRef.current = sailCodes;
            selectedShipRef.current = col.ship_code || null;
            selectedDateRef.current = null;
            setSelectedDate(null);
            applySelectionChrome({ scroll: true });
            emitSailSelect({
              sail_code: col.id,
              reference_sail_code: col.id,
              ship_code: col.ship_code,
              ship_name: col.ship_name,
              selection_origin: 'ship-day-pressure',
              row_data: {
                sail_code: col.id,
                reference_sail_code: col.id,
                ship_code: col.ship_code,
                ship_name: col.ship_name,
              },
            });
            return;
          }
          selectedSailCodesRef.current = new Set();
          selectedShipRef.current = col.ship_code || null;
          selectedDateRef.current = null;
          setSelectedDate(null);
          applySelectionChrome({ scroll: true });
          emitShipSelect({
            ship_code: col.ship_code,
            ship_name: col.ship_name,
            selection_origin: 'ship-day-pressure',
            row_data: { ship_code: col.ship_code, ship_name: col.ship_name },
          });
        },
      }));

      const options = getTabulatorOptions({
        panelComponentId: panelComponentId || 'ship-day-pressure',
        panelInstanceId,
        freezeLeadingColumns: grain === PRESSURE_GRAINS.VOYAGE ? 2 : 1,
        // Keep explicit frozen widths; global stretch layout fights horizontal freeze.
        enforceGlobalLayout: false,
        layout: 'fitData',
        data: rows,
        columns: [dateCol, ...pressureCols],
        height: '100%',
        rowHeight: 22,
        headerSort: false,
        selectableRows: false,
        rowFormatter: (row) => {
          applyRowBandClasses(row);
        },
      });

      if (cancelled) {
        try { instanceRef.current?.destroy?.(); } catch { /* noop */ }
        instanceRef.current = null;
        return;
      }
      instanceRef.current = new TabGlobal(tableRef.current, options);
      if (cancelled) {
        try { instanceRef.current.destroy(); } catch { /* noop */ }
        instanceRef.current = null;
        return;
      }
      instanceRef.current.on('cellClick', (e, cell) => {
        const field = cell.getField();
        if (field === 'date_label') return;
        const col = columnsRef.current.find((item) => item.id === field);
        if (!col) return;
        const rowDate = cell.getRow?.()?.getData?.()?.date
          || cell.getValue?.()?.date
          || null;
        if (col.kind === 'voyage') {
          const sailCodes = new Set([
            String(col.id),
            ...(col.sail_codes || []).map((code) => String(code)),
          ].filter(Boolean));
          selectedSailCodesRef.current = sailCodes;
          selectedShipRef.current = col.ship_code || null;
          selectedDateRef.current = rowDate || null;
          setSelectedDate(rowDate || null);
          applySelectionChrome({ scroll: true });
          emitSailSelect({
            sail_code: col.id,
            reference_sail_code: col.id,
            ship_code: col.ship_code,
            ship_name: col.ship_name,
            selection_origin: 'ship-day-pressure',
            row_data: {
              sail_code: col.id,
              reference_sail_code: col.id,
              ship_code: col.ship_code,
              ship_name: col.ship_name,
              date: rowDate,
            },
          });
          return;
        }
        if (col.ship_code) {
          selectedSailCodesRef.current = new Set();
          selectedShipRef.current = col.ship_code;
          selectedDateRef.current = rowDate || null;
          setSelectedDate(rowDate || null);
          applySelectionChrome({ scroll: true });
          emitShipSelect({
            ship_code: col.ship_code,
            ship_name: col.ship_name,
            selection_origin: 'ship-day-pressure',
            row_data: { ship_code: col.ship_code, ship_name: col.ship_name, date: rowDate },
          });
        }
      });
      instanceRef.current.on('cellMouseEnter', (e, cell) => {
        if (cell.getField() === 'date_label') return;
        const value = cell.getValue();
        if (!value || !showTooltipRef.current) return;
        setHover({
          cell: value,
          rect: cell.getElement()?.getBoundingClientRect?.() || null,
        });
      });
      instanceRef.current.on('cellMouseLeave', () => setHover(null));
      instanceRef.current.on('tableBuilt', () => {
        builtRef.current = true;
        applySelectionChrome({ scroll: true });
      });
      builtRef.current = true;
      window.requestAnimationFrame(() => applySelectionChrome({ scroll: true }));
    };

    mount();
    return () => {
      cancelled = true;
      try { instanceRef.current?.destroy?.(); } catch { /* noop */ }
      instanceRef.current = null;
      builtRef.current = false;
    };
  }, [bundle, panelComponentId, panelInstanceId, grain, barSplit, applySelectionChrome]);

  const hoverCell = hover?.cell || null;

  return (
    <div
      className={`focus-panel talia-report ship-day-pressure${reportShellClassName ? ` ${reportShellClassName}` : ''}`}
      role="region"
      aria-label="Ship day pressure"
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Ship × Day Pressure</h2>
          <p className="talia-report__subtitle">
            True sellable cabins (nameplate minus offsale) vs booked / expected · {noun}. Blocking is driven by cabin-category loading.
          </p>
        </div>
      </header>

      <div className={`talia-report-filters${showFilters ? '' : ' talia-report-filters--hidden'}`} aria-label="Date window and ship filter">
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">From</span>
          <input
            type="date"
            className="talia-report-filters__input"
            value={dateFrom || ''}
            onChange={(event) => onDateFromChange?.(event.target.value)}
          />
        </label>
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">To</span>
          <input
            type="date"
            className="talia-report-filters__input"
            value={dateTo || ''}
            onChange={(event) => onDateToChange?.(event.target.value)}
          />
        </label>
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">Ship</span>
          <select
            className="talia-report-filters__input"
            value={effectiveShipFilter || SHIP_FILTER_ALL}
            onChange={(event) => {
              const next = event.target.value;
              onShipFilterChange?.(next);
              setGlobalShipCode(next);
            }}
          >
            <option value={SHIP_FILTER_ALL}>All</option>
            {shipOptions.map((ship) => (
              <option key={ship.code} value={ship.code}>{ship.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="talia-callout" role="note">
        Dead beds: a short product (or a full cabin category) can occupy ship-days that a longer voyage needs.
        Hover a cell for the categories that are blocking. Capacity is never summed across master + segments.
        {truncatedVoyages ? ' Voyage view shows overlapping sailings in this date window (capped).' : ''}
      </div>

      {showControls ? (
        <div className="talia-report__controls" aria-label="Grain">
          <button
            type="button"
            className={`talia-btn ${grain === PRESSURE_GRAINS.SHIP ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
            aria-pressed={grain === PRESSURE_GRAINS.SHIP}
            onClick={() => onGrainChange?.(PRESSURE_GRAINS.SHIP)}
          >
            Ship
          </button>
          <button
            type="button"
            className={`talia-btn ${grain === PRESSURE_GRAINS.VOYAGE ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
            aria-pressed={grain === PRESSURE_GRAINS.VOYAGE}
            onClick={() => onGrainChange?.(PRESSURE_GRAINS.VOYAGE)}
          >
            Voyage
          </button>
          <button
            type="button"
            className={`talia-btn ${grain === PRESSURE_GRAINS.CABIN ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
            aria-pressed={grain === PRESSURE_GRAINS.CABIN}
            onClick={() => onGrainChange?.(PRESSURE_GRAINS.CABIN)}
          >
            Cabin cat
          </button>
          <label className="sdp-ship-control sdp-cat-control">
            <span className="sdp-ship-control__label">Cat</span>
            <select
              className="talia-report-filters__input sdp-ship-control__select"
              value={cabinCategoryModeOverride == null ? FOLLOW_GLOBAL_CAT : cabinCategoryMode}
              onChange={(event) => {
                const next = event.target.value;
                if (next === FOLLOW_GLOBAL_CAT) {
                  onCabinCategoryModeChange?.(null);
                  return;
                }
                onCabinCategoryModeChange?.(next);
              }}
              aria-label="Cabin category grouping"
              title={cabinCategoryModeOverride == null
                ? `Following StatusBar (${globalCabinCategoryMode === CABIN_CATEGORY_MODE.GROUP ? 'Group' : 'Real'})`
                : 'Local override — does not change StatusBar'}
            >
              <option value={FOLLOW_GLOBAL_CAT}>
                {`Follow global (${globalCabinCategoryMode === CABIN_CATEGORY_MODE.GROUP ? 'Group' : 'Real'})`}
              </option>
              {CABIN_CATEGORY_MODE_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <ReportSnapshot title="Flags in window" items={snapshotItems} visible={showSnapshot} />

      <main className="talia-report__content talia-report__content--scroll">
        {showLegends ? (
          <div className="talia-chart-legend sdp-legend" aria-label="Pressure legend">
            {fitGroupSplit ? (
              <>
                <span className="sdp-legend__item">
                  <i className="sdp-legend__swatch sdp-legend__swatch--fit" aria-hidden="true" />
                  Booked FIT
                </span>
                <span className="sdp-legend__item">
                  <i className="sdp-legend__swatch sdp-legend__swatch--group" aria-hidden="true" />
                  Booked group
                </span>
              </>
            ) : (
              <>
                <span className="sdp-legend__item">
                  <i className="sdp-legend__swatch sdp-legend__swatch--master" aria-hidden="true" />
                  Booked master
                </span>
                <span className="sdp-legend__item">
                  <i className="sdp-legend__swatch sdp-legend__swatch--segment" aria-hidden="true" />
                  Booked segment
                </span>
              </>
            )}
            <span className="sdp-legend__item">
              <i className="sdp-legend__swatch sdp-legend__swatch--est" aria-hidden="true" />
              Expected
            </span>
            <span className="sdp-legend__item">
              <i className="sdp-legend__swatch sdp-legend__swatch--blocking" aria-hidden="true" />
              Blocking
            </span>
            <span className="sdp-legend__item">
              <i className="sdp-legend__swatch sdp-legend__swatch--over" aria-hidden="true" />
              Over
            </span>
            <span className="sdp-legend__item">
              <i className="sdp-legend__swatch sdp-legend__swatch--soft" aria-hidden="true" />
              Soft group
            </span>
            <span className="sdp-legend__item">
              <i className="sdp-legend__swatch sdp-legend__swatch--under" aria-hidden="true" />
              Under
            </span>
          </div>
        ) : null}
        <div ref={tableRef} className="sdp-table-host talia-table" />
        <ReportDataDetails visible={showDetails} className="sdp-notes">
          <p>
            Booked / expected / contracted come from <code>sail_booking_summary</code> and are copied onto every occupancy date of that sail
            (days before and after this cell). Physical sellable cabins match MSE: nameplate minus offsale / reserved, using MAX on the ship-day so master and segment berths are not double-counted.
            Voyage view adds a frozen Day column for the combined ship-day; bar fill splits booked master vs segment under the same voyage identity.
            Cabin-category loading comes from <code>sail_by_cabin_occupancy</code> and is what flags blocking when a category is full on a day a longer voyage still needs.
            Category identity follows StatusBar Cat (Real vs Group via <code>cabin_ctg</code>); this panel can override locally without changing the global criteria.
          </p>
          <p>
            Next: competitor status and promotions in the same cell.
          </p>
        </ReportDataDetails>
      </main>

      <HoverPreview
        open={Boolean(showTooltip && hoverCell)}
        anchorRect={hover?.rect || null}
        containRef={tableRef}
        placement="right"
        onRequestClose={() => setHover(null)}
      >
        {hoverCell ? (
          <div className="sdp-hover">
            <div className="sdp-hover__kicker">{flagLabel(hoverCell.flag)}</div>
            <div className="sdp-hover__title">
              {hoverCell.ship_name || hoverCell.ship_code}
              {hoverCell.cabin_category ? ` · ${hoverCell.cabin_category}` : ''}
              {hoverCell.column_id && hoverCell.grain === 'voyage' ? ` · ${hoverCell.column_id}` : ''}
              {' · '}
              {hoverCell.date}
            </div>
            <div
              className="sdp-hover__preview"
              aria-hidden="true"
              dangerouslySetInnerHTML={{
                __html: renderCellHtml(hoverCell, demandUnit, barSplit),
              }}
            />
            <dl className="sdp-hover__metrics">
              <div><dt>Sellable</dt><dd>{fmt(hoverCell.grain === 'cabin' ? hoverCell.sellable_cabins : cellSellable(hoverCell, demandUnit))} {hoverCell.grain === 'cabin' ? 'cabins' : noun}</dd></div>
              {hoverCell.grain === 'cabin' ? (
                <>
                  <div><dt>Occupied</dt><dd>{fmt(hoverCell.occupied_cabins)}</dd></div>
                  <div><dt>Remaining</dt><dd>{fmt(hoverCell.remaining_cabins)}</dd></div>
                </>
              ) : (
                <>
                  <div><dt>Nameplate</dt><dd>{fmt(isCabinsUnit(demandUnit) ? hoverCell.nameplate_cabins : hoverCell.nameplate)}</dd></div>
                  <div><dt>Offsale</dt><dd>{fmt(isCabinsUnit(demandUnit) ? hoverCell.offsale_cabins : hoverCell.offsale_berths)}</dd></div>
                  <div><dt>Occupied</dt><dd>{fmt(cellOccupiedDisplay(hoverCell, demandUnit))}</dd></div>
                  <div><dt>Booked</dt><dd>{fmt(toDemandVolume(hoverCell.booked, demandUnit))}</dd></div>
                  {fitGroupSplit ? (
                    <>
                      <div><dt>FIT</dt><dd>{fmt(toDemandVolume(hoverCell.booked_fit, demandUnit))}</dd></div>
                      <div><dt>Group</dt><dd>{fmt(toDemandVolume(hoverCell.booked_group, demandUnit))}</dd></div>
                    </>
                  ) : (
                    <>
                      <div><dt>Master</dt><dd>{fmt(toDemandVolume(hoverCell.booked_master, demandUnit))}</dd></div>
                      <div><dt>Segment</dt><dd>{fmt(toDemandVolume(hoverCell.booked_segment, demandUnit))}</dd></div>
                    </>
                  )}
                  <div><dt>Expected</dt><dd>{fmt(toDemandVolume(hoverCell.estimated, demandUnit), 1)}</dd></div>
                  <div><dt>Contracted</dt><dd>{fmt(toDemandVolume(hoverCell.contracted, demandUnit))}</dd></div>
                </>
              )}
            </dl>
            {(hoverCell.blocking_categories || []).length ? (
              <p className="sdp-hover__cats">
                Blocking cats: {(hoverCell.blocking_categories || []).map((item) => (
                  `${item.category} ${Math.round((item.occ_pct || 0) * 100)}%`
                )).join(' · ')}
              </p>
            ) : null}
            <ul className="sdp-hover__why">
              {(hoverCell.reasons || []).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            {(hoverCell.by_sail || []).length ? (
              <p className="sdp-hover__sails">
                Sails: {(hoverCell.by_sail || []).map((part) => part.sail_code).join(', ')}
              </p>
            ) : null}
          </div>
        ) : null}
      </HoverPreview>
    </div>
  );
};

export default ShipDayPressurePresenter;
