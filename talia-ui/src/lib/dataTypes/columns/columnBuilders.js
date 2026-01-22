/**
 * Column Builders for Tabulator
 * 
 * Provides factory functions for creating standardized Tabulator column configurations.
 * Each builder combines data types, formatters, and common options into reusable columns.
 * 
 * @module dataTypes/columns/columnBuilders
 */

import { Currency } from '../types/Currency';
import { Percentage } from '../types/Percentage';
import { Number as NumberType } from '../types/Number';
import { DateType } from '../types/Date';
import { parseNumber } from '../formatters/baseFormatter';
import { 
  createPerformanceFormatter, 
  createDeltaFormatter,
  createSummaryTextFormatter,
  createCurrencyDeltaFormatter
} from '../formatters/conditionalFormatters';

/**
 * Default column width
 */
const DEFAULT_WIDTH = 120;

/**
 * Create a text column with optional lookup filter
 * 
 * @param {string} field - Field name in data
 * @param {string} title - Column title
 * @param {Object} options - Additional options
 * @param {string} options.filter - Filter type: 'lookup', 'input', or false (default: false)
 * @param {number} options.width - Column width (default: 150)
 * @param {boolean} options.boldSummaryRows - Bold summary rows (default: false)
 * @param {Object} options.overrides - Additional Tabulator column overrides
 * @returns {Object} Tabulator column configuration
 * 
 * @example
 * TextColumn('ship', 'Ship', { filter: 'lookup' })
 * TextColumn('description', 'Description', { width: 200 })
 */
export const TextColumn = (field, title, options = {}) => {
  const {
    filter = false,
    width = 150,
    boldSummaryRows = false,
    overrides = {}
  } = options;

  const column = {
    field,
    title,
    width,
    hozAlign: 'left'
  };

  // Add filter configuration
  if (filter === 'lookup') {
    column.headerFilter = 'list';
    column.headerFilterParams = {
      valuesLookup: true,
      autocomplete: true
    };
  } else if (filter === 'input') {
    column.headerFilter = 'input';
  }

  // Add formatter for summary row styling if needed
  if (boldSummaryRows) {
    column.formatter = createSummaryTextFormatter();
  }

  return { ...column, ...overrides };
};

/**
 * Create a currency column with comparison filter
 * 
 * @param {string} field - Field name in data
 * @param {string} title - Column title
 * @param {Object} options - Additional options
 * @param {string} options.currency - Currency code (default: 'EUR')
 * @param {number} options.width - Column width (default: 120)
 * @param {number} options.minDecimals - Minimum decimal places (default: 0)
 * @param {number} options.maxDecimals - Maximum decimal places (default: 0)
 * @param {Object} options.overrides - Additional Tabulator column overrides
 * @returns {Object} Tabulator column configuration
 * 
 * @example
 * CurrencyColumn('ytdBookedRevEUR', 'YTD Booked Rev EUR')
 * CurrencyColumn('price', 'Price', { currency: 'USD', width: 140 })
 */
export const CurrencyColumn = (field, title, options = {}) => {
  const {
    currency = 'EUR',
    width = DEFAULT_WIDTH,
    minDecimals = 0,
    maxDecimals = 0,
    overrides = {}
  } = options;

  return Currency.toTabulatorColumn(field, title, {
    currency,
    minDecimals,
    maxDecimals,
    overrides: { width, ...overrides }
  });
};

/**
 * Create a percentage column
 * 
 * @param {string} field - Field name in data
 * @param {string} title - Column title
 * @param {Object} options - Additional options
 * @param {number} options.decimals - Number of decimal places (default: 2)
 * @param {number} options.width - Column width (default: 100)
 * @param {Object} options.overrides - Additional Tabulator column overrides
 * @returns {Object} Tabulator column configuration
 * 
 * @example
 * PercentageColumn('occupancy', 'Occupancy %')
 * PercentageColumn('growth', 'Growth', { decimals: 1 })
 */
export const PercentageColumn = (field, title, options = {}) => {
  const {
    decimals = 2,
    width = 100,
    overrides = {}
  } = options;

  return Percentage.toTabulatorColumn(field, title, {
    decimals,
    overrides: { width, ...overrides }
  });
};

/**
 * Create a number column with comparison filter
 * 
 * @param {string} field - Field name in data
 * @param {string} title - Column title
 * @param {Object} options - Additional options
 * @param {number} options.width - Column width (default: 120)
 * @param {number} options.minDecimals - Minimum decimal places (default: 0)
 * @param {number} options.maxDecimals - Maximum decimal places (default: 0)
 * @param {Object} options.overrides - Additional Tabulator column overrides
 * @returns {Object} Tabulator column configuration
 * 
 * @example
 * NumberColumn('quantity', 'Quantity')
 * NumberColumn('average', 'Average', { minDecimals: 2, maxDecimals: 2 })
 */
export const NumberColumn = (field, title, options = {}) => {
  const {
    width = DEFAULT_WIDTH,
    minDecimals = 0,
    maxDecimals = 0,
    overrides = {}
  } = options;

  return NumberType.toTabulatorColumn(field, title, {
    minDecimals,
    maxDecimals,
    overrides: { width, ...overrides }
  });
};

/**
 * Create a date column
 * 
 * @param {string} field - Field name in data
 * @param {string} title - Column title
 * @param {Object} options - Additional options
 * @param {string} options.format - Date format: 'standard', 'short', 'long', 'full' (default: 'short')
 * @param {number} options.width - Column width (default: 120)
 * @param {Object} options.overrides - Additional Tabulator column overrides
 * @returns {Object} Tabulator column configuration
 * 
 * @example
 * DateColumn('sailDate', 'Sail Date')
 * DateColumn('departure', 'Departure', { format: 'long' })
 */
export const DateColumn = (field, title, options = {}) => {
  const {
    format = 'short',
    width = DEFAULT_WIDTH,
    overrides = {}
  } = options;

  return DateType.toTabulatorColumn(field, title, {
    format,
    overrides: { width, ...overrides }
  });
};

/**
 * Create a performance indicator column with conditional styling
 * 
 * Applies green/yellow/red coloring based on threshold comparison:
 * - Green: value >= threshold
 * - Yellow: threshold * warningPercent <= value < threshold
 * - Red: value < threshold * warningPercent
 * 
 * @param {string} field - Field name in data
 * @param {string} title - Column title
 * @param {number} threshold - Performance threshold (default: 100)
 * @param {Object} options - Additional options
 * @param {number} options.width - Column width (default: 100)
 * @param {number} options.warningPercent - Warning threshold percent (default: 0.8)
 * @param {number} options.decimals - Decimal places for percentage (default: 2)
 * @param {boolean} options.boldSummaryRows - Bold summary rows (default: true)
 * @param {Object} options.overrides - Additional Tabulator column overrides
 * @returns {Object} Tabulator column configuration
 * 
 * @example
 * PerformanceColumn('vsTarget', 'vs Target %', 100)
 * PerformanceColumn('availability', '% Available', 20, { warningPercent: 0.9 })
 */
export const PerformanceColumn = (field, title, threshold = 100, options = {}) => {
  const {
    width = 100,
    warningPercent = 0.8,
    decimals = 2,
    boldSummaryRows = true,
    overrides = {}
  } = options;

  return {
    field,
    title,
    width,
    hozAlign: 'right',
    sorter: 'number',
    formatter: createPerformanceFormatter(threshold, { 
      warningPercent, 
      decimals,
      boldSummaryRows 
    }),
    ...overrides
  };
};

/**
 * Create a delta indicator column with positive/negative styling
 * 
 * Applies green/red coloring based on value sign:
 * - Green: value > 0
 * - Red: value < 0
 * - Neutral: value === 0
 * 
 * @param {string} field - Field name in data
 * @param {string} title - Column title
 * @param {Object} options - Additional options
 * @param {number} options.width - Column width (default: 120)
 * @param {number} options.decimals - Decimal places for percentage (default: 2)
 * @param {boolean} options.showSign - Show +/- sign (default: false)
 * @param {Object} options.overrides - Additional Tabulator column overrides
 * @returns {Object} Tabulator column configuration
 * 
 * @example
 * DeltaColumn('vsBudget', 'vs Budget %')
 * DeltaColumn('change', 'Change', { showSign: true })
 */
export const DeltaColumn = (field, title, options = {}) => {
  const {
    width = DEFAULT_WIDTH,
    decimals = 2,
    showSign = false,
    overrides = {}
  } = options;

  return {
    field,
    title,
    width,
    hozAlign: 'right',
    sorter: 'number',
    formatter: createDeltaFormatter({ decimals, showSign }),
    ...overrides
  };
};

/**
 * Create a currency delta column with positive/negative styling
 * 
 * @param {string} field - Field name in data
 * @param {string} title - Column title
 * @param {Object} options - Additional options
 * @param {string} options.currency - Currency code (default: 'EUR')
 * @param {number} options.width - Column width (default: 140)
 * @param {Object} options.overrides - Additional Tabulator column overrides
 * @returns {Object} Tabulator column configuration
 * 
 * @example
 * CurrencyDeltaColumn('revenueDelta', 'Revenue Delta')
 */
export const CurrencyDeltaColumn = (field, title, options = {}) => {
  const {
    currency = 'EUR',
    width = 140,
    overrides = {}
  } = options;

  return {
    field,
    title,
    width,
    hozAlign: 'right',
    sorter: 'number',
    formatter: createCurrencyDeltaFormatter({ currency }),
    ...overrides
  };
};

/**
 * Create a simple formatted number column (no filter)
 * Used for display-only numeric values
 * 
 * @param {string} field - Field name in data
 * @param {string} title - Column title
 * @param {Object} options - Additional options
 * @param {number} options.width - Column width (default: 120)
 * @param {number} options.decimals - Decimal places (default: 0)
 * @param {Object} options.overrides - Additional Tabulator column overrides
 * @returns {Object} Tabulator column configuration
 */
export const SimpleNumberColumn = (field, title, options = {}) => {
  const {
    width = DEFAULT_WIDTH,
    decimals = 0,
    overrides = {}
  } = options;

  return {
    field,
    title,
    width,
    hozAlign: 'right',
    sorter: 'number',
    formatter: (cell) => {
      const value = cell.getValue();
      if (value == null || value === '') return '';
      const num = parseNumber(value);
      if (num === null) return '';
      if (decimals > 0) {
        return num.toFixed(decimals);
      }
      return new Intl.NumberFormat('en-US').format(num);
    },
    ...overrides
  };
};

/**
 * Create a ROS (Rate of Sale) column
 * Displays decimal values with 1 decimal place
 * 
 * @param {string} field - Field name in data
 * @param {string} title - Column title
 * @param {Object} options - Additional options
 * @returns {Object} Tabulator column configuration
 */
export const ROSColumn = (field, title, options = {}) => {
  return SimpleNumberColumn(field, title, { 
    decimals: 1, 
    width: 100,
    ...options 
  });
};
