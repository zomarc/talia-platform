/**
 * Percentage Data Type
 * 
 * Provides percentage formatting with configurable decimal places.
 * Can be combined with conditional formatting for performance indicators.
 * 
 * @module dataTypes/types/Percentage
 */

import { isEmpty, parseNumber } from '../formatters/baseFormatter';

/**
 * Percentage data type definition
 * 
 * @example
 * // Basic usage
 * const column = Percentage.toTabulatorColumn('occupancy', 'Occupancy %');
 * 
 * @example
 * // With custom decimal places
 * const column = Percentage.toTabulatorColumn('growth', 'Growth %', {
 *   decimals: 1
 * });
 */
export const Percentage = {
  /**
   * Type name identifier
   */
  name: 'percentage',

  /**
   * Tabulator formatter function for percentage values
   * 
   * @param {CellComponent} cell - Tabulator cell component
   * @param {Object} params - Formatter parameters
   * @param {number} [params.decimals=2] - Number of decimal places
   * @param {boolean} [params.showSymbol=true] - Whether to show % symbol
   * @returns {string} Formatted percentage string
   */
  formatter: (cell, params = {}) => {
    const value = cell.getValue();
    if (isEmpty(value)) return '';

    const numValue = parseNumber(value);
    if (numValue === null) return '';

    const decimals = params.decimals !== undefined ? params.decimals : 2;
    const showSymbol = params.showSymbol !== undefined ? params.showSymbol : true;

    const formatted = numValue.toFixed(decimals);
    return showSymbol ? `${formatted}%` : formatted;
  },

  /**
   * Tabulator sorter for percentage values
   * Uses Tabulator's built-in number sorter
   */
  sorter: 'number',

  /**
   * Default horizontal alignment for percentage columns
   */
  hozAlign: 'right',

  /**
   * Default header filter type for percentage columns
   * Uses Tabulator's number filter
   */
  headerFilter: 'number',

  /**
   * Create a Tabulator column configuration for a percentage field
   * 
   * @param {string} field - Field name in data
   * @param {string} title - Column title
   * @param {Object} [params={}] - Additional parameters
   * @param {number} [params.decimals=2] - Number of decimal places
   * @param {boolean} [params.showSymbol=true] - Whether to show % symbol
   * @param {Object} [params.overrides={}] - Additional Tabulator column overrides
   * @returns {Object} Tabulator column configuration
   * 
   * @example
   * const occupancyColumn = Percentage.toTabulatorColumn(
   *   'pax_nights_booked_occupancy',
   *   'Pax Nights Booked Occupancy',
   *   { decimals: 2 }
   * );
   */
  toTabulatorColumn: (field, title, params = {}) => {
    const {
      decimals = 2,
      showSymbol = true,
      overrides = {},
      ...otherParams
    } = params;

    return {
      field,
      title,
      formatter: Percentage.formatter,
      formatterParams: {
        decimals,
        showSymbol,
        ...otherParams
      },
      sorter: Percentage.sorter,
      hozAlign: Percentage.hozAlign,
      headerFilter: Percentage.headerFilter,
      ...overrides
    };
  }
};
