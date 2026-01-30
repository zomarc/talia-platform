/**
 * Tabulator Configuration
 * 
 * Local installation via npm - tabulator-tables@6.3.1
 * Uses midnight theme as base with custom overrides in tabulator-theme.css
 */

// Import Tabulator from npm package
import { TabulatorFull as Tabulator } from 'tabulator-tables';

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
  return {
    ...DEFAULT_TABULATOR_OPTIONS,
    ...options
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
      const date = new Date(value);
      return date.toLocaleDateString(config.locale || 'en-US');
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
