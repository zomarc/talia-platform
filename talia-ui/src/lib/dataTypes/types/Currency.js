/**
 * Currency Data Type
 * 
 * Provides currency formatting using Intl.NumberFormat with currency style.
 * Leverages Tabulator's native number sorter and filter capabilities.
 * 
 * @module dataTypes/types/Currency
 */

import { isEmpty, parseNumber } from '../formatters/baseFormatter';

/**
 * Currency data type definition
 * 
 * @example
 * // Basic usage
 * const column = Currency.toTabulatorColumn('price', 'Price', { currency: 'EUR' });
 * 
 * @example
 * // With custom decimal places
 * const column = Currency.toTabulatorColumn('amount', 'Amount', {
 *   currency: 'USD',
 *   minDecimals: 2,
 *   maxDecimals: 2
 * });
 */
export const Currency = {
  /**
   * Type name identifier
   */
  name: 'currency',

  /**
   * Tabulator formatter function for currency values
   * 
   * @param {CellComponent} cell - Tabulator cell component
   * @param {Object} params - Formatter parameters
   * @param {string} [params.currency='EUR'] - Currency code (ISO 4217)
   * @param {string} [params.locale] - Locale for formatting (defaults to browser locale or 'en-US')
   * @param {number} [params.minDecimals=0] - Minimum decimal places
   * @param {number} [params.maxDecimals=0] - Maximum decimal places
   * @returns {string} Formatted currency string
   */
  formatter: (cell, params = {}) => {
    const value = cell.getValue();
    if (isEmpty(value)) return '';

    const numValue = parseNumber(value);
    if (numValue === null) return '';

    const locale = params.locale || (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
    const currency = params.currency || 'EUR';
    const minDecimals = params.minDecimals !== undefined ? params.minDecimals : 0;
    const maxDecimals = params.maxDecimals !== undefined ? params.maxDecimals : 0;

    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: minDecimals,
        maximumFractionDigits: maxDecimals
      }).format(numValue);
    } catch (error) {
      console.warn('[Currency] Formatting error:', error);
      // Fallback to simple formatting
      return `${currency} ${numValue.toFixed(maxDecimals || 0)}`;
    }
  },

  /**
   * Tabulator sorter for currency values
   * Uses Tabulator's built-in number sorter
   */
  sorter: 'number',

  /**
   * Default horizontal alignment for currency columns
   */
  hozAlign: 'right',

  /**
   * Default header filter type for currency columns
   * Uses Tabulator's input filter to allow comparison operators
   */
  headerFilter: 'input',
  
  /**
   * Default header filter parameters for currency columns
   * Placeholder indicates users can type comparison operators
   */
  headerFilterParams: {
    placeholder: 'Filter (e.g., >1000, <5000)'
  },
  
  /**
   * Custom filter function that parses comparison operators
   * Supports: >, <, >=, <=, =, !=, or just a number (defaults to >=)
   */
  headerFilterFunc: (headerValue, rowValue, rowData, filterParams) => {
    if (!headerValue || headerValue === '') return true;
    
    // Parse the filter value to extract operator and number
    const match = headerValue.toString().trim().match(/^(>=|<=|>|<|=|!=)?\s*([\d.,]+)$/);
    if (!match) {
      // If no match, try to parse as plain number
      const numValue = parseFloat(headerValue);
      if (isNaN(numValue)) return true;
      return parseNumber(rowValue) >= numValue;
    }
    
    const operator = match[1] || '>='; // Default to >= if no operator
    const filterNum = parseFloat(match[2].replace(/,/g, ''));
    const rowNum = parseNumber(rowValue);
    
    if (rowNum === null || isNaN(filterNum)) return true;
    
    switch (operator) {
      case '>':
        return rowNum > filterNum;
      case '<':
        return rowNum < filterNum;
      case '>=':
        return rowNum >= filterNum;
      case '<=':
        return rowNum <= filterNum;
      case '=':
        return rowNum === filterNum;
      case '!=':
        return rowNum !== filterNum;
      default:
        return rowNum >= filterNum;
    }
  },

  /**
   * Create a Tabulator column configuration for a currency field
   * 
   * @param {string} field - Field name in data
   * @param {string} title - Column title
   * @param {Object} [params={}] - Additional parameters
   * @param {string} [params.currency='EUR'] - Currency code
   * @param {string} [params.locale] - Locale for formatting
   * @param {number} [params.minDecimals=0] - Minimum decimal places
   * @param {number} [params.maxDecimals=0] - Maximum decimal places
   * @param {Object} [params.overrides={}] - Additional Tabulator column overrides
   * @returns {Object} Tabulator column configuration
   * 
   * @example
   * const revenueColumn = Currency.toTabulatorColumn(
   *   'ytd_booked_rev_eur',
   *   'Revenue (EUR)',
   *   { currency: 'EUR', minDecimals: 0, maxDecimals: 0 }
   * );
   */
  toTabulatorColumn: (field, title, params = {}) => {
    const {
      currency = 'EUR',
      locale,
      minDecimals = 0,
      maxDecimals = 0,
      overrides = {},
      ...otherParams
    } = params;

    return {
      field,
      title,
      formatter: Currency.formatter,
      formatterParams: {
        currency,
        locale,
        minDecimals,
        maxDecimals,
        ...otherParams
      },
      sorter: Currency.sorter,
      hozAlign: Currency.hozAlign,
      headerFilter: Currency.headerFilter,
      headerFilterParams: Currency.headerFilterParams,
      headerFilterFunc: Currency.headerFilterFunc,
      ...overrides
    };
  }
};
