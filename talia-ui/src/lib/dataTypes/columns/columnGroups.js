/**
 * Column Groups for Tabulator
 * 
 * Provides helpers for creating grouped column headers in Tabulator tables.
 * 
 * @module dataTypes/columns/columnGroups
 */

/**
 * Create a column group with a header title
 * 
 * Wraps an array of columns under a shared group header.
 * This creates the nested column structure that Tabulator uses for grouped headers.
 * 
 * @param {string} title - Group header title
 * @param {Array<Object>} columns - Array of column configurations
 * @param {Object} options - Additional group options
 * @param {string} options.hozAlign - Horizontal alignment for group header
 * @returns {Object} Tabulator column group configuration
 * 
 * @example
 * createColumnGroup('Pricing', [
 *   CurrencyColumn('minFare', 'Min Fare'),
 *   CurrencyColumn('maxFare', 'Max Fare')
 * ])
 * 
 * @example
 * // Nested groups
 * createColumnGroup('Performance', [
 *   createColumnGroup('Revenue', [
 *     CurrencyColumn('ytdRev', 'YTD Revenue'),
 *     DeltaColumn('vsTarget', 'vs Target')
 *   ]),
 *   createColumnGroup('Passengers', [
 *     NumberColumn('ytdPax', 'YTD Pax'),
 *     DeltaColumn('vsBudget', 'vs Budget')
 *   ])
 * ])
 */
export const createColumnGroup = (title, columns, options = {}) => {
  const { hozAlign, ...otherOptions } = options;
  
  const group = {
    title,
    columns
  };
  
  if (hozAlign) {
    group.hozAlign = hozAlign;
  }
  
  return { ...group, ...otherOptions };
};

/**
 * Create multiple column groups from a definition object
 * 
 * Convenience function for creating multiple groups at once.
 * 
 * @param {Object} groupDefinitions - Object mapping group titles to column arrays
 * @returns {Array<Object>} Array of column group configurations
 * 
 * @example
 * const groups = createColumnGroups({
 *   'Occupancy': [
 *     PercentageColumn('booked', 'Booked'),
 *     PercentageColumn('target', 'Target')
 *   ],
 *   'Pricing': [
 *     CurrencyColumn('min', 'Min'),
 *     CurrencyColumn('max', 'Max')
 *   ]
 * });
 */
export const createColumnGroups = (groupDefinitions) => {
  return Object.entries(groupDefinitions).map(([title, columns]) => 
    createColumnGroup(title, columns)
  );
};

/**
 * Flatten nested column groups for validation or inspection
 * 
 * Recursively extracts all leaf columns from a column configuration.
 * Useful for debugging or validating column definitions.
 * 
 * @param {Array<Object>} columns - Array of columns (may include groups)
 * @returns {Array<Object>} Flat array of leaf columns
 * 
 * @example
 * const allColumns = flattenColumns(columns);
 * console.log(`Total columns: ${allColumns.length}`);
 */
export const flattenColumns = (columns) => {
  const result = [];
  
  for (const col of columns) {
    if (col.columns && Array.isArray(col.columns)) {
      // This is a group, recurse into it
      result.push(...flattenColumns(col.columns));
    } else {
      // This is a leaf column
      result.push(col);
    }
  }
  
  return result;
};

/**
 * Count total columns including nested groups
 * 
 * @param {Array<Object>} columns - Array of columns
 * @returns {number} Total number of leaf columns
 */
export const countColumns = (columns) => {
  return flattenColumns(columns).length;
};
