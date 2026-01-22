/**
 * DateType Data Type
 * 
 * Provides date formatting with locale support.
 * Leverages Tabulator's date capabilities where possible.
 * 
 * NOTE: Named 'DateType' to avoid conflict with global JavaScript Date constructor.
 * 
 * @module dataTypes/types/DateType
 */

import { isEmpty } from '../formatters/baseFormatter';

/**
 * DateType data type definition
 * 
 * @example
 * // Basic usage
 * const column = DateType.toTabulatorColumn('sail_date_from', 'Sail Date');
 * 
 * @example
 * // With custom format
 * const column = DateType.toTabulatorColumn('departure_date', 'Departure', {
 *   format: 'short'
 * });
 */
export const DateType = {
  /**
   * Type name identifier
   */
  name: 'date',

  /**
   * Tabulator formatter function for date values
   * 
   * @param {CellComponent} cell - Tabulator cell component
   * @param {Object} params - Formatter parameters
   * @param {string} [params.locale] - Locale for formatting (defaults to browser locale or 'en-US')
   * @param {string} [params.format='standard'] - Date format: 'standard', 'short', 'long', 'full', or 'custom'
   * @param {string} [params.customFormat] - Custom format string (when format='custom')
   * @returns {string} Formatted date string
   */
  formatter: (cell, params = {}) => {
    const value = cell.getValue();
    if (isEmpty(value)) return '';

    let date;
    try {
      // Handle string dates, Date objects, and timestamps
      // Use globalThis.Date to ensure we use the native Date constructor
      if (value instanceof globalThis.Date) {
        date = value;
      } else if (typeof value === 'string') {
        // Try parsing as ISO string first, then as date string
        date = new globalThis.Date(value);
      } else if (typeof value === 'number') {
        // Handle timestamps
        date = new globalThis.Date(value);
      } else {
        date = new globalThis.Date(value);
      }

      if (isNaN(date.getTime())) {
        console.warn('[DateType] Invalid date value:', value, typeof value);
        return '';
      }
    } catch (error) {
      console.warn('[DateType] Date parsing error:', error, 'Value:', value);
      return '';
    }

    const locale = params.locale || (typeof navigator !== 'undefined' ? navigator.language : 'en-US');
    const format = params.format || 'standard';

    try {
      let options = {};
      
      switch (format) {
        case 'short':
          options = { year: 'numeric', month: 'short', day: 'numeric' };
          break;
        case 'long':
          options = { year: 'numeric', month: 'long', day: 'numeric' };
          break;
        case 'full':
          options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
          break;
        case 'custom':
          // For custom format, use toLocaleDateString with custom options
          if (params.customFormat) {
            // Simple custom format support - can be extended
            return date.toLocaleDateString(locale, params.customFormat);
          }
          // Fall through to standard
        case 'standard':
        default:
          options = { year: 'numeric', month: '2-digit', day: '2-digit' };
          break;
      }

      const formatted = date.toLocaleDateString(locale, options);
      return formatted || date.toISOString().split('T')[0];
    } catch (error) {
      console.warn('[DateType] Formatting error:', error, 'Date:', date);
      // Fallback to ISO string
      try {
        return date.toISOString().split('T')[0];
      } catch (e) {
        return String(value);
      }
    }
  },

  /**
   * Tabulator sorter for date values
   * Uses Tabulator's built-in date sorter
   */
  sorter: 'date',

  /**
   * Default horizontal alignment for date columns
   */
  hozAlign: 'left',

  /**
   * Default header filter type for date columns
   * Uses Tabulator's input filter (can be changed to date filter if needed)
   */
  headerFilter: 'input',

  /**
   * Create a Tabulator column configuration for a date field
   * 
   * @param {string} field - Field name in data
   * @param {string} title - Column title
   * @param {Object} [params={}] - Additional parameters
   * @param {string} [params.locale] - Locale for formatting
   * @param {string} [params.format='standard'] - Date format style
   * @param {Object} [params.overrides={}] - Additional Tabulator column overrides
   * @returns {Object} Tabulator column configuration
   * 
   * @example
   * const sailDateColumn = DateType.toTabulatorColumn(
   *   'sail_date_from',
   *   'Sail Date',
   *   { format: 'short' }
   * );
   */
  toTabulatorColumn: (field, title, params = {}) => {
    const {
      locale,
      format = 'standard',
      customFormat,
      overrides = {},
      ...otherParams
    } = params;

    return {
      field,
      title,
      formatter: DateType.formatter,
      formatterParams: {
        locale,
        format,
        customFormat,
        ...otherParams
      },
      sorter: DateType.sorter,
      hozAlign: DateType.hozAlign,
      headerFilter: DateType.headerFilter,
      ...overrides
    };
  }
};
