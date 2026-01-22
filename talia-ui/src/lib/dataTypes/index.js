/**
 * Shared Data Types Library
 * 
 * Provides standardized data type definitions for Tabulator columns.
 * All types include formatters, sorters, and filters that leverage
 * Tabulator's native capabilities.
 * 
 * @module dataTypes
 * 
 * @example
 * // Import data types and column builders
 * import { 
 *   Currency, Percentage, DateType, Number,
 *   TextColumn, CurrencyColumn, PercentageColumn, NumberColumn,
 *   PerformanceColumn, DeltaColumn, createColumnGroup
 * } from '@/lib/dataTypes';
 * 
 * // Use column builders for simple definitions
 * const columns = [
 *   TextColumn('ship', 'Ship', { filter: 'lookup' }),
 *   createColumnGroup('Pricing', [
 *     CurrencyColumn('minFare', 'Min Fare'),
 *     CurrencyColumn('maxFare', 'Max Fare')
 *   ]),
 *   createColumnGroup('Performance', [
 *     PerformanceColumn('vsTarget', 'vs Target %', 100),
 *     DeltaColumn('delta', 'Delta')
 *   ])
 * ];
 */

// ============================================================================
// Data Types (low-level building blocks)
// ============================================================================
export { Currency } from './types/Currency';
export { Percentage } from './types/Percentage';
export { DateType } from './types/Date';
export { Number } from './types/Number';

// ============================================================================
// Base Formatter Utilities
// ============================================================================
export { isEmpty, parseNumber, parseInt, getDefaultLocale } from './formatters/baseFormatter';

// ============================================================================
// Conditional Formatters (for custom styling)
// ============================================================================
export { 
  STYLES,
  createPerformanceFormatter,
  createDeltaFormatter,
  createRowFormatter,
  createCurrencyDeltaFormatter,
  createSummaryTextFormatter
} from './formatters/conditionalFormatters';

// ============================================================================
// Column Builders (high-level, easy-to-use column definitions)
// ============================================================================
export {
  TextColumn,
  CurrencyColumn,
  PercentageColumn,
  NumberColumn,
  DateColumn,
  PerformanceColumn,
  DeltaColumn,
  CurrencyDeltaColumn,
  SimpleNumberColumn,
  ROSColumn
} from './columns/columnBuilders';

// ============================================================================
// Column Groups (for grouped headers)
// ============================================================================
export {
  createColumnGroup,
  createColumnGroups,
  flattenColumns,
  countColumns
} from './columns/columnGroups';
