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
const dragTracker = {
  active: false,
  moved: false,
  startX: 0,
  startY: 0,
};

const isBrowser = () => typeof window !== 'undefined';

const getGlobalTableLayoutMode = () => {
  if (!isBrowser()) return TABLE_LAYOUT_WIDTH;
  const inMemory = window.__taliaTableLayoutMode;
  if (inMemory === TABLE_LAYOUT_DATA || inMemory === TABLE_LAYOUT_WIDTH) return inMemory;
  const saved = window.localStorage?.getItem?.(TABLE_LAYOUT_STORAGE_KEY);
  return saved === TABLE_LAYOUT_DATA ? TABLE_LAYOUT_DATA : TABLE_LAYOUT_WIDTH;
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

const cloneColumnDefs = (columns) => {
  if (!Array.isArray(columns)) return [];
  return columns.map((column) => ({
    ...column,
    ...(Array.isArray(column?.columns) ? { columns: cloneColumnDefs(column.columns) } : {})
  }));
};

const applyLastColumnGrow = (columns) => {
  if (!Array.isArray(columns) || !columns.length) return columns;
  const next = cloneColumnDefs(columns);
  const lastIndex = next.length - 1;
  const lastColumn = next[lastIndex] || {};
  next[lastIndex] = {
    ...lastColumn,
    widthGrow: lastColumn.widthGrow ?? 1
  };
  return next;
};

const stripFixedWidths = (columns) => {
  if (!Array.isArray(columns)) return [];
  return columns.map((column) => {
    const { width, widthGrow, ...rest } = column || {};
    return {
      ...rest,
      ...(Array.isArray(column?.columns) ? { columns: stripFixedWidths(column.columns) } : {})
    };
  });
};

const fitLastColumn = (table) => {
  try {
    if (!table?.getColumns) return;
    const columns = table.getColumns().filter((column) => column?.isVisible?.() !== false);
    if (!columns || columns.length < 2) return;

    const tableElement = table.element;
    const holder = tableElement?.querySelector?.('.tabulator-tableholder');
    const availableWidth = holder?.clientWidth || tableElement?.clientWidth || 0;
    if (!availableWidth) return;

    const headColumns = columns.slice(0, -1);
    const lastColumn = columns[columns.length - 1];
    const usedWidth = headColumns.reduce((acc, column) => acc + (column.getWidth?.() || 0), 0);
    const nextWidth = Math.max(120, Math.floor(availableWidth - usedWidth - 2));

    if (Math.abs((lastColumn.getWidth?.() || 0) - nextWidth) > 2) {
      lastColumn.setWidth(nextWidth);
    }
  } catch {
    // no-op
  }
};

const applyLayoutModeToTable = (table) => {
  if (!table) return;
  const mode = getGlobalTableLayoutMode();
  const currentLayout = table?.options?.layout;
  const nextLayout =
    mode === TABLE_LAYOUT_DATA
      ? 'fitDataTable'
      : currentLayout === 'fitDataStretch'
        ? 'fitDataStretch'
        : 'fitColumns';
  try {
    const meta = tableMeta.get(table);
    const isBuilt = meta?.isBuilt === true;
    const shouldRebuildColumns = meta?.lastAppliedMode !== mode;
    if (meta) {
      meta.lastAppliedMode = mode;
    }
    if (isBuilt && shouldRebuildColumns && meta?.baseColumns?.length && typeof table.setColumns === 'function') {
      const nextColumns = mode === TABLE_LAYOUT_DATA
        ? stripFixedWidths(meta.baseColumns)
        : applyLastColumnGrow(meta.baseColumns);
      table.setColumns(nextColumns);
    }

    if (!isBuilt) {
      if (table.options) {
        table.options.layout = nextLayout;
      }
      return;
    }

    if (typeof table.setOption === 'function') {
      table.setOption('layout', nextLayout);
    } else if (table.options) {
      table.options.layout = nextLayout;
    }
    table.layoutRefresh?.(true);
    table.redraw?.(true);
    if (nextLayout === 'fitDataStretch') {
      fitLastColumn(table);
    }
  } catch {
    // no-op
  }
};

const ensureLayoutListenerBound = () => {
  if (!isBrowser() || hasBoundLayoutListener) return;
  hasBoundLayoutListener = true;
  const reflowAllTables = () => {
    tableInstances.forEach((table) => applyLayoutModeToTable(table));
  };
  window.addEventListener(DASHBOARD_TABLE_LAYOUT_EVENT, (event) => {
    const mode = event?.detail?.mode;
    setGlobalTableLayoutMode(mode);
    reflowAllTables();
  });
  window.addEventListener('resize', () => {
    reflowAllTables();
  });
  // Re-apply layout after drag-resize gestures only (not regular clicks).
  window.addEventListener('mousedown', (event) => {
    dragTracker.active = true;
    dragTracker.moved = false;
    dragTracker.startX = Number(event?.clientX || 0);
    dragTracker.startY = Number(event?.clientY || 0);
  });
  window.addEventListener('mousemove', (event) => {
    if (!dragTracker.active) return;
    const x = Number(event?.clientX || 0);
    const y = Number(event?.clientY || 0);
    if (Math.abs(x - dragTracker.startX) > 6 || Math.abs(y - dragTracker.startY) > 6) {
      dragTracker.moved = true;
    }
  });
  window.addEventListener('mouseup', () => {
    if (dragTracker.active && dragTracker.moved) {
      reflowAllTables();
    }
    dragTracker.active = false;
    dragTracker.moved = false;
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      requestAnimationFrame(() => {
        reflowAllTables();
      });
    }
  });
};

const registerTableInstance = (table, baseColumns = null) => {
  if (!table) return;
  if (!tableMeta.has(table)) {
    tableMeta.set(table, {
      baseColumns: Array.isArray(baseColumns) ? cloneColumnDefs(baseColumns) : null,
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
      // Apply layout mode immediately so newly opened reports honor global mode.
      applyLayoutModeToTable(this);

      this.on?.('tableBuilt', () => {
        const meta = tableMeta.get(this);
        if (meta) {
          meta.isBuilt = true;
        }
        applyLayoutModeToTable(this);
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
  const requestedLayout = rawLayout === 'fitDataFill' ? undefined : rawLayout;
  const ignoreGlobalLayout = options.enforceGlobalLayout === false;
  const globalMode = ignoreGlobalLayout ? null : getGlobalTableLayoutMode();
  const effectiveLayout = ignoreGlobalLayout
    ? (requestedLayout || 'fitColumns')
    : globalMode === TABLE_LAYOUT_DATA
      ? 'fitDataTable'
      : (requestedLayout || 'fitColumns');
  const sourceColumns = Array.isArray(options.columns) ? cloneColumnDefs(options.columns) : null;
  let processedColumns = sourceColumns ? cloneColumnDefs(sourceColumns) : null;
  if (
    processedColumns
    && processedColumns.length > 0
    && options.disableLastColumnGrow !== true
    && effectiveLayout !== 'fitDataTable'
  ) {
    processedColumns = applyLastColumnGrow(processedColumns);
  }
  if (processedColumns && effectiveLayout === 'fitDataTable') {
    processedColumns = stripFixedWidths(processedColumns);
  }

  const {
    disableLastColumnGrow,
    disableLastColumnFill,
    enforceGlobalLayout,
    layout,
    tableBuilt,
    dataLoaded,
    dataChanged,
    ...restOptions
  } = options;

  const withLastColumnFit = (userCallback) => function (...args) {
    registerTableInstance(this, sourceColumns);
    const layoutName = this?.options?.layout;
    const shouldFillLastColumn = disableLastColumnFill !== true && layoutName === 'fitDataStretch';
    if (shouldFillLastColumn) {
      fitLastColumn(this);
    } else {
      this?.redraw?.(true);
    }
    if (typeof userCallback === 'function') {
      userCallback.apply(this, args);
    }
  };

  return {
    ...DEFAULT_TABULATOR_OPTIONS,
    ...restOptions,
    ...(effectiveLayout ? { layout: effectiveLayout } : {}),
    ...(processedColumns ? { columns: processedColumns } : {}),
    __taliaProcessedOptions: true,
    __taliaBaseColumns: sourceColumns ? cloneColumnDefs(sourceColumns) : null,
    tableBuilt: withLastColumnFit(tableBuilt),
    dataLoaded: withLastColumnFit(dataLoaded),
    dataChanged: withLastColumnFit(dataChanged)
  };
};

/**
 * Default Tabulator options
 */
export const DEFAULT_TABULATOR_OPTIONS = {
  layout: 'fitColumns',
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
