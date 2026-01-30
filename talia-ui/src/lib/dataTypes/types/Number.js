/**
 * Number Data Type
 * 
 * Provides locale-aware number formatting using Intl.NumberFormat.
 * Leverages Tabulator's native number sorter and filter capabilities.
 * 
 * @module dataTypes/types/Number
 */

import { isEmpty, parseNumber } from '../formatters/baseFormatter';

/**
 * Number data type definition
 * 
 * @example
 * // Basic usage
 * const column = Number.toTabulatorColumn('quantity', 'Quantity');
 * 
 * @example
 * // With custom decimal places
 * const column = Number.toTabulatorColumn('average', 'Average', {
 *   minDecimals: 2,
 *   maxDecimals: 2
 * });
 */
export const Number = {
  /**
   * Type name identifier
   */
  name: 'number',

  /**
   * Tabulator formatter function for number values
   * 
   * @param {CellComponent} cell - Tabulator cell component
   * @param {Object} params - Formatter parameters
   * @param {string} [params.locale] - Locale for formatting (defaults to browser locale or 'en-US')
   * @param {number} [params.minDecimals] - Minimum decimal places
   * @param {number} [params.maxDecimals] - Maximum decimal places
   * @returns {string} Formatted number string
   */
  formatter: (cell, params = {}) => {
    const value = cell.getValue();
    if (isEmpty(value)) return '';

    const numValue = parseNumber(value);
    if (numValue === null) return '';

    const locale = params.locale || (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
    const formatOptions = {};

    if (params.minDecimals !== undefined) {
      formatOptions.minimumFractionDigits = params.minDecimals;
    }
    if (params.maxDecimals !== undefined) {
      formatOptions.maximumFractionDigits = params.maxDecimals;
    }

    try {
      return new Intl.NumberFormat(locale, formatOptions).format(numValue);
    } catch (error) {
      console.warn('[Number] Formatting error:', error);
      // Fallback to simple formatting
      const decimals = params.maxDecimals !== undefined ? params.maxDecimals : 0;
      return numValue.toFixed(decimals);
    }
  },

  /**
   * Tabulator sorter for number values
   * Uses Tabulator's built-in number sorter
   */
  sorter: 'number',

  /**
   * Default horizontal alignment for number columns
   */
  hozAlign: 'right',

  /**
   * Default header filter type for number columns
   * Uses Tabulator's input filter to allow comparison operators
   */
  headerFilter: 'input',
  
  /**
   * Default header filter parameters for number columns
   * Placeholder indicates users can type comparison operators
   */
  headerFilterParams: {
    placeholder: 'Filter (e.g., >100, <500)'
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
   * Create a Tabulator column configuration for a number field
   * 
   * @param {string} field - Field name in data
   * @param {string} title - Column title
   * @param {Object} [params={}] - Additional parameters
   * @param {string} [params.locale] - Locale for formatting
   * @param {number} [params.minDecimals] - Minimum decimal places
   * @param {number} [params.maxDecimals] - Maximum decimal places
   * @param {Object} [params.overrides={}] - Additional Tabulator column overrides
   * @returns {Object} Tabulator column configuration
   * 
   * @example
   * const paxColumn = Number.toTabulatorColumn(
   *   'ytd_booked_pax',
   *   'YTD Booked Pax'
   * );
   */
  toTabulatorColumn: (field, title, params = {}) => {
    const {
      locale,
      minDecimals,
      maxDecimals,
      overrides = {},
      ...otherParams
    } = params;

    return {
      field,
      title,
      formatter: Number.formatter,
      formatterParams: {
        locale,
        minDecimals,
        maxDecimals,
        ...otherParams
      },
      sorter: Number.sorter,
      hozAlign: Number.hozAlign,
      headerFilter: Number.headerFilter,
      headerFilterParams: Number.headerFilterParams,
      headerFilterFunc: Number.headerFilterFunc,
      ...overrides
    };
  }
};
