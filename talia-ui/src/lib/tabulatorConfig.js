/**
 * Tabulator Configuration
 * 
 * Local installation via npm - tabulator-tables@6.3.1
 * Uses midnight theme as base with custom overrides in tabulator-theme.css
 */

// Import Tabulator from npm package
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { formatDayMon } from './dateFormat';

// Import Tabulator midnight theme CSS
import 'tabulator-tables/dist/css/tabulator_midnight.min.css';

const DASHBOARD_TABLE_LAYOUT_EVENT = 'talia:dashboard.tableLayout';
const TABLE_LAYOUT_STORAGE_KEY = 'taliaTableLayoutMode';
const TABLE_LAYOUT_WIDTH = 'width';
const TABLE_LAYOUT_DATA = 'data';
const tableInstances = new Set();
let hasBoundLayoutListener = false;
const tableMeta = new WeakMap();
let wrappedTabulatorClass = null;

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

const getGlobalTableLayoutMode = () => {
  if (!isBrowser()) return TABLE_LAYOUT_WIDTH;
  const inMemory = window.__taliaTableLayoutMode;
  if (inMemory === TABLE_LAYOUT_DATA || inMemory === TABLE_LAYOUT_WIDTH) {
    return inMemory;
  }
  try {
    const saved = window.localStorage?.getItem?.(TABLE_LAYOUT_STORAGE_KEY);
    if (saved === TABLE_LAYOUT_DATA || saved === TABLE_LAYOUT_WIDTH) {
      return saved;
    }
  } catch {
    // no-op
  }
  return TABLE_LAYOUT_WIDTH;
};

const setGlobalTableLayoutMode = (mode) => {
  if (!isBrowser()) return;
  const next = mode === TABLE_LAYOUT_DATA ? TABLE_LAYOUT_DATA : TABLE_LAYOUT_WIDTH;
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

const applyLayoutModeToTable = (table) => {
  if (!table) return;
  const mode = getGlobalTableLayoutMode();
  const nextLayout = mode === TABLE_LAYOUT_DATA ? 'fitDataTable' : 'fitColumns';
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
      isBuilt: false
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
        applyLayoutModeToTable(this);
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
      : 'fitColumns';
  const rawColumns = Array.isArray(options.columns) ? [...options.columns] : null;
  const sourceColumns = ignoreGlobalLayout ? rawColumns : stripFixedWidths(rawColumns);

  const {
    enforceGlobalLayout,
    layout,
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
  layout: 'fitDataTable',
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
    hozAlign: 'center',
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
