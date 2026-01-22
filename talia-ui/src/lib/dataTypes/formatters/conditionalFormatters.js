/**
 * Conditional Formatters for Tabulator
 * 
 * Provides reusable formatters with conditional styling (green/red/orange)
 * for performance indicators, delta values, and summary rows.
 * 
 * @module dataTypes/formatters/conditionalFormatters
 */

import { isEmpty, parseNumber } from './baseFormatter';

/**
 * Reusable style constants for conditional formatting
 * These follow accessibility guidelines for color contrast
 */
export const STYLES = {
  positive: { 
    backgroundColor: '#d4edda', 
    color: '#155724' 
  },
  negative: { 
    backgroundColor: '#f8d7da', 
    color: '#721c24' 
  },
  warning: { 
    backgroundColor: '#fff3cd', 
    color: '#856404' 
  },
  neutral: { 
    backgroundColor: '#f0f0f0', 
    color: 'inherit' 
  },
  summaryRow: { 
    backgroundColor: '#f5f5f5', 
    fontWeight: 'bold' 
  },
  categoryRow: { 
    backgroundColor: '#fafafa', 
    fontStyle: 'italic' 
  }
};

/**
 * Apply styles to a cell element
 * @param {HTMLElement} element - The cell element
 * @param {Object} styles - Style object to apply
 */
const applyStyles = (element, styles) => {
  Object.entries(styles).forEach(([key, value]) => {
    element.style[key] = value;
  });
};

/**
 * Reset cell styles to default
 * @param {HTMLElement} element - The cell element
 */
const resetStyles = (element) => {
  element.style.backgroundColor = '';
  element.style.color = '';
  element.style.fontWeight = '';
  element.style.fontStyle = '';
};

/**
 * Format a number as percentage
 * @param {number} value - The value to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage string
 */
const formatAsPercentage = (value, decimals = 2) => {
  if (isEmpty(value)) return '';
  const num = parseNumber(value);
  if (num === null) return '';
  return `${num.toFixed(decimals)}%`;
};

/**
 * Format a number with locale formatting
 * @param {number} value - The value to format
 * @returns {string} Formatted number string
 */
const formatAsNumber = (value) => {
  if (isEmpty(value)) return '';
  const num = parseNumber(value);
  if (num === null) return '';
  return new Intl.NumberFormat('en-US').format(num);
};

/**
 * Create a performance formatter with threshold-based conditional styling
 * 
 * - Green: value >= threshold (good performance)
 * - Yellow/Orange: value >= threshold * 0.8 (warning)
 * - Red: value < threshold * 0.8 (poor performance)
 * 
 * @param {number} threshold - The threshold value (default: 100)
 * @param {Object} options - Additional options
 * @param {boolean} options.boldSummaryRows - Whether to bold summary rows (default: true)
 * @param {number} options.warningPercent - Warning threshold as percent of main threshold (default: 0.8)
 * @returns {Function} Tabulator formatter function
 * 
 * @example
 * const formatter = createPerformanceFormatter(100);
 * // or with options
 * const formatter = createPerformanceFormatter(20, { warningPercent: 0.9 });
 */
export const createPerformanceFormatter = (threshold = 100, options = {}) => {
  const { 
    boldSummaryRows = true, 
    warningPercent = 0.8,
    decimals = 2
  } = options;
  
  return (cell) => {
    const value = cell.getValue();
    if (isEmpty(value)) return '';
    
    const element = cell.getElement();
    const numValue = parseNumber(value);
    
    if (numValue === null) return '';
    
    // Reset styles first
    resetStyles(element);
    
    // Apply conditional formatting based on threshold
    if (numValue >= threshold) {
      applyStyles(element, STYLES.positive);
    } else if (numValue < threshold * warningPercent) {
      applyStyles(element, STYLES.negative);
    } else {
      applyStyles(element, STYLES.warning);
    }
    
    // Bold summary rows if enabled
    if (boldSummaryRows) {
      const rowData = cell.getRow().getData();
      if (rowData.rowType === 'month' || rowData.rowType === 'category' || rowData.rowType === 'total') {
        element.style.fontWeight = 'bold';
      }
    }
    
    return formatAsPercentage(value, decimals);
  };
};

/**
 * Create a delta formatter for positive/negative indicators
 * 
 * - Green: value > 0 (positive)
 * - Red: value < 0 (negative)
 * - Neutral: value === 0
 * 
 * @param {Object} options - Additional options
 * @param {number} options.decimals - Number of decimal places (default: 2)
 * @param {boolean} options.showSign - Whether to show +/- sign (default: false)
 * @returns {Function} Tabulator formatter function
 * 
 * @example
 * const formatter = createDeltaFormatter();
 * // or with options
 * const formatter = createDeltaFormatter({ decimals: 1, showSign: true });
 */
export const createDeltaFormatter = (options = {}) => {
  const { decimals = 2, showSign = false } = options;
  
  return (cell) => {
    const value = cell.getValue();
    if (isEmpty(value)) return '';
    
    const element = cell.getElement();
    const numValue = parseNumber(value);
    
    if (numValue === null) return '';
    
    // Reset styles first
    resetStyles(element);
    
    // Apply conditional formatting based on positive/negative
    if (numValue > 0) {
      applyStyles(element, STYLES.positive);
    } else if (numValue < 0) {
      applyStyles(element, STYLES.negative);
    } else {
      applyStyles(element, STYLES.neutral);
    }
    
    // Format with optional sign
    let formatted = `${numValue.toFixed(decimals)}%`;
    if (showSign && numValue > 0) {
      formatted = `+${formatted}`;
    }
    
    return formatted;
  };
};

/**
 * Create a row formatter for styling summary rows
 * 
 * Applies different styles based on rowType:
 * - 'month' or 'total': Bold with grey background
 * - 'category': Italic with lighter background
 * 
 * @returns {Function} Tabulator row formatter function
 * 
 * @example
 * const rowFormatter = createRowFormatter();
 * // Use in Tabulator options:
 * { rowFormatter: rowFormatter }
 */
export const createRowFormatter = () => {
  return (row) => {
    const data = row.getData();
    const element = row.getElement();
    
    // Reset styles
    element.style.fontWeight = '';
    element.style.fontStyle = '';
    element.style.backgroundColor = '';
    
    // Apply styles based on row type
    if (data.rowType === 'month' || data.rowType === 'total') {
      applyStyles(element, STYLES.summaryRow);
    } else if (data.rowType === 'category') {
      applyStyles(element, STYLES.categoryRow);
    }
  };
};

/**
 * Create a currency delta formatter
 * Shows currency values with positive/negative coloring
 * 
 * @param {Object} options - Additional options
 * @param {string} options.currency - Currency code (default: 'EUR')
 * @param {string} options.locale - Locale for formatting (default: 'en-US')
 * @returns {Function} Tabulator formatter function
 */
export const createCurrencyDeltaFormatter = (options = {}) => {
  const { currency = 'EUR', locale = 'en-US' } = options;
  
  return (cell) => {
    const value = cell.getValue();
    if (isEmpty(value)) return '';
    
    const element = cell.getElement();
    const numValue = parseNumber(value);
    
    if (numValue === null) return '';
    
    // Reset styles
    resetStyles(element);
    
    // Apply conditional formatting
    if (numValue > 0) {
      applyStyles(element, STYLES.positive);
    } else if (numValue < 0) {
      applyStyles(element, STYLES.negative);
    } else {
      applyStyles(element, STYLES.neutral);
    }
    
    // Format as currency
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(numValue);
    } catch (error) {
      return `${currency} ${numValue.toFixed(0)}`;
    }
  };
};

/**
 * Create a text formatter that bolds summary rows
 * 
 * @returns {Function} Tabulator formatter function
 */
export const createSummaryTextFormatter = () => {
  return (cell) => {
    const value = cell.getValue();
    const element = cell.getElement();
    const rowData = cell.getRow().getData();
    
    // Reset styles
    element.style.fontWeight = '';
    element.style.fontStyle = '';
    
    // Apply styles based on row type
    if (rowData.rowType === 'month' || rowData.rowType === 'total') {
      element.style.fontWeight = 'bold';
    } else if (rowData.rowType === 'category') {
      element.style.fontStyle = 'italic';
    }
    
    return value || '';
  };
};
