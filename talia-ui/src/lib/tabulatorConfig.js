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

/**
 * Initialize Tabulator
 * Returns the Tabulator constructor (already loaded via npm)
 */
export const initTabulator = async () => {
  return Tabulator;
};

/**
 * Get Tabulator options with defaults
 */
export const getTabulatorOptions = (options = {}) => {
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

  const effectiveLayout = options.layout === 'fitDataFill' ? 'fitDataStretch' : options.layout;
  const processedColumns = Array.isArray(options.columns) ? options.columns.map((col) => ({ ...col })) : null;
  if (processedColumns && processedColumns.length > 0 && options.disableLastColumnGrow !== true) {
    const lastIndex = processedColumns.length - 1;
    const lastColumn = processedColumns[lastIndex] || {};
    processedColumns[lastIndex] = {
      ...lastColumn,
      // Keep explicit width behavior if set, but allow remaining space to be consumed.
      widthGrow: lastColumn.widthGrow ?? 1
    };
  }

  const {
    disableLastColumnGrow,
    disableLastColumnFill,
    layout,
    tableBuilt,
    dataLoaded,
    dataChanged,
    ...restOptions
  } = options;

  const withLastColumnFit = (userCallback) => function (...args) {
    if (disableLastColumnFill !== true) {
      fitLastColumn(this);
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
    tableBuilt: withLastColumnFit(tableBuilt),
    dataLoaded: withLastColumnFit(dataLoaded),
    dataChanged: withLastColumnFit(dataChanged)
  };
};

/**
 * Default Tabulator options
 */
export const DEFAULT_TABULATOR_OPTIONS = {
  layout: 'fitDataFill',
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

export default Tabulator;
