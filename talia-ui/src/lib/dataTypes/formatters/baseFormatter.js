/**
 * Base Formatter Utilities
 * Shared utilities for handling common formatter patterns
 */

/**
 * Check if a value is null, undefined, or empty string
 * @param {*} value - Value to check
 * @returns {boolean} True if value is null/undefined/empty
 */
export const isEmpty = (value) => {
  return value == null || value === '';
};

/**
 * Safely parse a numeric value
 * @param {*} value - Value to parse
 * @returns {number|null} Parsed number or null if invalid
 */
export const parseNumber = (value) => {
  if (isEmpty(value)) return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
};

/**
 * Safely parse an integer value
 * @param {*} value - Value to parse
 * @returns {number|null} Parsed integer or null if invalid
 */
export const parseInt = (value) => {
  if (isEmpty(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
};

/**
 * Get default locale from browser or use en-US
 * @returns {string} Locale string
 */
export const getDefaultLocale = () => {
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language;
  }
  return 'en-US';
};
