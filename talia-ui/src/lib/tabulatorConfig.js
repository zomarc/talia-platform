/**
 * Tabulator Configuration
 * 
 * Local installation via npm - tabulator-tables@6.3.1
 * Uses midnight theme as base with custom overrides in tabulator-theme.css
 */

// Import Tabulator from npm package
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { formatDayMon } from './dateFormat';
import { activateDockviewPanelFromHost, wasDockviewPanelJustActivated } from './activateDockviewPanel';
import { normalizeColumnHeaderAlignment } from './tabulatorColumnAlignment';
import { observeTabulatorFieldTerminology, resolveGlobalTabulatorLabel, resolveGlobalTabulatorDisplayKind } from './tabulatorColumnLabelDictionary';
import {
  createNumberDisplayFormatter,
  createNumberDisplayTotalFormatter,
  displayDecimalsForKind,
  isNumberDisplayKind,
} from './numberDisplay';
export {
  withColumnTotal,
  formatColumnTotalInteger,
  formatColumnTotalNumber,
  setTabulatorColumnTotalsVisible,
} from './tabulatorColumnTotals';
import { setTabulatorColumnTotalsVisible as applyColumnTotalsVisible } from './tabulatorColumnTotals';
export {
  formatDisplayNumber,
  formatExactNumber,
  createNumberDisplayFormatter,
  NUMBER_DISPLAY_KINDS,
} from './numberDisplay';
import {
  getComponentOptionsCatalog,
  resolveViewValue,
  VIEW_TOTALS,
} from './componentOptionsCatalog';
import { resolveStoredComponentViews } from './componentOptionsInstance';
import { COMPONENT_OPTIONS_CHANGED_EVENT } from './componentOptionsEvents';
import {
  payloadFromTabulator,
  registerPanelDataExport,
} from './panelDataExport';
import {
  DASHBOARD_DETAILS_VISIBILITY_EVENT,
  DASHBOARD_GLOBAL_CONFIG_EVENT,
  DASHBOARD_TABLE_LAYOUT_EVENT,
  DASHBOARD_TABULATOR_FILTER_VISIBILITY_EVENT,
  REPORT_ACTIVE_PANEL_EVENT,
} from '../components/dockview/eventConstants';

// Import Tabulator midnight theme CSS
import 'tabulator-tables/dist/css/tabulator_midnight.min.css';

const TABLE_LAYOUT_STORAGE_KEY = 'taliaTableLayoutMode';
const TABLE_LAYOUT_BEST = 'best';
const TABLE_LAYOUT_WIDTH = 'width';
const TABLE_LAYOUT_DATA = 'data';
const tableInstances = new Set();
let hasBoundLayoutListener = false;
const tableMeta = new WeakMap();
let wrappedTabulatorClass = null;
const missingTerminologyWarnings = new Set();

const isBrowser = () => typeof window !== 'undefined';

const isTableHostVisible = (table) => {
  const el = table?.element;
  if (!el || typeof el.getBoundingClientRect !== 'function') return false;
  try {
    const rect = el.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  } catch {
    return false;
  }
};

const stripFixedWidths = (columns = []) => {
  if (!Array.isArray(columns)) return columns;
  return columns.map((column) => {
    if (!column || typeof column !== 'object') return column;
    const next = { ...column };
    if (Object.prototype.hasOwnProperty.call(next, 'width')) {
      delete next.width;
    }
    if (Array.isArray(next.columns)) {
      next.columns = stripFixedWidths(next.columns);
    }
    return next;
  });
};

const escapeHtmlAttr = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const isPackageField = (field) => {
  const key = String(field || '').trim().toLowerCase();
  return key === 'package_name' || key === 'package' || key === 'package_name_text' || key === 'package_name_display';
};

const formatCompactPackageCell = (cell) => {
  const value = String(cell?.getValue?.() ?? '').trim();
  if (!value) return '';
  const firstWord = value.split(/\s+/)[0] || value;
  if (firstWord.length === value.length) {
    return `<span title="${escapeHtmlAttr(value)}">${escapeHtmlAttr(value)}</span>`;
  }
  return `<span title="${escapeHtmlAttr(value)}">${escapeHtmlAttr(firstWord)}...</span>`;
};

const applyGlobalCompactFormatters = (columns = []) => {
  if (!Array.isArray(columns)) return columns;
  return columns.map((column) => {
    if (!column || typeof column !== 'object') return column;
    const next = { ...column };

    if (Array.isArray(next.columns)) {
      next.columns = applyGlobalCompactFormatters(next.columns);
    }

    if (isPackageField(next.field)) {
      // Global compact display rule: package values render as first token + ellipsis.
      // Full value remains available through the native tooltip/title attribute.
      next.formatter = formatCompactPackageCell;
    }

    return next;
  });
};

/**
 * Apply semantic number display (money / pct / count / …) from the field dictionary.
 * Exact value stays on hover title. Opt out with displayKind: false.
 * Does not replace an existing cell formatter unless displayKind is set explicitly
 * on the column (so complex HTML formatters stay intact).
 */
const applyGlobalNumberDisplayFormatters = (columns = []) => {
  if (!Array.isArray(columns)) return columns;
  return columns.map((column) => {
    if (!column || typeof column !== 'object') return column;
    const next = { ...column };

    if (Array.isArray(next.columns)) {
      next.columns = applyGlobalNumberDisplayFormatters(next.columns);
    }

    if (isPackageField(next.field)) return next;

    const explicitKind = Object.prototype.hasOwnProperty.call(next, 'displayKind')
      ? next.displayKind
      : undefined;
    delete next.displayKind;

    if (explicitKind === false || explicitKind === null) return next;

    const kind = explicitKind != null && explicitKind !== ''
      ? String(explicitKind).trim().toLowerCase()
      : resolveGlobalTabulatorDisplayKind(next.field);

    if (!isNumberDisplayKind(kind)) return next;

    // Preserve bespoke cell formatters unless the column opted into a display kind.
    if (typeof next.formatter !== 'function' || explicitKind != null) {
      next.formatter = createNumberDisplayFormatter(kind);
      next.hozAlign = next.hozAlign || 'right';
    }

    // Footer totals: match grid display kind (calcs still use full precision).
    if (next.bottomCalc) {
      next.bottomCalcFormatter = createNumberDisplayTotalFormatter(kind);
      next.bottomCalcFormatterParams = { displayKind: kind };
      if (next.bottomCalcParams && typeof next.bottomCalcParams === 'object') {
        next.bottomCalcParams = {
          ...next.bottomCalcParams,
          precision: displayDecimalsForKind(kind),
        };
      } else if (!['count', 'unique'].includes(String(next.bottomCalc))) {
        next.bottomCalcParams = { precision: displayDecimalsForKind(kind) };
      }
    }

    return next;
  });
};

const normalizeColumnTitles = (columns = [], context = {}) => {
  if (!Array.isArray(columns)) return columns;
  return columns.map((column) => {
    if (!column || typeof column !== 'object') return column;
    const next = { ...column };
    const currentTitle = typeof next.title === 'string' ? next.title : '';
    const hasShortTitle = typeof next.titleShort === 'string' && next.titleShort.trim() !== '';
    const hasLongTitle = typeof next.titleLong === 'string' && next.titleLong.trim() !== '';
    const mappedLabel = resolveGlobalTabulatorLabel({
      field: next.field,
      title: currentTitle,
    });
    const mappedShort = mappedLabel?.short || '';
    const mappedLong = mappedLabel?.long || '';
    const shortTitle = hasShortTitle ? next.titleShort.trim() : (mappedShort || '');
    const longTitle = hasLongTitle ? next.titleLong.trim() : (mappedLong || '');
    const fieldKey = typeof next.field === 'string' ? next.field.trim() : '';

    if (fieldKey) {
      observeTabulatorFieldTerminology({
        field: fieldKey,
        title: currentTitle,
        mapped: Boolean(mappedLabel),
        componentId: context?.panelComponentId || '',
      });
      if (import.meta.env.DEV && !mappedLabel && !hasShortTitle && !hasLongTitle && !missingTerminologyWarnings.has(fieldKey)) {
        missingTerminologyWarnings.add(fieldKey);
        console.warn(
          `[Tabulator terminology] Field "${fieldKey}" has no global short/long label mapping. Add it to tabulatorColumnLabelDictionary or set titleShort/titleLong in the column definition.`
        );
      }
    }

    if (shortTitle) {
      next.title = shortTitle;
    }

    if (next.headerTooltip == null || next.headerTooltip === '') {
      if (longTitle) {
        next.headerTooltip = longTitle;
      } else if (shortTitle && currentTitle) {
        next.headerTooltip = currentTitle;
      } else if (currentTitle) {
        // Default generic behavior: every header gets a full-name tooltip.
        next.headerTooltip = currentTitle;
      }
    }

    if (Array.isArray(next.columns)) {
      next.columns = normalizeColumnTitles(next.columns, context);
    }

    delete next.titleShort;
    delete next.titleLong;
    return next;
  });
};

const getGlobalTableLayoutMode = () => {
  if (!isBrowser()) return TABLE_LAYOUT_BEST;
  const inMemory = window.__taliaTableLayoutMode;
  if (inMemory === TABLE_LAYOUT_BEST || inMemory === TABLE_LAYOUT_DATA || inMemory === TABLE_LAYOUT_WIDTH) {
    return inMemory;
  }
  try {
    const saved = window.localStorage?.getItem?.(TABLE_LAYOUT_STORAGE_KEY);
    if (saved === TABLE_LAYOUT_BEST || saved === TABLE_LAYOUT_DATA || saved === TABLE_LAYOUT_WIDTH) {
      return saved;
    }
  } catch {
    // no-op
  }
  return TABLE_LAYOUT_BEST;
};

const setGlobalTableLayoutMode = (mode) => {
  if (!isBrowser()) return;
  const next = mode === TABLE_LAYOUT_DATA
    ? TABLE_LAYOUT_DATA
    : mode === TABLE_LAYOUT_WIDTH
      ? TABLE_LAYOUT_WIDTH
      : TABLE_LAYOUT_BEST;
  window.__taliaTableLayoutMode = next;
  try {
    window.localStorage?.setItem?.(TABLE_LAYOUT_STORAGE_KEY, next);
  } catch {
    // no-op
  }
};

const getTableScrollHolder = (table) => (
  table?.rowManager?.element
  || table?.element?.querySelector?.('.tabulator-tableholder')
  || null
);

const MIN_VISIBLE_HOLDER_HEIGHT = 16;

const restoreTableScrollIfChanged = (holder, top, left) => {
  if (!holder) return;
  if (holder.scrollTop !== top) holder.scrollTop = top;
  if (holder.scrollLeft !== left) holder.scrollLeft = left;
};

const rememberVisibleTableScroll = (table, top, left) => {
  const meta = table ? tableMeta.get(table) : null;
  if (!meta) return;
  meta.lastVisibleScroll = { top, left };
  meta.scrollUntrusted = false;
};

/** Snapshot scroll before replaceData/redraw — Tabulator resets scrollTop synchronously.
 *  Inactive Dockview tabs collapse the holder and zero scrollTop. Keep the last
 *  on-screen position so a later redraw does not pin the viewport at the top. */
export const captureTableScroll = (table) => {
  const holder = getTableScrollHolder(table);
  const top = holder?.scrollTop ?? 0;
  const left = holder?.scrollLeft ?? 0;
  const meta = table ? tableMeta.get(table) : null;
  const usable = Boolean(
    holder
    && holder.clientHeight >= MIN_VISIBLE_HOLDER_HEIGHT
    && isTableHostVisible(table)
  );
  if (!usable) {
    if (meta) meta.scrollUntrusted = true;
    if (meta?.lastVisibleScroll) {
      return {
        holder,
        top: meta.lastVisibleScroll.top,
        left: meta.lastVisibleScroll.left,
      };
    }
    return { holder, top, left };
  }
  const last = meta?.lastVisibleScroll;
  const looksLikeHideReset = Boolean(
    meta?.scrollUntrusted
    && last
    && top === 0
    && left === 0
    && (last.top > 0 || last.left > 0)
  );
  if (looksLikeHideReset) {
    meta.scrollUntrusted = false;
    return { holder, top: last.top, left: last.left };
  }
  rememberVisibleTableScroll(table, top, left);
  return { holder, top, left };
};

const bindVisibleScrollMemory = (table) => {
  if (!table) return;
  const attach = () => {
    const holder = getTableScrollHolder(table);
    const meta = tableMeta.get(table);
    if (!holder || !meta || meta.scrollHolder === holder) return;
    if (meta.scrollHolder && meta.onHolderScroll) {
      meta.scrollHolder.removeEventListener('scroll', meta.onHolderScroll);
    }
    meta.onHolderScroll = () => {
      captureTableScroll(table);
    };
    meta.scrollHolder = holder;
    holder.addEventListener('scroll', meta.onHolderScroll, { passive: true });
    captureTableScroll(table);
  };
  table.on?.('tableBuilt', attach);
  attach();
};

export const restoreTableScroll = (snapshot) => {
  if (!snapshot?.holder) return;
  restoreTableScrollIfChanged(snapshot.holder, snapshot.top, snapshot.left);
};

/** Restore a scroll snapshot now and on the next frame (post-layout). */
export const restoreTableScrollSoon = (snapshot) => {
  restoreTableScroll(snapshot);
  if (typeof window !== 'undefined') {
    window.requestAnimationFrame(() => restoreTableScroll(snapshot));
  }
};

/**
 * Run a table mutation while keeping scroll. Prefer this over replaceData + after*.
 * refreshFn should start replaceData/setData and may return a Promise.
 */
export const runWithPreservedTableScroll = (table, refreshFn) => {
  const snapshot = captureTableScroll(table);
  let result;
  try {
    result = typeof refreshFn === 'function' ? refreshFn() : null;
  } catch (error) {
    restoreTableScrollSoon(snapshot);
    throw error;
  }
  const finish = () => restoreTableScrollSoon(snapshot);
  if (result && typeof result.then === 'function') {
    result.then(finish).catch(finish);
    return result;
  }
  finish();
  return result;
};

/** Fit-data modes only sample visible / 1 rows natively — expand from the first N rows. */
const FIT_DATA_SAMPLE_ROWS = 100;
const FIT_DATA_MAX_COL_WIDTH = 480;
const EQUAL_WIDTH_COLUMN_CLASS = 'talia-equal-width-col';
const EQUAL_WIDTH_COLUMN_MIN = 64;

const columnDefinitionHasClass = (column, className) => {
  const css = column?.definition?.cssClass
    || column?.getDefinition?.()?.cssClass
    || '';
  return String(css).split(/\s+/).includes(className);
};

const columnIsFrozen = (column) => {
  const def = column?.getDefinition?.() || column?.definition || {};
  return def.frozen === true;
};

const countFrozenLeaves = (cols = []) => cols.reduce((sum, col) => {
  if (Array.isArray(col?.columns) && col.columns.length) {
    return sum + countFrozenLeaves(col.columns);
  }
  return sum + (col?.frozen === true ? 1 : 0);
}, 0);

/**
 * Freeze the first N leaf columns (left → right). Explicit `frozen: false` opts out.
 * Applied by default in getTabulatorOptions so tables pin at least the first column.
 */
export const applyFreezeLeadingColumns = (columns = [], count = 1) => {
  const n = Number.parseInt(count, 10);
  if (!Array.isArray(columns) || !Number.isFinite(n) || n <= 0) return columns;
  let remaining = n;
  return columns.map((column) => {
    if (!column || typeof column !== 'object') return column;
    if (Array.isArray(column.columns) && column.columns.length) {
      if (remaining <= 0) return column;
      const before = countFrozenLeaves(column.columns);
      const nested = applyFreezeLeadingColumns(column.columns, remaining);
      const after = countFrozenLeaves(nested);
      remaining = Math.max(0, remaining - Math.max(0, after - before));
      return { ...column, columns: nested };
    }
    if (column.frozen === false) return column;
    if (remaining > 0) {
      remaining -= 1;
      return { ...column, frozen: true };
    }
    return column;
  });
};

const tabulatorColumns = (table) => {
  if (typeof table?.getColumns === 'function') {
    try {
      return table.getColumns() || [];
    } catch {
      return [];
    }
  }
  const byIndex = table?.columnManager?.columnsByIndex;
  return Array.isArray(byIndex) ? byIndex : [];
};

/**
 * Best-fit / width / data: size date & numeric columns to content, then give
 * scrollable `talia-equal-width-col` bars equal width. Frozen equal-width cols
 * keep a stable width and are excluded from the viewport squeeze so wide grids
 * overflow horizontally (required for Tabulator frozen pins).
 */
const equalizeMarkedColumnWidths = (table) => {
  if (!table) return;
  const columns = tabulatorColumns(table).filter((column) => column?.visible !== false);
  const graphic = columns.filter((column) => columnDefinitionHasClass(column, EQUAL_WIDTH_COLUMN_CLASS));
  if (!graphic.length) return;

  const graphicFrozen = graphic.filter(columnIsFrozen);
  const graphicScroll = graphic.filter((column) => !columnIsFrozen(column));
  const others = columns.filter((column) => !graphic.includes(column));

  others.forEach((column) => {
    try {
      column.reinitializeWidth?.(true);
      const width = column.getWidth?.() || 0;
      if (width > FIT_DATA_MAX_COL_WIDTH) column.setWidth?.(FIT_DATA_MAX_COL_WIDTH);
    } catch {
      // noop
    }
  });

  graphicFrozen.forEach((column) => {
    try {
      const width = Math.max(EQUAL_WIDTH_COLUMN_MIN, column.getWidth?.() || EQUAL_WIDTH_COLUMN_MIN);
      column.setWidth?.(width);
    } catch {
      // noop
    }
  });

  if (!graphicScroll.length) return;

  const holderWidth = table.rowManager?.element?.clientWidth
    || table.element?.clientWidth
    || 0;
  const used = [...others, ...graphicFrozen].reduce((sum, column) => sum + (column.getWidth?.() || 0), 0);
  const remaining = Math.max(0, holderWidth - used);
  const fitted = Math.floor(remaining / graphicScroll.length);
  const each = Math.max(EQUAL_WIDTH_COLUMN_MIN, fitted);
  graphicScroll.forEach((column) => {
    try {
      column.setWidth?.(each);
    } catch {
      // noop
    }
  });
};

const isFitDataLayout = (layout) => String(layout || '').startsWith('fitData');

/**
 * Materialize the first N display rows (with nowrap) so Tabulator fitToData
 * sees synthetic badges / long IDs that may not be in the initial viewport sample.
 */
const sampleFitDataColumnWidths = (table, sampleSize = FIT_DATA_SAMPLE_ROWS) => {
  if (!table || !isFitDataLayout(table.options?.layout)) return;

  const displayRows = typeof table.rowManager?.getDisplayRows === 'function'
    ? table.rowManager.getDisplayRows()
    : [];
  const rows = displayRows
    .filter((row) => row && row.type !== 'group')
    .slice(0, sampleSize);
  if (!rows.length) return;

  const tableElement = table.rowManager?.tableElement;
  const host = table.element;
  if (!tableElement || !host) return;

  host.classList.add('tabulator--fit-sampling');
  const staged = [];

  try {
    rows.forEach((row) => {
      try {
        row.generateCells?.();
        const rowEl = row.getElement?.();
        if (!rowEl) return;
        if (rowEl.parentNode) return; // already rendered / measurable in place
        (row.cells || []).forEach((cell) => {
          const cellEl = cell.getElement?.();
          if (cellEl && !cellEl.parentNode) rowEl.appendChild(cellEl);
        });
        tableElement.appendChild(rowEl);
        staged.push(rowEl);
      } catch {
        // ignore individual row measure failures
      }
    });

    const columns = Array.isArray(table.columnManager?.columnsByIndex)
      ? table.columnManager.columnsByIndex
      : [];
    const visible = columns.filter((column) => column?.visible);
    const stretchLast = table.options?.layout === 'fitDataStretch'
      && !columnDefinitionHasClass(visible[visible.length - 1], EQUAL_WIDTH_COLUMN_CLASS)
      ? visible[visible.length - 1]
      : null;

    visible.forEach((column) => {
      if (column === stretchLast) return;
      if (columnDefinitionHasClass(column, EQUAL_WIDTH_COLUMN_CLASS)) return;
      try {
        column.reinitializeWidth?.(true);
        const width = column.getWidth?.() || 0;
        if (width > FIT_DATA_MAX_COL_WIDTH) {
          column.setWidth?.(FIT_DATA_MAX_COL_WIDTH);
        }
      } catch {
        // noop
      }
    });

    if (stretchLast) {
      try {
        const tableWidth = table.rowManager?.element?.clientWidth || 0;
        const colsWidth = visible.reduce((sum, column) => sum + (column.getWidth?.() || 0), 0);
        const gap = tableWidth - colsWidth + (stretchLast.getWidth?.() || 0);
        if (gap > (stretchLast.getWidth?.() || 0)) {
          stretchLast.setWidth?.(gap);
        } else {
          stretchLast.reinitializeWidth?.(true);
        }
      } catch {
        // noop
      }
    }
  } finally {
    staged.forEach((el) => {
      try {
        el.parentNode?.removeChild(el);
      } catch {
        // noop
      }
    });
    host.classList.remove('tabulator--fit-sampling');
  }
};

/** One-pass layout refresh; preserve scroll without a second rAF redraw (that caused pixel bounce). */
const refreshTableLayout = (table) => {
  if (!table) return;
  const snapshot = captureTableScroll(table);
  table.layoutRefresh?.(true);
  sampleFitDataColumnWidths(table);
  equalizeMarkedColumnWidths(table);
  table.redraw?.(true);
  equalizeMarkedColumnWidths(table);
  restoreTableScroll(snapshot);
};

/** Schedule layout refresh after data/visibility changes (safe before tableBuilt). */
export const scheduleTabulatorLayoutRefresh = (table) => {
  if (!table) return;
  const meta = tableMeta.get(table);
  if (meta && meta.isBuilt !== true && table?.initialized !== true) {
    meta.pendingLayoutRefresh = true;
    return;
  }
  // Never measure fit while the host is hidden (inactive Dockview tab).
  if (!isTableHostVisible(table)) {
    if (meta) meta.pendingLayoutRefresh = true;
    return;
  }
  if (meta?.layoutRefreshInFlight) return;
  if (meta) {
    meta.pendingLayoutRefresh = false;
    meta.layoutRefreshInFlight = true;
  }
  try {
    refreshTableLayout(table);
  } finally {
    if (meta) meta.layoutRefreshInFlight = false;
  }
};

const bindTableDataLayoutRefresh = (table) => {
  if (!table || tableMeta.get(table)?.dataLayoutBound) return;
  const meta = tableMeta.get(table) || {};
  meta.dataLayoutBound = true;
  tableMeta.set(table, meta);
  table.on?.('dataProcessed', () => scheduleTabulatorLayoutRefresh(table));
  table.on?.('dataLoaded', () => scheduleTabulatorLayoutRefresh(table));
};

const applyLayoutModeToTable = (table, { force = false } = {}) => {
  if (!table) return;
  if (!force && !isTableHostVisible(table)) {
    const meta = tableMeta.get(table);
    if (meta) meta.pendingLayoutRefresh = true;
    return;
  }
  const mode = getGlobalTableLayoutMode();
  const nextLayout = mode === TABLE_LAYOUT_DATA
    ? 'fitDataTable'
    : mode === TABLE_LAYOUT_WIDTH
      ? 'fitColumns'
      : 'fitDataStretch';
  try {
    const meta = tableMeta.get(table);
    const ready = meta?.isBuilt === true || table?.initialized === true;
    if (meta) {
      meta.lastAppliedMode = mode;
      if (ready) meta.isBuilt = true;
    }
    if (typeof table.setOption === 'function') {
      table.setOption('layout', nextLayout);
    } else if (table.options) {
      table.options.layout = nextLayout;
    }
    if (!ready) {
      return;
    }
    table.modules?.layout?.initialize?.();
    refreshTableLayout(table);
    if (meta) meta.pendingLayoutRefresh = false;
  } catch {
    // no-op
  }
};

/** Re-apply current global fit to every table that is currently visible. */
export const flushVisibleTabulatorLayouts = () => {
  tableInstances.forEach((table) => {
    if (!isTableHostVisible(table)) {
      const meta = tableMeta.get(table);
      if (meta) meta.pendingLayoutRefresh = true;
      return;
    }
    applyLayoutModeToTable(table, { force: true });
  });
};

const catalogHasTotalsView = (componentId) => {
  const key = String(componentId || '');
  if (!key) return false;
  const catalog = getComponentOptionsCatalog(key);
  return (catalog.views || []).some((view) => view?.id === 'totals');
};

const resolveTotalsVisibleForComponent = (componentId, viewsState = null, instanceId = null) => {
  const state = viewsState && typeof viewsState === 'object'
    ? viewsState
    : resolveStoredComponentViews(
      window.__taliaUserProfileState?.componentOptions?.[componentId],
      instanceId
    );
  return resolveViewValue(state, VIEW_TOTALS) !== false;
};

/** Apply Views → Totals. Pass instanceId so only that panel's tables change. */
export const applyTabulatorColumnTotalsForComponent = (componentId, viewsState = null, instanceId = null) => {
  const key = String(componentId || '');
  const panelId = String(instanceId || '');
  if (!key || !catalogHasTotalsView(key)) return;
  tableInstances.forEach((table) => {
    const meta = tableMeta.get(table);
    if (meta?.panelComponentId !== key) return;
    if (panelId && meta?.panelInstanceId && meta.panelInstanceId !== panelId) return;
    const visible = resolveTotalsVisibleForComponent(
      key,
      viewsState,
      panelId || meta?.panelInstanceId || null
    );
    applyColumnTotalsVisible(table, visible);
  });
};

const applyTabulatorColumnTotalsForTable = (table) => {
  if (!table) return;
  const meta = tableMeta.get(table);
  const componentId = meta?.panelComponentId;
  if (!componentId || !catalogHasTotalsView(componentId)) return;
  applyColumnTotalsVisible(
    table,
    resolveTotalsVisibleForComponent(componentId, null, meta?.panelInstanceId || null)
  );
};

const ensureLayoutListenerBound = () => {
  if (!isBrowser() || hasBoundLayoutListener) return;
  hasBoundLayoutListener = true;
  const applyAllVisible = () => flushVisibleTabulatorLayouts();

  window.addEventListener(DASHBOARD_GLOBAL_CONFIG_EVENT, (event) => {
    const detail = event?.detail || {};
    const changedKeys = Array.isArray(detail.changedKeys) ? detail.changedKeys : null;
    // Full publish (boot/enforce) or explicit layout change → re-apply fit.
    // Filters/Details/etc. must not force a full table layout refresh.
    const shouldApplyLayout = !changedKeys
      || changedKeys.length === 0
      || changedKeys.includes('tableLayoutMode');
    if (!shouldApplyLayout) return;
    const mode = detail.tableLayoutMode;
    if (mode) setGlobalTableLayoutMode(mode);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(applyAllVisible);
    });
  });

  window.addEventListener(DASHBOARD_TABLE_LAYOUT_EVENT, (event) => {
    const mode = event?.detail?.mode;
    setGlobalTableLayoutMode(mode);
    applyAllVisible();
  });

  // Re-apply the current global fit when the active dock tab changes.
  // Deferred-only flush missed tables that measured while the host was the
  // wrong size (or never set pendingLayoutRefresh), which left the wrong fit.
  window.addEventListener(REPORT_ACTIVE_PANEL_EVENT, (event) => {
    const activePanelId = event?.detail?.activePanelId
      || window.__taliaActivePanelId
      || null;
    tableInstances.forEach((table) => {
      const meta = tableMeta.get(table);
      if (meta) meta.scrollUntrusted = true;
    });
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        tableInstances.forEach((table) => {
          const meta = tableMeta.get(table);
          const visible = isTableHostVisible(table);
          if (!visible) {
            if (meta) meta.pendingLayoutRefresh = true;
            return;
          }
          const belongsToActivePanel = Boolean(
            activePanelId
            && meta?.panelInstanceId
            && meta.panelInstanceId === activePanelId
          );
          // Prefer the active panel's tables; also flush any deferred refresh and
          // any visible table that never registered a panel id (common today).
          if (
            belongsToActivePanel
            || meta?.pendingLayoutRefresh
            || !meta?.panelInstanceId
          ) {
            applyLayoutModeToTable(table, { force: true });
            if (belongsToActivePanel && meta?.lastVisibleScroll) {
              restoreTableScroll({
                holder: getTableScrollHolder(table),
                top: meta.lastVisibleScroll.top,
                left: meta.lastVisibleScroll.left,
              });
            }
          }
        });
      });
    });
  });

  window.addEventListener(DASHBOARD_TABULATOR_FILTER_VISIBILITY_EVENT, () => {
    window.requestAnimationFrame(() => {
      tableInstances.forEach((table) => scheduleTabulatorLayoutRefresh(table));
    });
  });
  window.addEventListener(DASHBOARD_DETAILS_VISIBILITY_EVENT, () => {
    window.requestAnimationFrame(() => {
      tableInstances.forEach((table) => scheduleTabulatorLayoutRefresh(table));
    });
  });

  // Views → Totals: immediate ColumnCalcs show/hide (no tab switch / CSS gap).
  window.addEventListener(COMPONENT_OPTIONS_CHANGED_EVENT, (event) => {
    const detail = event?.detail || {};
    const componentId = detail.componentId;
    if (!componentId || !catalogHasTotalsView(componentId)) return;
    applyTabulatorColumnTotalsForComponent(componentId, detail.views, detail.instanceId || null);
  });

  window.addEventListener('resize', () => {
    applyAllVisible();
  });
};

const registerTableInstance = (table, baseColumns = null, ids = {}) => {
  if (!table) return;
  if (!tableMeta.has(table)) {
    tableMeta.set(table, {
      baseColumns: Array.isArray(baseColumns) ? [...baseColumns] : null,
      lastAppliedMode: null,
      isBuilt: false,
      pendingLayoutRefresh: false,
      layoutRefreshInFlight: false,
      dataLayoutBound: false,
      lastVisibleScroll: null,
      scrollUntrusted: false,
      scrollHolder: null,
      onHolderScroll: null,
      panelInstanceId: ids.panelInstanceId || null,
      panelComponentId: ids.panelComponentId || null,
      exportTitle: ids.exportTitle || null,
    });
  } else {
    const meta = tableMeta.get(table);
    if (ids.panelInstanceId) meta.panelInstanceId = ids.panelInstanceId;
    if (ids.panelComponentId) meta.panelComponentId = ids.panelComponentId;
    if (ids.exportTitle) meta.exportTitle = ids.exportTitle;
  }
  tableInstances.add(table);
};

const getWrappedTabulatorClass = () => {
  ensureLayoutListenerBound();
  if (wrappedTabulatorClass) return wrappedTabulatorClass;

  class TaliaTabulator extends Tabulator {
    constructor(element, options = {}) {
      const incomingOptions = options && typeof options === 'object' ? options : {};
      const alreadyProcessed = incomingOptions.__taliaProcessedOptions === true;
      const processed = alreadyProcessed
        ? { ...incomingOptions }
        : getTabulatorOptions(incomingOptions);
      const baseColumns = processed.__taliaBaseColumns || incomingOptions.columns || null;
      const panelInstanceId = processed.__taliaPanelInstanceId || null;
      const panelComponentId = processed.__taliaPanelComponentId || null;
      const exportTitle = processed.__taliaExportTitle || null;
      delete processed.__taliaProcessedOptions;
      delete processed.__taliaBaseColumns;
      delete processed.__taliaPanelInstanceId;
      delete processed.__taliaPanelComponentId;
      delete processed.__taliaExportTitle;
      super(element, processed);

      registerTableInstance(this, baseColumns, { panelInstanceId, panelComponentId, exportTitle });
      bindTableDataLayoutRefresh(this);
      bindVisibleScrollMemory(this);
      // Sibling panel reflows often resize the host; Tabulator redraw resets scrollTop.
      if (typeof this.redraw === 'function') {
        const originalRedraw = this.redraw.bind(this);
        this.redraw = (...args) => {
          const snapshot = captureTableScroll(this);
          const result = originalRedraw(...args);
          restoreTableScroll(snapshot);
          return result;
        };
      }
      const meta = tableMeta.get(this);
      if (meta && this.initialized === true) {
        meta.isBuilt = true;
      }
      // Apply layout mode immediately so newly opened reports honor global mode.
      applyLayoutModeToTable(this);

      this.on?.('tableBuilt', () => {
        const currentMeta = tableMeta.get(this);
        if (currentMeta) {
          currentMeta.isBuilt = true;
        }
        applyLayoutModeToTable(this, { force: isTableHostVisible(this) });
        scheduleTabulatorLayoutRefresh(this);
        applyTabulatorColumnTotalsForTable(this);
        const exportMeta = tableMeta.get(this);
        if (exportMeta?.panelComponentId || exportMeta?.panelInstanceId) {
          exportMeta.unregisterExport?.();
          exportMeta.unregisterExport = registerPanelDataExport({
            panelInstanceId: exportMeta.panelInstanceId,
            panelComponentId: exportMeta.panelComponentId,
            getPayload: () => payloadFromTabulator(this, exportMeta.exportTitle || exportMeta.panelComponentId || 'Export'),
          });
        }
      });

      // ReportShell owns the activate+click replay. When this gesture just
      // activated the host, still apply Tabulator row selection so selectable
      // tables highlight on the same click as the synthetic row/cell click.
      this.on?.('rowMouseDown', (_event, row) => {
        const didActivate = activateDockviewPanelFromHost(this.element)
          || wasDockviewPanelJustActivated(this.element);
        if (!didActivate) return;
        try {
          if (this.options?.selectableRows) row.select?.();
        } catch {
          // noop
        }
      });
      this.on?.('groupVisibilityChanged', () => {
        refreshTableLayout(this);
      });
      this.on?.('tableDestroyed', () => {
        const gone = tableMeta.get(this);
        if (gone?.scrollHolder && gone.onHolderScroll) {
          gone.scrollHolder.removeEventListener('scroll', gone.onHolderScroll);
        }
        gone?.unregisterExport?.();
        tableInstances.delete(this);
      });
    }
  }

  wrappedTabulatorClass = TaliaTabulator;
  return wrappedTabulatorClass;
};

/**
 * Initialize Tabulator
 * Returns the Tabulator constructor (already loaded via npm)
 */
export const initTabulator = async () => {
  return getWrappedTabulatorClass();
};

/**
 * Get Tabulator options with defaults
 */
export const getTabulatorOptions = (options = {}) => {
  ensureLayoutListenerBound();

  const rawLayout = options.layout;
  const requestedLayout = rawLayout === 'fitDataFill' ? 'fitDataTable' : rawLayout;
  const ignoreGlobalLayout = options.enforceGlobalLayout === false;
  const globalMode = ignoreGlobalLayout ? null : getGlobalTableLayoutMode();
  const effectiveLayout = ignoreGlobalLayout
    ? (requestedLayout || 'fitColumns')
    : globalMode === TABLE_LAYOUT_DATA
      ? 'fitDataTable'
      : globalMode === TABLE_LAYOUT_WIDTH
        ? 'fitColumns'
        : 'fitDataStretch';
  const rawColumns = Array.isArray(options.columns) ? [...options.columns] : null;
  const panelComponentId = typeof options.panelComponentId === 'string' && options.panelComponentId.trim()
    ? options.panelComponentId.trim()
    : (
      typeof window !== 'undefined'
        ? String(
          window?.dockviewApi?.activePanel?.component
          || window?.dockviewApi?.activePanel?.api?.component
          || ''
        ).trim()
        : ''
    );
  const titledColumns = rawColumns ? normalizeColumnTitles(rawColumns, { panelComponentId }) : null;
  const numberColumns = titledColumns ? applyGlobalNumberDisplayFormatters(titledColumns) : null;
  const compactColumns = numberColumns ? applyGlobalCompactFormatters(numberColumns) : null;
  const alignedColumns = compactColumns ? normalizeColumnHeaderAlignment(compactColumns) : null;
  const freezeLeading = options.freezeLeadingColumns === false || options.freezeLeadingColumns === 0
    ? 0
    : (Number.isFinite(Number(options.freezeLeadingColumns))
      ? Number(options.freezeLeadingColumns)
      : 1);
  const frozenColumns = alignedColumns
    ? applyFreezeLeadingColumns(alignedColumns, freezeLeading)
    : null;
  const sourceColumns = ignoreGlobalLayout ? frozenColumns : stripFixedWidths(frozenColumns);
  const panelInstanceId = typeof options.panelInstanceId === 'string' && options.panelInstanceId.trim()
    ? options.panelInstanceId.trim()
    : null;
  const exportTitle = typeof options.exportTitle === 'string' && options.exportTitle.trim()
    ? options.exportTitle.trim()
    : null;

  const {
    enforceGlobalLayout: _enforceGlobalLayout,
    layout: _layout,
    panelComponentId: _panelComponentId,
    panelInstanceId: _panelInstanceId,
    exportTitle: _exportTitle,
    freezeLeadingColumns: _freezeLeadingColumns,
    ...restOptions
  } = options;

  return {
    ...DEFAULT_TABULATOR_OPTIONS,
    ...restOptions,
    ...(effectiveLayout ? { layout: effectiveLayout } : {}),
    ...(sourceColumns ? { columns: sourceColumns } : {}),
    __taliaProcessedOptions: true,
    __taliaBaseColumns: sourceColumns ? [...sourceColumns] : null,
    __taliaPanelInstanceId: panelInstanceId,
    __taliaPanelComponentId: panelComponentId || null,
    __taliaExportTitle: exportTitle,
  };
};

/**
 * Default Tabulator options
 */
export const DEFAULT_TABULATOR_OPTIONS = {
  layout: 'fitDataStretch',
  layoutColumnsOnNewData: true,
  reactiveData: false,
  height: '100%',
  selectableRows: 1,
  headerFilterLiveFilter: true,
  headerFilterLiveFilterDelay: 300,
};

/**
 * Common column type builders
 */
export const COMMON_COLUMN_TYPES = {
  input: (config = {}) => ({
    headerFilter: 'input',
    headerFilterPlaceholder: config.placeholder || 'Filter...',
    ...config
  }),

  dropdown: (config = {}) => {
    const {
      values,
      clearable = true,
      autocomplete = false,
      headerFilterParams,
      ...rest
    } = config;
    return {
      ...rest,
      headerFilter: 'list',
      headerFilterParams: {
        ...(headerFilterParams || {}),
        values: values || headerFilterParams?.values || {},
        clearable: clearable !== false,
        // Fixed enums must keep the full option list after a value is chosen.
        autocomplete: autocomplete === true,
      },
    };
  },

  number: (config = {}) => ({
    headerFilter: 'input',
    headerFilterPlaceholder: config.placeholder || 'Enter number...',
    headerFilterFunc: config.operator || '>=',
    hozAlign: 'right',
    ...config
  }),

  date: (config = {}) => ({
    headerFilter: 'input',
    headerFilterPlaceholder: config.placeholder || 'YYYY-MM-DD',
    formatter: (cell) => {
      const value = cell.getValue();
      if (!value) return '';
      return formatDayMon(value, '');
    },
    ...config
  }),

  boolean: (config = {}) => ({
    hozAlign: 'center',
    formatter: (cell) => {
      const value = cell.getValue();
      return value === 'Y' || value === true ? 'Yes' : 'No';
    },
    ...config
  })
};

export default getWrappedTabulatorClass();

/**
 * Standard Tabulator row selection: single-click selects, double-click opens
 * Details/edit (or whatever the panel treats as "open"). Prefer this over
 * panel-local handlers so activate+click and selection stay consistent.
 *
 * @param {object} table — Tabulator instance
 * @param {{ onSelect?: (data: object|null, row: object) => void, onOpen?: (data: object|null, row: object) => void }} handlers
 * @returns {() => void} unsubscribe
 */
export function bindTabulatorRowSelectionHandlers(table, handlers = {}) {
  if (!table || typeof table.on !== 'function') return () => {};
  const { onSelect, onOpen } = handlers;

  const handleClick = (_event, row) => {
    const data = row?.getData?.() ?? null;
    onSelect?.(data, row);
  };

  const handleDblClick = (event, row) => {
    // Prevent accidental header/sort side-effects from bubbling on dense tables.
    try { event?.stopPropagation?.(); } catch { /* noop */ }
    const data = row?.getData?.() ?? null;
    onSelect?.(data, row);
    onOpen?.(data, row);
  };

  table.on('rowClick', handleClick);
  table.on('rowDblClick', handleDblClick);

  return () => {
    try {
      table.off?.('rowClick', handleClick);
      table.off?.('rowDblClick', handleDblClick);
    } catch {
      /* noop — destroyed tables may not support off */
    }
  };
}
