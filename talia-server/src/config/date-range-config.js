/**
 * Date Range Configuration Module
 * 
 * Manages date range configuration for data integrations from environment variables.
 * Allows overriding dataset date ranges defined in sync.config.json for different environments
 * (local uses smaller subset, staging uses larger complete set).
 */

/**
 * Get the date range from environment variables
 * @param {string} datasetName - Optional dataset name (for future per-dataset overrides)
 * @returns {Object|null} Date range object with {from, to} or null if not configured
 */
export function getDateRange(datasetName = null) {
  const from = process.env.SYNC_DATE_RANGE_FROM;
  const to = process.env.SYNC_DATE_RANGE_TO;
  
  if (from && to) {
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) {
      console.warn(`⚠️  Invalid date format in environment variables. Expected YYYY-MM-DD format.`);
      return null;
    }
    
    // Validate from <= to
    if (from > to) {
      console.warn(`⚠️  SYNC_DATE_RANGE_FROM (${from}) is after SYNC_DATE_RANGE_TO (${to}). Ignoring environment date range.`);
      return null;
    }
    
    return { from, to };
  }
  
  // If only one is set, warn and ignore
  if (from || to) {
    console.warn(`⚠️  Both SYNC_DATE_RANGE_FROM and SYNC_DATE_RANGE_TO must be set to override date ranges. Ignoring partial configuration.`);
  }
  
  return null; // Use dataset default from sync.config.json
}

/**
 * Get the current environment name
 * @returns {string} Environment name (local, staging, production, etc.)
 */
export function getEnvironment() {
  return process.env.ENVIRONMENT || process.env.NODE_ENV || 'local';
}

/**
 * Apply date range overrides to dataset configuration
 * This modifies the dataset config in-place to apply environment variable overrides
 * 
 * @param {Object} datasetConfig - Dataset configuration from sync.config.json
 * @param {Object} envDateRange - Date range from environment variables {from, to}
 * @returns {Object} Modified dataset configuration
 */
export function overrideDatasetDateRange(datasetConfig, envDateRange) {
  if (!envDateRange || !datasetConfig) {
    return datasetConfig;
  }
  
  const modifiedConfig = JSON.parse(JSON.stringify(datasetConfig)); // Deep clone
  
  // Apply date range to all table filters and replace strategies
  if (modifiedConfig.tables) {
    Object.keys(modifiedConfig.tables).forEach(tableName => {
      const tableConfig = modifiedConfig.tables[tableName];
      
      // Override filters with 'between' operator
      if (tableConfig.filters) {
        tableConfig.filters.forEach(filter => {
          if (filter.operator === 'between') {
            filter.from = envDateRange.from;
            filter.to = envDateRange.to;
          }
        });
      }
      
      // Override replace strategy date ranges
      if (tableConfig.replace) {
        if (tableConfig.replace.from && tableConfig.replace.to) {
          tableConfig.replace.from = envDateRange.from;
          tableConfig.replace.to = envDateRange.to;
        }
      }
    });
  }
  
  return modifiedConfig;
}

/**
 * Check if environment variables are configured for date range override
 * @returns {boolean} True if both SYNC_DATE_RANGE_FROM and SYNC_DATE_RANGE_TO are set
 */
export function hasDateRangeOverride() {
  return !!(process.env.SYNC_DATE_RANGE_FROM && process.env.SYNC_DATE_RANGE_TO);
}

/**
 * Get date range configuration summary for logging
 * @returns {Object} Summary of date range configuration
 */
export function getDateRangeConfigSummary() {
  const env = getEnvironment();
  const hasOverride = hasDateRangeOverride();
  const dateRange = getDateRange();
  
  return {
    environment: env,
    hasOverride,
    dateRange: dateRange || 'using dataset defaults',
    source: hasOverride ? 'environment variables' : 'sync.config.json'
  };
}
