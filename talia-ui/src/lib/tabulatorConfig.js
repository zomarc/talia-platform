/**
 * Tabulator Configuration
 * 
 * Local installation via npm - tabulator-tables@6.3.1
 * Uses midnight theme as base with custom overrides in tabulator-theme.css
 */

// Import Tabulator from npm package
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { formatDayMon } from './dateFormat';
import { normalizeColumnHeaderAlignment } from './tabulatorColumnAlignment';
import { observeTabulatorFieldTerminology, resolveGlobalTabulatorLabel } from './tabulatorColumnLabelDictionary';

// Import Tabulator midnight theme CSS
import 'tabulator-tables/dist/css/tabulator_midnight.min.css';

const DASHBOARD_TABLE_LAYOUT_EVENT = 'talia:dashboard.tableLayout';
const DASHBOARD_TABULATOR_FILTER_VISIBILITY_EVENT = 'talia:dashboard.tabulatorFilterVisibility';
const DASHBOARD_DETAILS_VISIBILITY_EVENT = 'talia:dashboard.detailsVisibility';
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

const refreshTableLayout = (table) => {
  if (!table) return;
  table.layoutRefresh?.(true);
  table.redraw?.(true);
  if (isBrowser()) {
    window.requestAnimationFrame(() => {
      table.layoutRefresh?.(true);
      table.redraw?.(true);
    });
  }
};

/** Schedule layout refresh after data/visibility changes (safe before tableBuilt). */
export const scheduleTabulatorLayoutRefresh = (table) => {
  if (!table) return;
  const meta = tableMeta.get(table);
  if (meta && meta.isBuilt !== true && table?.initialized !== true) {
    meta.pendingLayoutRefresh = true;
    return;
  }
  refreshTableLayout(table);
};

const bindTableDataLayoutRefresh = (table) => {
  if (!table || tableMeta.get(table)?.dataLayoutBound) return;
  const meta = tableMeta.get(table) || {};
  meta.dataLayoutBound = true;
  tableMeta.set(table, meta);
  table.on?.('dataProcessed', () => scheduleTabulatorLayoutRefresh(table));
  table.on?.('dataLoaded', () => scheduleTabulatorLayoutRefresh(table));
};

const applyLayoutModeToTable = (table) => {
  if (!table) return;
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
      if (ready) {
        meta.isBuilt = true;
      }
    }
    if (typeof table.setOption === 'function') {
      table.setOption('layout', nextLayout);
    } else if (table.options) {
      table.options.layout = nextLayout;
    }
    if (!ready) {
      return;
    }
    // Tabulator keeps an active layout mode in module state; re-init after mode option change.
    table.modules?.layout?.initialize?.();
    refreshTableLayout(table);
  } catch {
    // no-op
  }
};

const ensureLayoutListenerBound = () => {
  if (!isBrowser() || hasBoundLayoutListener) return;
  hasBoundLayoutListener = true;
  const applyAllTables = () => {
    tableInstances.forEach((table) => applyLayoutModeToTable(table));
  };
  window.addEventListener(DASHBOARD_TABLE_LAYOUT_EVENT, (event) => {
    const mode = event?.detail?.mode;
    setGlobalTableLayoutMode(mode);
    applyAllTables();
  });
  window.addEventListener(DASHBOARD_TABULATOR_FILTER_VISIBILITY_EVENT, () => {
    tableInstances.forEach((table) => refreshTableLayout(table));
  });
  window.addEventListener(DASHBOARD_DETAILS_VISIBILITY_EVENT, () => {
    window.requestAnimationFrame(() => {
      tableInstances.forEach((table) => scheduleTabulatorLayoutRefresh(table));
    });
  });
  window.addEventListener('resize', () => {
    applyAllTables();
  });
};

const registerTableInstance = (table, baseColumns = null) => {
  if (!table) return;
  if (!tableMeta.has(table)) {
    tableMeta.set(table, {
      baseColumns: Array.isArray(baseColumns) ? [...baseColumns] : null,
      lastAppliedMode: null,
      isBuilt: false,
      pendingLayoutRefresh: false,
      dataLayoutBound: false,
    });
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
      delete processed.__taliaProcessedOptions;
      delete processed.__taliaBaseColumns;
      super(element, processed);

      registerTableInstance(this, baseColumns);
      bindTableDataLayoutRefresh(this);
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
          if (currentMeta.pendingLayoutRefresh) {
            currentMeta.pendingLayoutRefresh = false;
            refreshTableLayout(this);
          }
        }
        applyLayoutModeToTable(this);
        scheduleTabulatorLayoutRefresh(this);
      });
      this.on?.('groupVisibilityChanged', () => {
        refreshTableLayout(this);
      });
      this.on?.('tableDestroyed', () => {
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
  const compactColumns = titledColumns ? applyGlobalCompactFormatters(titledColumns) : null;
  const alignedColumns = compactColumns ? normalizeColumnHeaderAlignment(compactColumns) : null;
  const sourceColumns = ignoreGlobalLayout ? alignedColumns : stripFixedWidths(alignedColumns);

  const {
    enforceGlobalLayout: _enforceGlobalLayout,
    layout: _layout,
    panelComponentId: _panelComponentId,
    ...restOptions
  } = options;

  return {
    ...DEFAULT_TABULATOR_OPTIONS,
    ...restOptions,
    ...(effectiveLayout ? { layout: effectiveLayout } : {}),
    ...(sourceColumns ? { columns: sourceColumns } : {}),
    __taliaProcessedOptions: true,
    __taliaBaseColumns: sourceColumns ? [...sourceColumns] : null,
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

  dropdown: (config = {}) => ({
    headerFilter: 'list',
    headerFilterParams: {
      values: config.values || {},
      clearable: config.clearable !== false
    },
    ...config
  }),

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
