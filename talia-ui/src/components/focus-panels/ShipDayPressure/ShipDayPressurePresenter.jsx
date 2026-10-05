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
  filterPressureRowsForScope,
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
const ROW_SCOPE_DEF = {
  id: 'rowScope',
  default: 'narrow',
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
  if (col.kind === 'voyage' || col.kind === 'package' || col.kind === 'duration') {
    if (col.kind === 'voyage' && selectedSailCodes?.has?.(col.id)) return true;
    if (col.kind === 'package' && selectedSailCodes?.has?.(col.package_key)) return true;
    if (col.kind === 'duration' && col.nights && selectedSailCodes?.size) {
      return (col.sail_codes || []).some((code) => selectedSailCodes?.has?.(String(code)));
    }
    return (col.sail_codes || []).some((code) => selectedSailCodes?.has?.(String(code)))
      || (col.reference_sail_codes || []).some((code) => selectedSailCodes?.has?.(String(code)));
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

const fmtMoney = (value, digits = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
};

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const normalizePromoGroupLabel = (promo) => {
  const type = String(promo?.type || '').trim();
  if (type) return type;
  const name = String(promo?.name || '');
  const match = name.match(/^(PUBLISHED|CLOSED|EARLY|SPECIAL|GROUP)/i);
  if (match) return match[1].toUpperCase();
  return 'Rates';
};

const formatPromoItemLabel = (promo, groupLabel) => {
  let name = String(promo?.name || '').trim();
  const group = String(groupLabel || '').trim();
  if (group && name.toUpperCase().startsWith(group.toUpperCase())) {
    name = name.slice(group.length).trim().replace(/^[,:\-\s]+/, '');
  }
  return name || String(promo?.name || '—');
};

const groupPromosForDisplay = (promos = []) => {
  const byGroup = new Map();
  (promos || []).forEach((promo) => {
    const label = normalizePromoGroupLabel(promo);
    const list = byGroup.get(label) || [];
    list.push(promo);
    byGroup.set(label, list);
  });
  return [...byGroup.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, items]) => ({
      label,
      items: [...items].sort((a, b) => String(a.name).localeCompare(String(b.name))),
    }));
};

const MarketHoverContent = ({ cell, fmtMoney }) => {
  const promoGroups = groupPromosForDisplay(cell?.promos);
  const pricing = cell?.pricing;
  const benchmark = cell?.benchmark;
  const promoTotal = (cell?.promos || []).length;

  return (
    <div className="sdp-market-hover">
      {promoGroups.length ? (
        <section className="sdp-market-hover__section sdp-market-hover__section--promo">
          <header className="sdp-market-hover__section-head">
            <span className="sdp-market-hover__section-title">Promotions</span>
            <span className="sdp-market-hover__section-meta">{promoTotal}</span>
          </header>
          {promoGroups.map((group) => {
            const visible = group.items.slice(0, 6);
            const extra = Math.max(0, group.items.length - visible.length);
            return (
              <div key={group.label} className="sdp-market-hover__group">
                <div className="sdp-market-hover__group-label">{group.label}</div>
                <ul className="sdp-market-hover__list">
                  {visible.map((promo) => (
                    <li key={promo.name} className="sdp-market-hover__row">
                      <span className="sdp-market-hover__name">
                        {formatPromoItemLabel(promo, group.label)}
                      </span>
                      {promo.min_fare != null ? (
                        <span className="sdp-market-hover__fare">€{fmtMoney(promo.min_fare)}</span>
                      ) : (
                        <span className="sdp-market-hover__fare sdp-market-hover__fare--muted">—</span>
                      )}
                    </li>
                  ))}
                </ul>
                {extra ? (
                  <div className="sdp-market-hover__more">+{extra} more in {group.label}</div>
                ) : null}
              </div>
            );
          })}
        </section>
      ) : null}

      {(pricing?.peer_count || benchmark?.peer_count) ? (
        <section className="sdp-market-hover__section sdp-market-hover__section--competitor">
          <header className="sdp-market-hover__section-head">
            <span className="sdp-market-hover__section-title">Competitor pressure</span>
          </header>
          {pricing?.peer_count ? (
            <div className="sdp-market-hover__competitor sdp-market-hover__competitor--pricing">
              <div className="sdp-market-hover__competitor-head">
                <span className="sdp-market-hover__competitor-source">Pricing (stg)</span>
                <span className="sdp-market-hover__competitor-stat">
                  {pricing.peer_count} peer{pricing.peer_count === 1 ? '' : 's'}
                  {pricing.min_price != null ? ` · from €${fmtMoney(pricing.min_price)}` : ''}
                </span>
              </div>
              {pricing.lines?.length ? (
                <ul className="sdp-market-hover__peer-list">
                  {pricing.lines.slice(0, 6).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {benchmark?.peer_count ? (
            <div className="sdp-market-hover__competitor sdp-market-hover__competitor--bench">
              <div className="sdp-market-hover__competitor-head">
                <span className="sdp-market-hover__competitor-source">Benchmark (RateGain)</span>
                <span className="sdp-market-hover__competitor-stat">
                  {benchmark.peer_count} peer{benchmark.peer_count === 1 ? '' : 's'}
                  {benchmark.min_pppd != null ? ` · from €${fmtMoney(benchmark.min_pppd)}/d` : ''}
                  {benchmark.min_total != null ? ` · €${fmtMoney(benchmark.min_total)} total` : ''}
                </span>
              </div>
              {benchmark.lines?.length ? (
                <ul className="sdp-market-hover__peer-list">
                  {benchmark.lines.slice(0, 8).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
};

const renderMarketCellHtml = (cell) => {
  if (!cell) return '<span class="sdp-cell sdp-cell--empty"></span>';
  const lane = cell.market_lane || 'all';
  const parts = [];
  if ((lane === 'all' || lane === 'promo') && cell.has_promo) {
    const primary = cell.promos?.[0];
    const extra = Math.max(0, (cell.promos?.length || 0) - 1);
    const label = primary
      ? `${escapeHtml(formatPromoItemLabel(primary, normalizePromoGroupLabel(primary)))}${extra ? ` +${extra}` : ''}`
      : 'Promo';
    parts.push(`<span class="sdp-market__chip sdp-market__chip--promo">${label}</span>`);
  }
  if ((lane === 'all' || lane === 'pricing') && cell.has_pricing) {
    const min = fmtMoney(cell.pricing?.min_price);
    const label = `P·${cell.pricing?.peer_count || 0}${min != null ? ` €${min}` : ''}`;
    parts.push(`<span class="sdp-market__chip sdp-market__chip--pricing">${label}</span>`);
  }
  if ((lane === 'all' || lane === 'benchmark') && cell.has_benchmark) {
    const min = fmtMoney(cell.benchmark?.min_pppd, 0);
    const label = `B·${cell.benchmark?.peer_count || 0}${min != null ? ` €${min}/d` : ''}`;
    parts.push(`<span class="sdp-market__chip sdp-market__chip--bench">${label}</span>`);
  }
  if (!parts.length) return '<span class="sdp-cell sdp-cell--empty"></span>';
  return `<div class="sdp-cell sdp-cell--market"><div class="sdp-market">${parts.join('')}</div></div>`;
};

const renderBlockCellHtml = (cell) => {
  if (!cell) return '<span class="sdp-cell sdp-cell--empty"></span>';
  const blocked = Number(cell.blocked_cabins) || 0;
  if (!blocked) return '<span class="sdp-cell sdp-cell--empty"></span>';
  const cap = Number(cell.nameplate_cabins) || Number(cell.sellable_cabins) || 0;
  const blockPct = cap ? Math.max(4, Math.min(100, (blocked / cap) * 100)) : 12;
  const title = `${blocked} offsale / reserved${cell.reserved_cabins ? ` (${cell.reserved_cabins} reserve)` : ''}`;
  return (
    `<div class="sdp-cell sdp-cell--blocking sdp-block-cell" data-flag="blocking" title="${escapeHtml(title)}">`
    + `<span class="sdp-block-cell__count">${blocked}</span>`
    + `<div class="sdp-cell__track" aria-hidden="true">`
    + `<span class="sdp-cell__booked sdp-cell__booked--block" style="width:${blockPct}%"></span>`
    + `</div></div>`
  );
};

const renderCabinPressureCellHtml = (cell) => {
  if (!cell) return '<span class="sdp-cell sdp-cell--empty"></span>';
  const occ = Math.round((Number(cell.max_occ_pct) || 0) * 100);
  const cat = cell.tightest_category ? String(cell.tightest_category) : '';
  const label = cat ? `${cat} ${occ}%` : `${occ}%`;
  const flag = cell.flag || PRESSURE_FLAGS.OK;
  const title = (cell.reasons || []).join(' · ') || label;
  return (
    `<div class="sdp-cell sdp-cell--${flag} sdp-cabin-pressure-cell" data-flag="${flag}" title="${escapeHtml(title)}">`
    + `<span class="sdp-cabin-pressure__label">${escapeHtml(label)}</span></div>`
  );
};

const renderCellHtml = (cell, demandUnit, barSplit = DEFAULT_BAR_SPLIT) => {
  if (!cell) return '<span class="sdp-cell sdp-cell--empty"></span>';
  if (cell.grain === 'market') return renderMarketCellHtml(cell);
  if (cell.grain === 'block') return renderBlockCellHtml(cell);
  if (cell.grain === 'cabin_pressure') return renderCabinPressureCellHtml(cell);
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
  onResetDates,
  datesFollowGlobal = true,
  criteriaSummary = '',
  marketWarning = null,
  impactWarning = null,
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
  const rowScope = resolveViewValue(viewsState, ROW_SCOPE_DEF) === 'wide' ? 'wide' : 'narrow';
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
  const selectionBand = useMemo(() => {
    const sailing = bundle?.meta?.selectedVoyage;
    if (!sailing?.date_from && !sailing?.date_to) {
      return { focusDate: selectedDate || null, impactFrom: null, impactTo: null };
    }
    const voyageForBand = {
      id: sailing.reference_sail_code,
      date_from: sailing.date_from,
      date_to: sailing.date_to,
    };
    const band = resolveSelectionRowBand({
      voyageCol: voyageForBand,
      impactFrom: voyageForBand.date_from,
      impactTo: voyageForBand.date_to,
    });
    if (selectedDate) band.focusDate = selectedDate;
    return band;
  }, [bundle?.meta?.selectedVoyage, selectedDate]);
  const visibleRows = useMemo(
    () => filterPressureRowsForScope(rows, selectionBand, rowScope),
    [rows, selectionBand, rowScope]
  );
  const visibleRowsRef = useRef(visibleRows);
  visibleRowsRef.current = visibleRows;
  const selectionBandRef = useRef(selectionBand);
  selectionBandRef.current = selectionBand;
  const truncatedVoyages = grain === PRESSURE_GRAINS.VOYAGE && columns.filter((col) => col.kind === 'voyage').length >= 48;
  const truncatedPackages = grain === PRESSURE_GRAINS.PACKAGE && columns.filter((col) => col.kind === 'package').length >= 48;
  const frozenImpactCols = grain === PRESSURE_GRAINS.IMPACT
    ? columns.filter((col) => ['block', 'day', 'cabin_pressure', 'market'].includes(col.kind)).length
    : 0;
  const columnLayoutKey = useMemo(
    () => `${grain}|${columns.map((col) => col.id).join('\0')}`,
    [grain, columns],
  );
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
      (col.kind === 'voyage' || col.kind === 'package' || col.kind === 'duration')
      && columnMatchesSelection(col, ship, sailCodes)
    ));
    const meta = bundle?.meta || {};
    // Same sailing occupancy in every grain — not the package/duration column span.
    const sailing = meta.selectedVoyage;
    const voyageForBand = (sailing?.date_from || sailing?.date_to)
      ? {
        id: sailing.reference_sail_code,
        date_from: sailing.date_from,
        date_to: sailing.date_to,
      }
      : voyageCol;
    const band = { ...resolveSelectionRowBand({
      voyageCol: voyageForBand,
      impactFrom: voyageForBand?.date_from,
      impactTo: voyageForBand?.date_to,
      rows: sailing ? [] : rowsRef.current,
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
    if (focusDate) {
      window.setTimeout(() => scrollToFocusDate(instanceRef.current, focusDate), 80);
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

      const layoutColumns = columnsRef.current || [];
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

      const pressureCols = layoutColumns.map((col) => ({
        title: col.label,
        field: col.id,
        frozen: col.kind === 'day' || col.kind === 'block' || col.kind === 'cabin_pressure'
          || (grain === PRESSURE_GRAINS.IMPACT && col.kind === 'market'),
        ...(col.kind === 'day' || col.kind === 'block' ? { width: col.kind === 'block' ? 52 : 72 } : {}),
        ...(col.kind === 'cabin_pressure' ? { width: 72 } : {}),
        minWidth: col.kind === 'day' ? 72 : (col.kind === 'block' ? 48 : (col.kind === 'cabin_pressure' ? 64 : 64)),
        widthGrow: (col.kind === 'day' || col.kind === 'block' || col.kind === 'cabin_pressure') ? 0 : 1,
        resizable: false,
        headerSort: false,
        headerHozAlign: 'center',
        hozAlign: 'center',
        headerTooltip: (col.kind === 'voyage' || col.kind === 'package' || col.kind === 'duration')
          ? (col.title_full || col.id)
          : (col.title_full || col.label || col.id),
        cssClass: [
          'sdp-graphic-col',
          col.kind === 'day' || col.kind === 'block' || col.kind === 'cabin_pressure' ? '' : 'talia-equal-width-col',
          col.kind === 'day' ? 'sdp-day-col' : '',
          col.kind === 'block' ? 'sdp-block-col' : '',
          col.kind === 'voyage' ? 'sdp-voyage-col' : '',
          col.kind === 'package' ? 'sdp-package-col' : '',
          col.kind === 'duration' ? 'sdp-duration-col' : '',
          col.is_long_duration ? 'sdp-duration-col--long' : '',
          col.kind === 'cabin_pressure' ? 'sdp-cabin-pressure-col' : '',
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
          if (col.kind === 'voyage' || col.kind === 'package' || col.kind === 'duration') {
            const sailCodes = new Set([
              ...(col.kind === 'voyage' ? [String(col.id)] : []),
              ...(col.sail_codes || []).map((code) => String(code)),
              ...(col.reference_sail_codes || []).map((code) => String(code)),
            ].filter(Boolean));
            const emitCode = col.kind === 'voyage'
              ? col.id
              : (col.primary_sail_code || col.primary_reference_sail_code || [...sailCodes][0]);
            const referenceCode = col.kind === 'voyage'
              ? col.id
              : (col.primary_reference_sail_code || emitCode);
            selectedSailCodesRef.current = sailCodes;
            selectedShipRef.current = col.ship_code || null;
            selectedDateRef.current = null;
            setSelectedDate(null);
            applySelectionChrome({ scroll: true });
            emitSailSelect({
              sail_code: emitCode,
              reference_sail_code: referenceCode,
              ship_code: col.ship_code,
              ship_name: col.ship_name,
              selection_origin: 'ship-day-pressure',
              row_data: {
                sail_code: emitCode,
                reference_sail_code: referenceCode,
                ship_code: col.ship_code,
                ship_name: col.ship_name,
                package_type: col.package_type,
                package_key: col.package_key,
                port_from: col.port_from,
                port_to: col.port_to,
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
        freezeLeadingColumns: grain === PRESSURE_GRAINS.IMPACT
          ? 1 + frozenImpactCols
          : (grain === PRESSURE_GRAINS.VOYAGE || grain === PRESSURE_GRAINS.PACKAGE) ? 2 : 1,
        // Keep explicit frozen widths; global stretch layout fights horizontal freeze.
        enforceGlobalLayout: false,
        layout: 'fitData',
        data: [],
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
      try { instanceRef.current?.destroy?.(); } catch { /* noop */ }
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
        if (col.kind === 'voyage' || col.kind === 'package' || col.kind === 'duration') {
          const cellValue = cell.getValue?.() || null;
          const part = cellValue?.by_sail?.[0] || null;
          const sailCodes = new Set([
            ...(col.kind === 'voyage' ? [String(col.id)] : []),
            ...(col.sail_codes || []).map((code) => String(code)),
            ...(col.reference_sail_codes || []).map((code) => String(code)),
            part?.sail_code,
            part?.reference_sail_code,
          ].filter(Boolean).map(String));
          const emitCode = col.kind === 'voyage'
            ? col.id
            : (part?.sail_code || col.primary_sail_code || col.primary_reference_sail_code || [...sailCodes][0]);
          const referenceCode = col.kind === 'voyage'
            ? col.id
            : (part?.reference_sail_code || col.primary_reference_sail_code || emitCode);
          selectedSailCodesRef.current = sailCodes;
          selectedShipRef.current = col.ship_code || null;
          selectedDateRef.current = rowDate || null;
          setSelectedDate(rowDate || null);
          applySelectionChrome({ scroll: true });
          emitSailSelect({
            sail_code: emitCode,
            reference_sail_code: referenceCode,
            ship_code: col.ship_code,
            ship_name: col.ship_name,
            selection_origin: 'ship-day-pressure',
            row_data: {
              sail_code: emitCode,
              reference_sail_code: referenceCode,
              ship_code: col.ship_code,
              ship_name: col.ship_name,
              date: rowDate,
              package_type: col.package_type,
              package_key: col.package_key,
              port_from: col.port_from,
              port_to: col.port_to,
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
        const refresh = instanceRef.current?.replaceData?.(visibleRowsRef.current || []);
        const after = () => applySelectionChrome({ scroll: false });
        if (refresh?.then) refresh.then(after).catch(after);
        else window.requestAnimationFrame(after);
      });
    };

    mount();
    return () => {
      cancelled = true;
      try { instanceRef.current?.destroy?.(); } catch { /* noop */ }
      instanceRef.current = null;
      builtRef.current = false;
    };
  }, [columnLayoutKey, frozenImpactCols, grain, panelComponentId, panelInstanceId, applySelectionChrome, applyRowBandClasses]);

  useEffect(() => {
    if (!instanceRef.current || !builtRef.current) return;
    if (!rows.length && !visibleRows.length) return;
    try {
      const refresh = instanceRef.current.replaceData(visibleRows);
      const after = () => applySelectionChrome({ scroll: false });
      if (refresh?.then) refresh.then(after).catch(after);
      else window.requestAnimationFrame(after);
    } catch {
      // noop
    }
  }, [visibleRows, rows.length, applySelectionChrome]);

  useEffect(() => {
    if (!instanceRef.current || !builtRef.current) return;
    try {
      instanceRef.current.redraw?.(true);
    } catch {
      // noop
    }
  }, [barSplit]);

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
        {criteriaSummary ? (
          <div className="talia-report-filters__group sdp-criteria-chip" title="StatusBar DATE ∩ MONTH — local From/To only narrow this window">
            <span className="talia-report-filters__label">Global</span>
            <span className="sdp-criteria-chip__value">{criteriaSummary}</span>
          </div>
        ) : null}
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">From</span>
          <input
            type="date"
            className="talia-report-filters__input"
            value={dateFrom || ''}
            onChange={(event) => onDateFromChange?.(event.target.value)}
            title={datesFollowGlobal ? 'Following global criteria — edit to narrow locally' : 'Local narrow within global criteria'}
          />
        </label>
        <label className="talia-report-filters__group">
          <span className="talia-report-filters__label">To</span>
          <input
            type="date"
            className="talia-report-filters__input"
            value={dateTo || ''}
            onChange={(event) => onDateToChange?.(event.target.value)}
            title={datesFollowGlobal ? 'Following global criteria — edit to narrow locally' : 'Local narrow within global criteria'}
          />
        </label>
        {!datesFollowGlobal ? (
          <button
            type="button"
            className="talia-btn talia-btn--secondary"
            onClick={() => onResetDates?.()}
            title="Clear local From/To and follow StatusBar DATE + MONTH"
          >
            Reset to global
          </button>
        ) : null}
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
        {truncatedPackages ? ' Package view shows overlapping port-to-port products in this date window (capped).' : ''}
        {grain === PRESSURE_GRAINS.MARKET
          ? ' Market view: promotions on departure days, plus competitor peers from Pricing (stg) and Benchmark (RateGain). Prefer a single ship for split Promo / Pricing / Benchmark columns.'
          : ''}
        {grain === PRESSURE_GRAINS.IMPACT
          ? ' Impact view: Block column shows offsale / reserved cabins; duration columns bucket demand by nights (long holds ≥14N highlighted); Cabin + Market strips appear when a single ship is selected. Use this to see how low-probability long groups (e.g. 22N) occupy ship-days that shorter FIT products need.'
          : ''}
        {marketWarning ? ` Market data warning: ${marketWarning}` : ''}
        {impactWarning ? ` Reserve data warning: ${impactWarning}` : ''}
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
            className={`talia-btn ${grain === PRESSURE_GRAINS.PACKAGE ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
            aria-pressed={grain === PRESSURE_GRAINS.PACKAGE}
            onClick={() => onGrainChange?.(PRESSURE_GRAINS.PACKAGE)}
            title="Segments by package_type / port→port — where beds are blocked"
          >
            Package
          </button>
          <button
            type="button"
            className={`talia-btn ${grain === PRESSURE_GRAINS.MARKET ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
            aria-pressed={grain === PRESSURE_GRAINS.MARKET}
            onClick={() => onGrainChange?.(PRESSURE_GRAINS.MARKET)}
            title="Promotions + competitor peers from Pricing (stg) and Benchmark (RateGain)"
          >
            Market
          </button>
          <button
            type="button"
            className={`talia-btn ${grain === PRESSURE_GRAINS.IMPACT ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
            aria-pressed={grain === PRESSURE_GRAINS.IMPACT}
            onClick={() => onGrainChange?.(PRESSURE_GRAINS.IMPACT)}
            title="Block + duration + cabin + market pressure across the date horizon"
          >
            Impact
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
            {grain === PRESSURE_GRAINS.MARKET ? (
              <>
                <span className="sdp-legend__item">
                  <i className="sdp-legend__swatch sdp-legend__swatch--promo" aria-hidden="true" />
                  Promo
                </span>
                <span className="sdp-legend__item">
                  <i className="sdp-legend__swatch sdp-legend__swatch--pricing" aria-hidden="true" />
                  Pricing (stg)
                </span>
                <span className="sdp-legend__item">
                  <i className="sdp-legend__swatch sdp-legend__swatch--bench" aria-hidden="true" />
                  Benchmark (RateGain)
                </span>
              </>
            ) : fitGroupSplit ? (
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
            {grain === PRESSURE_GRAINS.IMPACT ? (
              <>
                <span className="sdp-legend__item">
                  <i className="sdp-legend__swatch sdp-legend__swatch--block" aria-hidden="true" />
                  Block / reserved
                </span>
                <span className="sdp-legend__item">
                  <i className="sdp-legend__swatch sdp-legend__swatch--long-duration" aria-hidden="true" />
                  Long duration (≥14N)
                </span>
              </>
            ) : null}
            {grain !== PRESSURE_GRAINS.MARKET ? (
              <>
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
              </>
            ) : null}
          </div>
        ) : null}
        <div ref={tableRef} className="sdp-table-host talia-table" />
        <ReportDataDetails visible={showDetails} className="sdp-notes">
          <p>
            Booked / expected / contracted come from <code>sail_booking_summary</code> and are copied onto every occupancy date of that sail
            (days before and after this cell). Physical sellable cabins match MSE: nameplate minus offsale / reserved, using MAX on the ship-day so master and segment berths are not double-counted.
            Voyage view adds a frozen Day column for the combined ship-day; bar fill splits booked master vs segment under the same voyage identity.
            Package view columns are port→port products (<code>package_type</code>) so short segments that block beds are visible without treating sail code as the product.
            Market view overlays published-rate <code>promo_name</code> on departure days, plus peer competitors from both feeds — Competitor Pricing (<code>competitor_current_state</code> / stg) and Competitor Benchmark (<code>competitor_benchmark</code> / RateGain). Own-line (Celestyal) peers are excluded. With a single ship selected, columns split Promo / Pricing / Benchmark.
            Impact view adds a Block column (offsale / <code>ship_cabin_reserve</code>), duration buckets (e.g. 22N) to surface long low-probability group holds, plus Cabin (tightest category loading) and Market strips when one ship is selected.
            Cabin-category loading comes from <code>sail_by_cabin_occupancy</code> and is what flags blocking when a category is full on a day a longer voyage still needs.
            Category identity follows StatusBar Cat (Real vs Group via <code>cabin_ctg</code>); this panel can override locally without changing the global criteria.
            Views → Rows: Narrow (default) keeps only the highlighted dates of the sailing selected in Explorer — the same dates in Ship, Voyage, Package, Market, Impact, and Cabin cat. Wide shows the full criteria window.
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
          <div className={`sdp-hover${hoverCell.grain === 'market' ? ' sdp-hover--market' : ''}`}>
            <div className="sdp-hover__kicker">
              {hoverCell.grain === 'market'
                ? 'Market'
                : hoverCell.grain === 'block'
                  ? 'Block / reserved'
                  : hoverCell.grain === 'cabin_pressure'
                    ? 'Cabin pressure'
                    : hoverCell.grain === 'duration'
                      ? `${hoverCell.duration_nights || hoverCell.nights || ''}N duration`
                      : flagLabel(hoverCell.flag)}
            </div>
            <div className="sdp-hover__title">
              {hoverCell.ship_name || hoverCell.ship_code}
              {hoverCell.cabin_category ? ` · ${hoverCell.cabin_category}` : ''}
              {hoverCell.tightest_category ? ` · ${hoverCell.tightest_category}` : ''}
              {hoverCell.column_id && (hoverCell.grain === 'voyage' || hoverCell.grain === 'package')
                ? ` · ${hoverCell.grain === 'package'
                  ? `${hoverCell.port_from || '?'}→${hoverCell.port_to || '?'} (${hoverCell.package_key || hoverCell.column_id})`
                  : hoverCell.column_id}`
                : ''}
              {hoverCell.grain === 'duration' && hoverCell.duration_nights
                ? ` · ${hoverCell.duration_nights}N`
                : ''}
              {' · '}
              {hoverCell.date}
            </div>
            <div
              className={`sdp-hover__preview${hoverCell.grain === 'market' ? ' sdp-hover__preview--market' : ''}`}
              aria-hidden="true"
              dangerouslySetInnerHTML={{
                __html: renderCellHtml(hoverCell, demandUnit, barSplit),
              }}
            />
            {hoverCell.grain === 'market' ? (
              <MarketHoverContent cell={hoverCell} fmtMoney={fmtMoney} />
            ) : hoverCell.grain === 'block' ? (
              <dl className="sdp-hover__metrics">
                <div><dt>Blocked</dt><dd>{fmt(hoverCell.blocked_cabins)} cabins</dd></div>
                <div><dt>Reserved</dt><dd>{fmt(hoverCell.reserved_cabins)}</dd></div>
                <div><dt>Nameplate</dt><dd>{fmt(hoverCell.nameplate_cabins)}</dd></div>
                <div><dt>Offsale (capacity)</dt><dd>{fmt(hoverCell.offsale_cabins)}</dd></div>
              </dl>
            ) : hoverCell.grain === 'cabin_pressure' ? (
              <dl className="sdp-hover__metrics">
                <div><dt>Tightest</dt><dd>{hoverCell.tightest_category || '—'}</dd></div>
                <div><dt>Max loading</dt><dd>{Math.round((hoverCell.max_occ_pct || 0) * 100)}%</dd></div>
                <div><dt>Categories ≥85%</dt><dd>{fmt(hoverCell.tight_categories)}</dd></div>
                <div><dt>Categories</dt><dd>{fmt(hoverCell.category_count)}</dd></div>
              </dl>
            ) : (
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
            )}
            {(hoverCell.grain !== 'market' && (hoverCell.blocking_categories || []).length) ? (
              <p className="sdp-hover__cats">
                Blocking cats: {(hoverCell.blocking_categories || []).map((item) => (
                  `${item.category} ${Math.round((item.occ_pct || 0) * 100)}%`
                )).join(' · ')}
              </p>
            ) : null}
            {hoverCell.grain !== 'market' && (hoverCell.reasons || []).length ? (
              <ul className="sdp-hover__why">
                {(hoverCell.reasons || []).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
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
