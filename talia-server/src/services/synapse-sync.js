import sql from 'mssql';
import { createRequire } from 'module';

import { supabaseDataService } from './supabase.js';
import { 
  syncReservationChanges,
  processReservationChangesBatch,
  loadReservationChangesCurrentState,
  insertReservationChanges,
  updateReservationChangesCurrentState
} from './reservation-changes-sync.js';
import { 
  processCompetitorBatch,
  loadCompetitorCurrentState,
  insertCompetitorChanges,
  updateCompetitorCurrentState
} from './competitor-sync.js';
import { 
  processPublishedRatesBatch,
  loadPublishedRatesCurrentState,
  insertPublishedRatesChanges,
  updatePublishedRatesCurrentState
} from './published-rates-sync.js';
import { SyncLogger } from './sync-logger.js';
import { SyncOperation } from './sync-operation.js';
import { SyncMetadataService } from './sync-metadata-service.js';
import { syncEventEmitter } from './sync-event-emitter.js';
import { getDateRange, getDateRangeConfigSummary } from '../config/date-range-config.js';
import { getSyncConfigNameForTable, getSyncTypeForTable } from '../config/table-mappings.js';

const require = createRequire(import.meta.url);
const syncConfig = require('../../sync.config.json');

/** When set to 1/true/yes/on, blocks all Synapse → Supabase sync (CLI, GraphQL, dataset runs). */
export function isSynapseSyncDisabled() {
  const v = (process.env.TALIA_SYNAPSE_SYNC_DISABLED || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

class SynapseSyncService {
  constructor() {
    this.synapseConfig = {
      server: process.env.AZURE_SYNAPSE_SERVER || 'celestyaldataplatform-prd.sql.azuresynapse.net',
      port: parseInt(process.env.AZURE_SYNAPSE_PORT) || 1433,
      database: process.env.AZURE_SYNAPSE_DATABASE || 'CDP_Dedicated_SQL_DWH',
      user: process.env.AZURE_SYNAPSE_USERNAME || 'RBryer',
      password: process.env.AZURE_SYNAPSE_PASSWORD || 'Cele5tyalrbUser!',
      requestTimeout: parseInt(process.env.AZURE_SYNAPSE_REQUEST_TIMEOUT || '300000'),
      options: {
        encrypt: true,
        trustServerCertificate: false,
        enableArithAbort: true
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 300000, // 5 minutes - keep connections alive during long syncs
        acquireTimeoutMillis: 60000 // 1 minute to acquire connection
      }
    };

    // Separate config for status checks - uses a smaller pool to avoid conflicts
    // Note: Each new ConnectionPool() creates a separate instance, so no need for a name
    this.statusCheckConfig = {
      ...this.synapseConfig,
      pool: {
        max: 1, // Status checks only need 1 connection
        min: 0,
        idleTimeoutMillis: 30000, // 30 seconds - shorter timeout for status checks
        acquireTimeoutMillis: 10000 // 10 seconds to acquire connection
      }
    };

    this.tableDefinitions = syncConfig.tables || {};
    this.datasets = syncConfig.datasets || {};
    this.defaultDataset = syncConfig.defaultDataset || Object.keys(this.datasets)[0] || null;

    if (!this.defaultDataset) {
      console.warn('⚠️  No default dataset defined in sync.config.json. Dataset must be provided explicitly.');
    }

    console.log('🔄 SynapseSyncService initialized');
    console.log(`📊 Default dataset: ${this.defaultDataset || 'none'}`);
    
    // Store active sync logs for real-time polling
    // Format: { tableName: { logger: SyncLogger, startTime: number, status: 'running'|'completed'|'failed' } }
    this.activeSyncs = new Map();
    
    // Separate connection pool for status checks (to avoid interfering with sync operations)
    this.statusCheckPool = null;
  }
  
  /**
   * Map sync.config.json table key (camelCase) to syncType (snake_case) for metadata
   * This ensures metadata uses consistent naming that matches tableSources.js
   */
  getSyncType(tableName) {
    return getSyncTypeForTable(tableName);
  }
  
  /**
   * Get current sync status and logs for a table
   * Returns null if no active sync
   * Can check by either UI table name (snake_case) or sync config name (camelCase)
   */
  getSyncStatus(tableName) {
    // Try direct lookup first
    let syncInfo = this.activeSyncs.get(tableName);
    
    // If not found, try mapped sync config key for UI table names.
    if (!syncInfo) {
      const syncConfigName = getSyncConfigNameForTable(tableName);
      if (syncConfigName) {
        syncInfo = this.activeSyncs.get(syncConfigName);
        if (syncInfo) {
          tableName = syncConfigName;
        }
      }
    }
    
    if (!syncInfo) {
      return null;
    }
    
    return {
      tableName,
      status: syncInfo.status,
      startTime: syncInfo.startTime,
      logs: syncInfo.logger.getLogs(),
      structuredLogs: syncInfo.logger.getStructuredLogs(),
      duration: syncInfo.logger.getDuration()
    };
  }
  
  /**
   * Clear completed sync from active syncs map
   */
  clearSyncStatus(tableName) {
    this.activeSyncs.delete(tableName);
  }

  listConfiguredTables() {
    return Object.entries(this.tableDefinitions).map(([name, definition]) => ({
      name,
      sourceTable: definition.source,
      targetTable: definition.target,
      type: definition.type || 'direct',
      description: definition.description || 'No description provided'
    }));
  }

  listDatasets() {
    return Object.entries(this.datasets).map(([name, dataset]) => ({
      name,
      description: dataset.description || 'No description provided',
      tables: dataset.tableSequence || Object.keys(dataset.tables || {}),
      isDefault: name === this.defaultDataset
    }));
  }

  getDefaultDataset() {
    return this.defaultDataset;
  }

  getDatasetConfig(datasetName = this.defaultDataset) {
    const dataset = this.datasets[datasetName];
    if (!dataset) {
      throw new Error(`Dataset "${datasetName}" is not defined in sync.config.json`);
    }
    return dataset;
  }

  getTableDefinition(tableName) {
    const definition = this.tableDefinitions[tableName];
    if (!definition) {
      throw new Error(`Table "${tableName}" is not defined in sync.config.json`);
    }
    return definition;
  }

  async testConnection() {
    console.log('🔍 Testing Azure Synapse connection...');
    console.log(`   Server: ${this.synapseConfig.server}`);
    console.log(`   Database: ${this.synapseConfig.database}`);
    console.log(`   User: ${this.synapseConfig.user}`);

    let pool = null;
    try {
      // Use separate pool to avoid interfering with active syncs
      pool = await this.createStatusCheckConnection();
      console.log('✅ Successfully connected to Azure Synapse');
      const result = await pool.request().query('SELECT 1 test');
      console.log(`✅ Test query successful: ${result.recordset[0].test}`);
      return true;
    } catch (error) {
      console.error('❌ Connection failed:', error.message);
      if (error.code) {
        console.error(`   Error code: ${error.code}`);
      }
      return false;
    } finally {
      if (pool) {
        try {
          await pool.close();
        } catch (closeError) {
          // Ignore close errors
        }
      }
    }
  }

  async testConnectionDetailed() {
    console.log('🔍 Testing Azure Synapse connection (detailed)...');
    console.log(`   Server: ${this.synapseConfig.server}`);
    console.log(`   Database: ${this.synapseConfig.database}`);
    console.log(`   User: ${this.synapseConfig.user}`);

    // Use the same connection method as actual syncs for consistency
    // This ensures the test behaves exactly like real sync operations
    return await this.testConnectionUsingSyncMethod();
  }

  /**
   * Enhance connection error messages for better user feedback
   * ONLY enhances actual connection errors - returns original message for other errors
   * Generic helper used by all sync methods
   */
  _enhanceConnectionError(error) {
    // If it's not a connection-related error, return the original message
    const isConnectionError = 
      error.code === 'ETIMEOUT' ||
      error.code === 'ESOCKET' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNRESET' ||
      error.message?.includes('Connection is closed') ||
      error.message?.includes('connection is closed') ||
      error.message?.includes('connection lost') ||
      error.message?.includes('Login failed') ||
      error.message?.includes('authentication failed') ||
      error.message?.includes('getaddrinfo') ||
      error.message?.includes('DNS') ||
      error.message?.includes('ENOTFOUND') ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('ETIMEOUT') ||
      error.message?.includes('ESOCKET');
    
    // Only enhance if it's actually a connection error
    if (!isConnectionError) {
      return error.message || 'Unknown error';
    }
    
    // Enhance connection errors with user-friendly messages
    if (error.message?.includes('Connection is closed') || 
        error.message?.includes('connection is closed') || 
        error.message?.includes('connection lost') ||
        error.code === 'ECONNRESET') {
      return 'Database connection closed during sync. Please check VPN connection and ensure Azure Synapse is accessible.';
    } else if (error.code === 'ETIMEOUT' || error.code === 'ESOCKET' || error.message?.includes('timeout')) {
      return 'Connection timeout during sync. Please check VPN connection and network settings.';
    } else if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
      return 'Connection refused. Please check VPN connection and ensure Azure Synapse is accessible.';
    } else if (error.code === 'ENOTFOUND' || error.message?.includes('ENOTFOUND')) {
      return 'Cannot resolve server address. Please check VPN connection.';
    } else if (error.message?.includes('Login failed') || error.message?.includes('authentication')) {
      return 'Authentication failed. Please check credentials.';
    } else if (error.message?.includes('getaddrinfo') || error.message?.includes('DNS')) {
      return 'DNS resolution failed. Please check VPN connection.';
    }
    
    // For other connection errors, return original message
    return error.message || 'Connection error occurred';
  }


  async createConnection() {
    try {
      // Use ConnectionPool directly instead of sql.connect() to avoid global singleton conflicts
      // This ensures each sync operation has its own independent connection pool
      // that won't be affected by status checks or other operations
      const pool = new sql.ConnectionPool(this.synapseConfig);
      await pool.connect();
      return pool;
    } catch (error) {
      console.error('❌ Failed to create connection:', error.message);
      if (error.code) {
        console.error(`   Error code: ${error.code}`);
      }
      
      // Use generic error enhancement helper
      const enhancedError = new Error(this._enhanceConnectionError(error));
      enhancedError.originalError = error;
      throw enhancedError;
    }
  }
  
  /**
   * Create a separate connection pool for status checks
   * This ensures status checks don't interfere with active sync operations
   * Uses ConnectionPool directly to avoid global singleton conflicts
   */
  async createStatusCheckConnection() {
    try {
      // Create a NEW ConnectionPool instance (not using sql.connect() which uses global singleton)
      // This ensures status checks use a completely separate pool from sync operations
      const pool = new sql.ConnectionPool(this.statusCheckConfig);
      await pool.connect();
      return pool;
    } catch (error) {
      console.error('❌ Failed to create status check connection:', error.message);
      throw error;
    }
  }

  /**
   * Test connection using a SEPARATE connection pool
   * This ensures status checks don't interfere with active sync operations
   */
  async testConnectionUsingSyncMethod() {
    let pool = null;
    try {
      // Use a SEPARATE connection pool for status checks
      // This prevents status checks from interfering with active sync operations
      pool = await this.createStatusCheckConnection();
      console.log('✅ Successfully connected to Azure Synapse (using sync method)');
      
      // Test query
      const result = await pool.request().query('SELECT 1 as test');
      console.log(`✅ Test query successful: ${result.recordset[0].test}`);
      
      return {
        online: true,
        error: null
      };
    } catch (error) {
      console.error('❌ Connection test failed:', error.message);
      if (error.code) {
        console.error(`   Error code: ${error.code}`);
      }
      
      // Use generic error enhancement helper for consistent error messages
      const userFriendlyMessage = this._enhanceConnectionError(error);
      
      return {
        online: false,
        error: userFriendlyMessage
      };
    } finally {
      // CRITICAL: Always close the status check connection pool
      // This prevents status checks from interfering with active sync operations
      if (pool) {
        try {
          await pool.close();
        } catch (closeError) {
          // Ignore close errors - connection may already be closed
        }
      }
    }
  }

  async executeQuery(query, pool = null) {
    let shouldClosePool = false;

    try {
      if (!pool) {
        pool = await this.createConnection();
        shouldClosePool = true;
      }

      console.log(`📊 Executing query: ${query.substring(0, 100)}...`);
      const result = await pool.request().query(query);
      console.log(`✅ Query executed successfully: ${result.recordset.length} rows returned`);

      return result;
    } catch (error) {
      console.error('❌ Query execution failed:', error.message);
      throw error;
    } finally {
      if (shouldClosePool && pool) {
        await pool.close();
      }
    }
  }

  buildWhereClause(filters = []) {
    if (!filters.length) {
      return '';
    }

    const clauses = filters.map(filter => {
      const column = filter.column;
      switch (filter.operator) {
        case 'between':
          return `${column} BETWEEN '${filter.from}' AND '${filter.to}'`;
        case 'gte':
          return `${column} >= '${filter.value}'`;
        case 'lte':
          return `${column} <= '${filter.value}'`;
        case 'equals':
          return `${column} = '${filter.value}'`;
        case 'in':
          return `${column} IN (${filter.values.map(v => `'${v}'`).join(', ')})`;
        case 'subquery':
          // Support subquery filters for JOIN-like operations
          // filter.subquery should be a SQL subquery string
          if (!filter.subquery) {
            throw new Error(`Subquery filter requires a "subquery" property`);
          }
          return `${column} IN (${filter.subquery})`;
        default:
          throw new Error(`Unsupported filter operator "${filter.operator}" for column ${column}`);
      }
    });

    return clauses.join(' AND ');
  }

  buildRuntimeConfig(tableName, datasetName = this.defaultDataset, runtimeOverrides = {}) {
    const definition = this.getTableDefinition(tableName);
    const dataset = this.getDatasetConfig(datasetName);
    const datasetTables = dataset.tables || {};
    const datasetOverrides = datasetTables[tableName] || {};

    const filters = [
      ...(definition.defaultFilters || []),
      ...(datasetOverrides.filters || [])
    ];

    let whereClause = this.buildWhereClause(filters);
    const columnsSql = definition.columns?.join(', ') || '*';
    let selectQuery = `SELECT ${columnsSql} FROM ${definition.source}${whereClause ? ` WHERE ${whereClause}` : ''}`;

    let replace = datasetOverrides.replace || definition.defaultReplace || null;

    let dateRange = null;
    if (replace?.from && replace?.to) {
      dateRange = { from: replace.from, to: replace.to };
    } else {
      const betweenFilter = filters.find(filter => filter.operator === 'between');
      if (betweenFilter?.from && betweenFilter?.to) {
        dateRange = { from: betweenFilter.from, to: betweenFilter.to };
      }
    }

    const isValidDateRange = (range) => {
      if (!range?.from || !range?.to) return false;
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      return dateRegex.test(range.from) && dateRegex.test(range.to) && range.from <= range.to;
    };

    const canApplyDateRangeOverride = () => {
      if (datasetOverrides.applyIntegrationDateRange === false) {
        return false;
      }
      const hasBetweenFilter = filters.some((filter) => (
        filter?.operator === 'between' && Boolean(filter?.column)
      ));
      const hasReplaceDateWindow = Boolean(replace?.from && replace?.to);
      const hasRuntimeDateColumn = Boolean(definition?.dateColumn || definition?.supabaseDateColumn);
      const hasSubqueryDateTemplate = filters.some((filter) => (
        filter?.operator === 'subquery'
        && typeof filter?.subquery === 'string'
        && (filter.subquery.includes('{{from}}') || filter.subquery.includes('{{to}}')
          || /\d{4}-\d{2}-\d{2}/.test(filter.subquery))
      ));
      return hasBetweenFilter || hasReplaceDateWindow || hasRuntimeDateColumn || hasSubqueryDateTemplate;
    };

    const rewriteSubqueryDates = (subquery, from, to) => {
      if (!subquery || typeof subquery !== 'string') return subquery;
      let next = subquery
        .replaceAll('{{from}}', from)
        .replaceAll('{{to}}', to);
      // Legacy hardcoded sail windows in subquery SQL → follow override/dataset range.
      next = next.replace(
        /(SAIL_DATE_FROM\s*>=\s*')(\d{4}-\d{2}-\d{2})(')/gi,
        `$1${from}$3`
      );
      next = next.replace(
        /(SAIL_DATE_FROM\s*<=\s*')(\d{4}-\d{2}-\d{2})(')/gi,
        `$1${to}$3`
      );
      return next;
    };

    const applyDateRangeOverride = (overrideRange, sourceLabel) => {
      if (!isValidDateRange(overrideRange)) {
        console.warn(`⚠️  Invalid date range override (${sourceLabel}). Ignoring.`);
        return false;
      }
      if (!canApplyDateRangeOverride()) {
        console.log(`ℹ️  Date range override (${sourceLabel}) skipped for ${tableName}; no date-capable sync window configured.`);
        return false;
      }
      dateRange = { from: overrideRange.from, to: overrideRange.to };
      filters.forEach(filter => {
        if (filter.operator === 'between') {
          filter.from = overrideRange.from;
          filter.to = overrideRange.to;
        }
        if (filter.operator === 'subquery' && filter.subquery) {
          filter.subquery = rewriteSubqueryDates(filter.subquery, overrideRange.from, overrideRange.to);
        }
      });
      if (replace && replace.from && replace.to) {
        replace.from = overrideRange.from;
        replace.to = overrideRange.to;
      }
      whereClause = this.buildWhereClause(filters);
      selectQuery = `SELECT ${columnsSql} FROM ${definition.source}${whereClause ? ` WHERE ${whereClause}` : ''}`;
      if (sourceLabel) {
        console.log(`📅 Date range override (${sourceLabel}): ${overrideRange.from} to ${overrideRange.to}`);
      }
      return true;
    };

    const uiOverrideApplied = runtimeOverrides?.dateRangeOverride
      ? applyDateRangeOverride(runtimeOverrides.dateRangeOverride, 'UI')
      : false;

    // Apply environment variable date range override if configured (highest precedence)
    const envDateRange = getDateRange(datasetName);
    if (envDateRange) {
      const configSummary = getDateRangeConfigSummary();
      const label = `environment (${configSummary.environment})`;
      applyDateRangeOverride(envDateRange, label);
    } else if (dateRange && !uiOverrideApplied) {
      // Using dataset default
      console.log(`📅 Date range from dataset config: ${dateRange.from} to ${dateRange.to}`);
    }

    // Resolve {{from}}/{{to}} subquery templates against the effective date range
    // (override path already rewrites; dataset-default path still needs substitution).
    if (dateRange?.from && dateRange?.to) {
      let subqueryTouched = false;
      filters.forEach((filter) => {
        if (filter.operator === 'subquery' && typeof filter.subquery === 'string'
          && (filter.subquery.includes('{{from}}') || filter.subquery.includes('{{to}}'))) {
          filter.subquery = rewriteSubqueryDates(filter.subquery, dateRange.from, dateRange.to);
          subqueryTouched = true;
        }
      });
      if (subqueryTouched) {
        whereClause = this.buildWhereClause(filters);
        selectQuery = `SELECT ${columnsSql} FROM ${definition.source}${whereClause ? ` WHERE ${whereClause}` : ''}`;
      }
    }

    return {
      tableName,
      datasetName,
      type: definition.type || 'direct',
      source: definition.source,
      targetTable: definition.target,
      columnsSql,
      whereClause,
      selectQuery,
      replace,
      definition,
      overrides: datasetOverrides,
      transformKey: definition.transformKey || tableName,
      isLargeDataset: Boolean(definition.isLargeDataset),
      rowNumberOrder: definition.rowNumberOrder || [],
      dateColumn: definition.dateColumn,
      supabaseDateColumn: definition.supabaseDateColumn,
      dateRange,
      uiOverrideApplied
    };
  }

  buildCountQuery(runtime) {
    return `SELECT COUNT(*) as total FROM ${runtime.source}${runtime.whereClause ? ` WHERE ${runtime.whereClause}` : ''}`;
  }

  buildRowNumberQuery(runtime) {
    const order = runtime.rowNumberOrder.length
      ? runtime.rowNumberOrder.join(', ')
      : '[Res_ID]';

    return `
      SELECT ${runtime.columnsSql}, ROW_NUMBER() OVER (ORDER BY ${order}) as rn
      FROM ${runtime.source}
      ${runtime.whereClause ? `WHERE ${runtime.whereClause}` : ''}
    `;
  }

  buildBatchQuery(runtime, offset, batchSize) {
    const rowNumberQuery = this.buildRowNumberQuery(runtime);
    return `
      SELECT *
      FROM (
        ${rowNumberQuery}
      ) AS numbered
      WHERE rn > ${offset} AND rn <= ${offset + batchSize}
      ORDER BY rn
    `;
  }

  async applyReplaceStrategy(runtime) {
    let replace = runtime.replace;
    if (!replace || replace.strategy === 'none') {
      console.log(`ℹ️  No replace strategy configured for ${runtime.targetTable}. Existing data will remain.`);
      return;
    }

    const table = runtime.targetTable;
    if (replace.strategy === 'delete-all' && runtime.uiOverrideApplied) {
      const column = replace.column || runtime.supabaseDateColumn || runtime.dateColumn;
      if (column && runtime.dateRange?.from && runtime.dateRange?.to) {
        replace = {
          ...replace,
          strategy: 'delete-range',
          column,
          from: runtime.dateRange.from,
          to: runtime.dateRange.to
        };
        console.log(`🛑 UI date range set; converting delete-all to delete-range on ${table} (${column})...`);
      } else {
        console.warn(`⚠️  UI date range set but no date column found for ${table}. Skipping delete-all to preserve historical data.`);
        return;
      }
    }

    console.log(`🗑️  Applying replace strategy (${replace.strategy}) on ${table}...`);

    switch (replace.strategy) {
      case 'delete-all': {
        const column = replace.column || 'id';
        const { error } = await supabaseDataService.client
          .from(table)
          .delete()
          .not(column, 'is', null);
        if (error) {
          throw new Error(`Failed to delete all rows from ${table}: ${error.message}`);
        }
        break;
      }
      case 'delete-range': {
        if (!replace.column || !replace.from || !replace.to) {
          throw new Error(`delete-range strategy for ${table} requires column, from, and to values`);
        }

        // If joinTable is specified, delete based on join relationship
        if (replace.joinTable && replace.joinColumn && replace.dateColumn) {
          // Use a more efficient approach: delete using a subquery-like filter
          // Instead of fetching all IDs and using .in(), we'll use a different strategy
          
          // Strategy: Delete in smaller batches by querying the join table in chunks
          // This avoids URI length limits
          const batchSize = 500; // Smaller batches to avoid URI limits
          let totalDeleted = 0;
          let offset = 0;
          let hasMore = true;

          while (hasMore) {
            // Get a batch of IDs from the join table
            const { data: joinData, error: joinError } = await supabaseDataService.client
              .from(replace.joinTable)
              .select(replace.joinColumn)
              .gte(replace.dateColumn, replace.from)
              .lte(replace.dateColumn, replace.to)
              .range(offset, offset + batchSize - 1);

            if (joinError) {
              throw new Error(`Failed to query join table ${replace.joinTable}: ${joinError.message}`);
            }

            if (!joinData || joinData.length === 0) {
              hasMore = false;
              break;
            }

            // Extract the IDs for this batch
            const ids = joinData.map(row => row[replace.joinColumn]).filter(Boolean);
            
            if (ids.length > 0) {
              // Delete this batch
              const { error } = await supabaseDataService.client
                .from(table)
                .delete()
                .in(replace.column, ids);
              
              if (error) {
                throw new Error(`Failed to delete rows in ${table} for batch ${Math.floor(offset / batchSize) + 1}: ${error.message}`);
              }
              
              totalDeleted += ids.length;
            }

            // Check if there are more records
            hasMore = joinData.length === batchSize;
            offset += batchSize;
          }
          
          console.log(`✅ Deleted ${totalDeleted} rows from ${table} based on join with ${replace.joinTable}`);
        } else {
          // Standard delete-range: delete directly by date column
          const { error } = await supabaseDataService.client
            .from(table)
            .delete()
            .gte(replace.column, replace.from)
            .lte(replace.column, replace.to);
          if (error) {
            throw new Error(`Failed to delete rows in ${table} between ${replace.from} and ${replace.to}: ${error.message}`);
          }
        }
        break;
      }
      default:
        throw new Error(`Unsupported replace strategy "${replace.strategy}" for table ${table}`);
    }

    console.log(`✅ Replace strategy applied on ${table}`);
  }

  transformData(transformKey, data, context = {}) {
    console.log(`🔄 Transforming ${data.length} records for ${transformKey}...`);
    const currentTime = new Date().toISOString();
    const getField = (row, keys, fallback = null) => {
      for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null) return row[key];
      }
      return fallback;
    };
    const toDateOnly = (value) => {
      if (!value) return null;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return null;
      return parsed.toISOString().split('T')[0];
    };
    const toNumber = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };

    switch (transformKey) {
      case 'ships':
        return data.map(row => ({
          ship_id: row.Ship_Id,
          ship_code: row.Ship_Code,
          ship_name: row.Ship_Name,
          ship_pax_capacity: row.Ship_Pax_Capacity,
          ship_length: row.Ship_Length,
          ship_tonnage: row.Ship_Tonnage,
          created_at: currentTime
        }));

      case 'agency':
        return data.map(row => ({
          parent_agency_id: toNumber(getField(row, ['Parent_Agency_Id', 'PARENT_AGENCY_ID'])),
          consortium_id: toNumber(getField(row, ['Consortium_Id', 'CONSORTIUM_ID'])),
          agency_id: toNumber(getField(row, ['Agency_Id', 'AGENCY_ID'])),
          agency_name: getField(row, ['Agency_Name', 'AGENCY_NAME']) || null,
          iata_number: getField(row, ['Iata_Number', 'IATA_NUMBER']) || null,
          clia_number: getField(row, ['Clia_Number', 'CLIA_NUMBER']) || null,
          is_domestic: getField(row, ['Is_Domestic', 'IS_DOMESTIC']) || null,
          is_internal: getField(row, ['Is_Internal', 'IS_INTERNAL']) || null,
          is_gsa: getField(row, ['Is_Gsa', 'IS_GSA']) || null,
          consortium_type: getField(row, ['Consortium_Type', 'CONSORTIUM_TYPE']) || null,
          is_consortium: getField(row, ['Is_Consortium', 'IS_CONSORTIUM']) || null,
          agency_type: getField(row, ['Agency_Type', 'AGENCY_TYPE']) || null,
          brand: getField(row, ['Brand', 'BRAND']) || null,
          default_currency: getField(row, ['Default_Currency', 'DEFAULT_CURRENCY']) || null,
          use_dflt_consortium: getField(row, ['Use_Dflt_Consortium', 'USE_DFLT_CONSORTIUM']) || null,
          bc_type_id: toNumber(getField(row, ['Bc_Type_Id', 'BC_TYPE_ID'])),
          taxpayer_type: getField(row, ['Taxpayer_Type', 'TAXPAYER_TYPE']) || null,
          taxpayer_number: getField(row, ['Taxpayer_Number', 'TAXPAYER_NUMBER']) || null,
          contact_name: getField(row, ['Contact_Name', 'CONTACT_NAME']) || null,
          web_address: getField(row, ['Web_Address', 'WEB_ADDRESS']) || null,
          office_code: getField(row, ['Office_Code', 'OFFICE_CODE']) || null,
          ag_entity_type: getField(row, ['Ag_Entity_Type', 'AG_ENTITY_TYPE']) || null,
          agency_code: getField(row, ['Agency_Code', 'AGENCY_CODE']) || null,
          fpr_at_gross: getField(row, ['Fpr_At_Gross', 'FPR_AT_GROSS']) || null,
          valid_currencies: getField(row, ['Valid_Currencies', 'VALID_CURRENCIES']) || null,
          market: getField(row, ['Market', 'MARKET']) || null,
          address_line1: getField(row, ['Address_Line1', 'ADDRESS_LINE1']) || null,
          address_city: getField(row, ['Address_City', 'ADDRESS_CITY']) || null,
          state_code: getField(row, ['State_Code', 'STATE_CODE']) || null,
          zip: getField(row, ['Zip', 'ZIP']) || null,
          country_code: getField(row, ['Country_Code', 'COUNTRY_CODE']) || null,
          country: getField(row, ['Country', 'COUNTRY']) || null,
          status: getField(row, ['Status', 'STATUS']) || null,
          sfdc_id: getField(row, ['Sfdc_Id', 'SFDC_ID']) || null,
          sfdc_parent_id: getField(row, ['Sfdc_Parent_Id', 'SFDC_PARENT_ID']) || null,
          sfdc_owner_id: getField(row, ['Sfdc_Owner_Id', 'SFDC_OWNER_ID']) || null,
          sfdc_owner_name: getField(row, ['Sfdc_Owner_Name', 'SFDC_OWNER_NAME']) || null,
          sfdc_cm_name: getField(row, ['Sfdc_Cm_Name', 'SFDC_CM_NAME']) || null,
          sfdc_vp_name: getField(row, ['Sfdc_Vp_Name', 'SFDC_VP_NAME']) || null,
          sfdc_id_link: getField(row, ['Sfdc_Id_Link', 'SFDC_ID_LINK']) || null,
          is_web: toNumber(getField(row, ['Is_Web', 'IS_WEB'])),
          commission: toNumber(getField(row, ['Commission', 'COMMISSION'])),
          inherit_parent_commission: toNumber(getField(row, ['Inherit_Parent_Commission', 'INHERIT_PARENT_COMMISSION'])),
          is_market_standard: toNumber(getField(row, ['Is_Market_Standard', 'IS_MARKET_STANDARD'])),
          created_at: currentTime
        }));

      case 'marketRollUp':
        return data.map(row => ({
          agency_market: getField(row, ['AGENCY_MARKET', 'Agency_Market']) || null,
          new_budget_roll_up: getField(row, ['NEW_BUDGET_ROLL_UP', 'New_Budget_Roll_Up']) || null,
          effective_from: getField(row, ['EFFECTIVE_FROM', 'Effective_From']) || null,
          effective_to: getField(row, ['EFFECTIVE_TO', 'Effective_To']) || null,
          active_record_flag: toNumber(getField(row, ['ACTIVE_RECORD_FLAG', 'Active_Record_Flag'])),
          created_at: currentTime
        }));

      case 'cabinCtg':
        return data.map(row => ({
          cabin_code: getField(row, ['CABIN', 'Cabin']) || null,
          generic_category: getField(row, ['GENERIC_CATEGORY', 'Generic_Category']) || null,
          effective_from: getField(row, ['EFFECTIVE_FROM', 'Effective_From']) || null,
          effective_to: getField(row, ['EFFECTIVE_TO', 'Effective_To']) || null,
          active_record_flag: toNumber(getField(row, ['ACTIVE_RECORD_FLAG', 'Active_Record_Flag'])),
          created_at: currentTime
        }));

      case 'budget':
        return data.map(row => ({
          passenger_type: getField(row, ['PASSENGER_TYPE', 'Passenger_Type']) || null,
          length: toNumber(getField(row, ['LENGTH', 'Length'])),
          itinerary_type: getField(row, ['ITINERARY_TYPE', 'Itinerary_Type']) || null,
          cabin: getField(row, ['CABIN', 'Cabin']) || null,
          market: getField(row, ['MARKET', 'Market']) || null,
          channel: getField(row, ['CHANNEL', 'Channel']) || null,
          new_market_roll_up: getField(row, ['NEW_MARKET_ROLL_UP', 'New_Market_Roll_Up']) || null,
          old_old_market_roll_up: getField(row, ['OLD_OLD_MARKET_ROLL_UP', 'Old_Old_Market_Roll_Up']) || null,
          accounting_month: getField(row, ['ACCOUNTING_MONTH', 'Accounting_Month']) || null,
          master_voyage: getField(row, ['MASTER_VOYAGE', 'Master_Voyage']) || null,
          master_departure_date: getField(row, ['MASTER_DEPARTURE_DATE', 'Master_Departure_Date']) || null,
          passengers: toNumber(getField(row, ['PASSENGERS', 'Passengers'])),
          passenger_nights: toNumber(getField(row, ['PASSENGER_NIGHTS', 'Passenger_Nights'])),
          currency: getField(row, ['CURRENCY', 'Currency']) || null,
          fx_1: toNumber(getField(row, ['FX.1', 'FX_1', 'Fx_1'])),
          pppd: toNumber(getField(row, ['PPPD', 'Pppd'])),
          pppd_eur: toNumber(getField(row, ['PPPD_EUR', 'Pppd_Eur'])),
          gross_ticket_revenue_local: toNumber(getField(row, ['GROSS_TICKET_REVENUE_LOCAL', 'Gross_Ticket_Revenue_Local'])),
          gross_ticket_revenue_eur: toNumber(getField(row, ['GROSS_TICKET_REVENUE_EUR', 'Gross_Ticket_Revenue_Eur'])),
          pre_emb_pppd: toNumber(getField(row, ['PRE-EMB_PPPD', 'PRE_EMB_PPPD', 'Pre_Emb_Pppd'])),
          pre_emb_revenue_eur: toNumber(getField(row, ['PRE_EMB_REVENUE_EUR', 'Pre_Emb_Revenue_Eur'])),
          fy: toNumber(getField(row, ['FY', 'Fy'])),
          budget_name: getField(row, ['BUDGET_NAME', 'Budget_Name']) || null,
          version: getField(row, ['VERSION', 'Version']) || null,
          unique_id: getField(row, ['UNIQUE_ID', 'Unique_Id']) || null,
          actuals_code: getField(row, ['ACTUALS_CODE', 'Actuals_Code']) || null,
          effective_from: getField(row, ['EFFECTIVE_FROM', 'Effective_From']) || null,
          effective_to: getField(row, ['EFFECTIVE_TO', 'Effective_To']) || null,
          active_record_flag: toNumber(getField(row, ['ACTIVE_RECORD_FLAG', 'Active_Record_Flag'])),
          created_at: currentTime
        }));

      case 'etlTableParameters':
        return data.map(row => ({
          etl_id: toNumber(getField(row, ['id', 'ID', 'Id'])),
          source_schema: getField(row, ['source_schema', 'SOURCE_SCHEMA', 'Source_Schema']) || null,
          source_tablename: getField(row, ['source_tablename', 'SOURCE_TABLENAME', 'Source_Tablename']) || null,
          target_schema: getField(row, ['target_schema', 'TARGET_SCHEMA', 'Target_Schema']) || null,
          target_tablename: getField(row, ['target_tablename', 'TARGET_TABLENAME', 'Target_Tablename']) || null,
          schema_overwrite_flag: getField(row, ['schema_overwrite_flag', 'SCHEMA_OVERWRITE_FLAG', 'Schema_Overwrite_Flag']) || null,
          load_type: getField(row, ['load_type', 'LOAD_TYPE', 'Load_Type']) || null,
          upsert_id: getField(row, ['upsert_id', 'UPSERT_ID', 'Upsert_Id']) || null,
          storeproc: getField(row, ['storeproc', 'STOREPROC', 'Storeproc']) || null,
          sp_flag: getField(row, ['sp_flag', 'SP_FLAG', 'Sp_Flag']) || null,
          created_at: currentTime
        }));

      case 'shipInventoryAlloc':
        return data.map(row => ({
          allocation_id: toNumber(getField(row, ['ALLOCATION_ID', 'Allocation_Id'])),
          allocation_owner_type: getField(row, ['ALLOCATION_OWNER_TYPE', 'Allocation_Owner_Type']) || null,
          allocation_owner_id: toNumber(getField(row, ['ALLOCATION_OWNER_ID', 'Allocation_Owner_Id'])),
          ship_code: getField(row, ['SHIP_CODE', 'Ship_Code']) || null,
          sail_date_from: toDateOnly(getField(row, ['SAIL_DATE_FROM', 'Sail_Date_From'])),
          sail_date_to: toDateOnly(getField(row, ['SAIL_DATE_TO', 'Sail_Date_To'])),
          cabin_category: getField(row, ['CABIN_CATEGORY', 'Cabin_Category']) || null,
          cabin_number: getField(row, ['CABIN_NUMBER', 'Cabin_Number']) || null,
          berth_number: getField(row, ['BERTH_NUMBER', 'Berth_Number']) != null
            ? String(getField(row, ['BERTH_NUMBER', 'Berth_Number']))
            : null,
          occupancy: toNumber(getField(row, ['OCCUPANCY', 'Occupancy'])),
          price_category: getField(row, ['PRICE_CATEGORY', 'Price_Category']) || null,
          inventory_request_type: getField(row, ['INVENTORY_REQUEST_TYPE', 'Inventory_Request_Type']) || null,
          inventory_result_type: getField(row, ['INVENTORY_RESULT_TYPE', 'Inventory_Result_Type']) || null,
          probability: toNumber(getField(row, ['PROBABILITY', 'Probability'])),
          is_soft_assign: getField(row, ['IS_SOFT_ASSIGN', 'Is_Soft_Assign']) != null
            ? String(getField(row, ['IS_SOFT_ASSIGN', 'Is_Soft_Assign']))
            : null,
          release_timestamp: getField(row, ['RELEASE_TIMESTAMP', 'Release_Timestamp']) || null,
          dlgt_res_id: toNumber(getField(row, ['DLGT_RES_ID', 'Dlgt_Res_Id'])),
          allocation_timestamp: getField(row, ['ALLOCATION_TIMESTAMP', 'Allocation_Timestamp']) || null,
          created_at: currentTime
        }));

      case 'shipCabin':
        return data.map(row => ({
          ship_code: getField(row, ['SHIP_CODE', 'Ship_Code']) || null,
          cabin_number: getField(row, ['CABIN_NUMBER', 'Cabin_Number']) != null
            ? String(getField(row, ['CABIN_NUMBER', 'Cabin_Number']))
            : null,
          cabin_id: toNumber(getField(row, ['CABIN_ID', 'Cabin_Id'])),
          deck_number: toNumber(getField(row, ['DECK_NUMBER', 'Deck_Number'])),
          cabin_name: getField(row, ['CABIN_NAME', 'Cabin_Name']) || null,
          comments: getField(row, ['COMMENTS', 'Comments']) || null,
          image_id: toNumber(getField(row, ['IMAGE_ID', 'Image_Id'])),
          cabin_rank: toNumber(getField(row, ['CABIN_RANK', 'Cabin_Rank'])),
          firezone_code: getField(row, ['FIREZONE_CODE', 'Firezone_Code']) || null,
          ext_cabin_id: toNumber(getField(row, ['EXT_CABIN_ID', 'Ext_Cabin_Id'])),
          record_added_manually: getField(row, ['RECORD_ADDED_MANUALLY', 'Record_Added_Manually']) || null,
          effective_from: getField(row, ['EFFECTIVE_FROM', 'Effective_From']) || null,
          effective_to: getField(row, ['EFFECTIVE_TO', 'Effective_To']) || null,
          active_record_flag: toNumber(getField(row, ['ACTIVE_RECORD_FLAG', 'Active_Record_Flag'])),
          created_at: currentTime
        }));

      case 'shipCabinCtgLink':
        // Physical inventory only — do not map ACCOUNT_NUMBER or other commercial/PII fields.
        return data.map(row => ({
          record_id: toNumber(getField(row, ['RECORD_ID', 'Record_Id'])),
          ship_code: getField(row, ['SHIP_CODE', 'Ship_Code']) || null,
          cabin_number: getField(row, ['CABIN_NUMBER', 'Cabin_Number']) != null
            ? String(getField(row, ['CABIN_NUMBER', 'Cabin_Number']))
            : null,
          cabin_category: getField(row, ['CABIN_CATEGORY', 'Cabin_Category']) || null,
          eff_sail_from: toDateOnly(getField(row, ['EFF_SAIL_FROM', 'Eff_Sail_From'])),
          eff_sail_to: toDateOnly(getField(row, ['EFF_SAIL_TO', 'Eff_Sail_To'])),
          rollaway_beds: toNumber(getField(row, ['ROLLAWAY_BEDS', 'Rollaway_Beds'])),
          cabin_capacity: toNumber(getField(row, ['CABIN_CAPACITY', 'Cabin_Capacity'])),
          is_active: getField(row, ['IS_ACTIVE', 'Is_Active']) != null
            ? String(getField(row, ['IS_ACTIVE', 'Is_Active']))
            : null,
          child_beds: toNumber(getField(row, ['CHILD_BEDS', 'Child_Beds'])),
          effective_from: getField(row, ['EFFECTIVE_FROM', 'Effective_From']) || null,
          effective_to: getField(row, ['EFFECTIVE_TO', 'Effective_To']) || null,
          active_record_flag: toNumber(getField(row, ['ACTIVE_RECORD_FLAG', 'Active_Record_Flag'])),
          created_at: currentTime
        }));

      case 'shipCabinReserve':
        // Offsale / reserved cabins (STG only for now — capacity reporting).
        return data.map(row => ({
          record_id: toNumber(getField(row, ['RECORD_ID', 'Record_Id'])),
          ship_code: getField(row, ['SHIP_CODE', 'Ship_Code']) || null,
          cabin_number: getField(row, ['CABIN_NUMBER', 'Cabin_Number']) != null
            ? String(getField(row, ['CABIN_NUMBER', 'Cabin_Number']))
            : null,
          rel_day_from: toNumber(getField(row, ['REL_DAY_FROM', 'Rel_Day_From'])),
          rel_day_to: toNumber(getField(row, ['REL_DAY_TO', 'Rel_Day_To'])),
          sail_date_from: toDateOnly(getField(row, ['SAIL_DATE_FROM', 'Sail_Date_From'])),
          sail_date_to: toDateOnly(getField(row, ['SAIL_DATE_TO', 'Sail_Date_To'])),
          reserve_type: getField(row, ['RESERVE_TYPE', 'Reserve_Type']) || null,
          comments: getField(row, ['COMMENTS', 'Comments']) || null,
          guest_count: toNumber(getField(row, ['GUEST_COUNT', 'Guest_Count'])),
          dep_ref_id: toNumber(getField(row, ['DEP_REF_ID', 'Dep_Ref_Id'])),
          arr_ref_id: toNumber(getField(row, ['ARR_REF_ID', 'Arr_Ref_Id'])),
          allow_segments: getField(row, ['ALLOW_SEGMENTS', 'Allow_Segments']) != null
            ? String(getField(row, ['ALLOW_SEGMENTS', 'Allow_Segments']))
            : null,
          created_at: currentTime
        }));

      case 'cabinAvailability':
        return data.map(row => ({
          snapshot_date: row.Snapshot_Date,
          sail_code: row.Sail_Code,
          package_name: row.Package_Name,
          sail_days: row.Sail_Days,
          cabin_category: row.Cabin_Category,
          available_cabins: row.Available_Cabins,
          total_cabins: row.Total_Cabins,
          available_absolute: row.Available_Absolute,
          available_weighted: row.Available_Weighted,
          availability_result: row.Availability_Result,
          nested_cabins: row.Nested_Cabins,
          created_at: currentTime
        }));

      case 'reservations':
        return data.map(row => {
          const enrichment = context.reservationEnrichmentMap?.get(getField(row, ['RES_ID', 'Res_ID'])) || {};
          // RES_HEADER rarely carries ticket revenue — prefer Fact_Reservation enrichment when header is empty.
          const coalesceNum = (headerVal, enrichVal) => {
            const fromHeader = toNumber(headerVal);
            if (fromHeader != null) return fromHeader;
            return enrichVal != null ? Number(enrichVal) : null;
          };
          // RES_HEADER PROBABILITY is often stuck at 100 — prefer Fact_Reservation when present.
          const preferFactProb = (headerVal, enrichVal) => {
            if (enrichVal != null && Number.isFinite(Number(enrichVal))) return Number(enrichVal);
            return toNumber(headerVal);
          };
          return {
          res_id: getField(row, ['RES_ID', 'Res_ID']),
          res_status: getField(row, ['RES_STATUS', 'Res_Status']) || null,
          source_code: getField(row, ['SOURCE_CODE', 'Source_Code']) || null,
          res_probability: preferFactProb(
            getField(row, ['PROBABILITY', 'Res_Probability']),
            enrichment.res_probability
          ),
          group_probability: enrichment.group_probability != null
            ? Number(enrichment.group_probability)
            : toNumber(getField(row, ['GROUP_PROBABILITY', 'Group_Probability'])),
          group_id: toNumber(getField(row, ['GROUP_ID', 'Group_ID']))
            ?? (enrichment.group_id != null ? Number(enrichment.group_id) : null),
          source_origin: 'res_header',
          pax_type: getField(row, ['PAX_TYPE', 'Pax_Type']) || enrichment.pax_type || null,
          pax_status: getField(row, ['PAX_STATUS', 'Pax_Status']) || enrichment.pax_status || null,
          ship: getField(row, ['SHIP_CODE', 'Ship']) || null,
          sail_code: getField(row, ['SAIL_CODE', 'Sail_code']) || enrichment.sail_code || null,
          sail_duration: toNumber(getField(row, ['SAIL_DURATION', 'Sail_Duration'])) ?? enrichment.sail_duration ?? (
            getField(row, ['SAIL_DATE_FROM', 'Sail_From_Date']) && getField(row, ['SAIL_DATE_TO', 'Sail_To_Date'])
              ? Math.max(0, Math.round(
                (new Date(getField(row, ['SAIL_DATE_TO', 'Sail_To_Date'])).getTime() - new Date(getField(row, ['SAIL_DATE_FROM', 'Sail_From_Date'])).getTime())
                / (1000 * 60 * 60 * 24)
              ))
              : null
          ),
          sail_from_date: toDateOnly(getField(row, ['SAIL_DATE_FROM', 'Sail_From_Date'])),
          sail_to_date: toDateOnly(getField(row, ['SAIL_DATE_TO', 'Sail_To_Date'])),
          agency_id: toNumber(getField(row, ['AGENCY_ID', 'Agency_ID'])),
          sec_agency_id: toNumber(getField(row, ['SEC_AGENCY_ID', 'Sec_Agency_ID'])),
          agency_channel: getField(row, ['AGENCY_CHANNEL', 'Agency_Channel']) || null,
          agency_country_code: getField(row, ['AGENCY_COUNTRY_CODE', 'Agency_Country_Code']) || null,
          agency_market: getField(row, ['AGENCY_MARKET', 'Agency_Market']) || null,
          cabin_type: getField(row, ['CABIN_TYPE', 'Cabin_Type']) || null,
          cabin_category: getField(row, ['CABIN_CATEGORY', 'Cabin_Category']) || null,
          ticket_type: getField(row, ['TICKET_TYPE', 'Ticket_Type']) || null,
          promo_code: getField(row, ['PROMO_CODE', 'Promo_Code']) || null,
          currency: getField(row, ['CURRENCY_CODE', 'Currency']) || null,
          currency_rate: toNumber(getField(row, ['CURRENCY_RATE', 'Currency_Rate'])),
          guest_count: toNumber(getField(row, ['RES_GUEST_COUNT', 'Guest_Count'])),
          foc_guest_count: toNumber(getField(row, ['FOC_GUEST_COUNT', 'FOC_Guest_Count'])),
          res_init_date: toDateOnly(getField(row, ['RES_INIT_DATE', 'Res_Init_Date'])),
          original_init_date: toDateOnly(getField(row, ['ORIGINAL_INIT_DATE', 'Original_Init_Date'])),
          gross_published_fare: toNumber(getField(row, ['GROSS_PUBLISHED_FARE', 'GrossPublishedFare'])),
          gross_selling_fare: toNumber(getField(row, ['GROSS_SELLING_FARE', 'GrossSellingFare'])),
          net_selling_fare: toNumber(getField(row, ['NET_SELLING_FARE', 'NetSellingFare'])),
          cruise_fare_comm: toNumber(getField(row, ['CRUISE_FARE_COMM', 'CruiseFareComm'])),
          published_discount: toNumber(getField(row, ['PUBLISHED_DISCOUNT', 'PublishedDiscount'])),
          promotional_discounts: toNumber(getField(row, ['PROMOTIONAL_DISCOUNTS', 'PromotionalDiscounts'])),
          total_discounts: toNumber(getField(row, ['TOTAL_DISCOUNTS', 'TotalDiscounts'])),
          gross_ticket_revenue: coalesceNum(getField(row, ['GROSS_TICKET_REVENUE', 'GrossTicketRevenue']), enrichment.gross_ticket_revenue),
          net_ticket_revenue: coalesceNum(getField(row, ['NET_TICKET_REVENUE', 'NetTicketRevenue']), enrichment.net_ticket_revenue),
          net_invoice_revenue: coalesceNum(getField(row, ['NET_INVOICE_REVENUE', 'NetInvoiceRevenue']), enrichment.net_invoice_revenue),
          gross_ticket_revenue_eur: coalesceNum(getField(row, ['GROSS_TICKET_REVENUE_EUR', 'GrossTicketRevenueEUR']), enrichment.gross_ticket_revenue_eur),
          net_ticket_revenue_eur: coalesceNum(getField(row, ['NET_TICKET_REVENUE_EUR', 'NetTicketRevenueEUR']), enrichment.net_ticket_revenue_eur),
          net_invoice_revenue_eur: coalesceNum(getField(row, ['NET_INVOICE_REVENUE_EUR', 'NetInvoiceRevenueEUR']), enrichment.net_invoice_revenue_eur),
          total_discounts_eur: coalesceNum(getField(row, ['TOTAL_DISCOUNTS_EUR', 'TotalDiscountsEUR']), enrichment.total_discounts_eur),
          created_at: currentTime
        };
        });

      case 'publishedRates':
        return data.map(row => ({
          snapshot_date: row.SNAPSHOT_DATE,
          sail_code: row.SAIL_CODE,
          ship_code: row.SHIP_CODE,
          package_name: row.PACKAGE_NAME,
          region: row.REGION,
          rate_type: row.RATE_TYPE,
          sail_days: row.SAIL_DAYS,
          departure_date: row.DEPARTURE_DATE,
          cabin_category: row.CABIN_CATEGORY,
          promo_name: row.PROMO_NAME,
          promo_type: row.PROMO_TYPE,
          currency_code: row.CURRENCY_CODE,
          fare_per_person: row.FARE_PER_PERSON,
          port_taxes_services: row.PORT_TAXES_SERVICES,
          extra_adult: row.EXTRA_ADULT,
          extra_child: row.EXTRA_CHILD,
          discount: row.DISCOUNT,
          created_at: currentTime
        }));

      case 'sailByCabinOccupancy':
        return data.map(row => ({
          sail_id: row.Sail_ID,
          sail_code: row.Sail_Code,
          sail_days: row.Sail_Days,
          sail_date_from: row.Sail_Date_From,
          master_voyage: row.Master_Voyage,
          sail_itinerary_date: row.Sail_Itinerary_Date,
          sail_itinerary_night: row.Sail_Itinerary_Night,
          port_code: row.Port_Code,
          ship_code: row.Ship_Code,
          ship_name: row.Ship_name,
          package_type: row.Package_Type,
          package_name: row.Package_Name,
          geog_area_code: row.Geog_Area_Code,
          season_code: row.Season_Code,
          is_fake: row.IS_Fake,
          is_active: row.IS_Active,
          is_package_active: row.IS_Package_Active,
          cabin_category: row.Cabin_Category,
          cabin_capacity: row.Cabin_Capacity,
          total_cabins: row.Total_Cabins,
          occupied_cabins: row.Occupied_Cabins,
          remaining_cabins: row.Remaining_Cabins,
          created_at: currentTime
        }));

      case 'masterSail':
        return data.map(row => ({
          sail_id: row.Sail_ID,
          ship_code: row.Ship_Code,
          ship_name: row.Ship_Name,
          sail_date_from: row.Sail_Date_From,
          port_from: row.Port_From,
          sail_date_to: row.Sail_Date_To,
          port_to: row.Port_To,
          package_id: row.Package_ID,
          package_type: row.Package_Type,
          sail_code: row.Sail_Code,
          package_name: row.Package_Name,
          sail_days: row.Sail_Days,
          geog_area_code: row.Geog_Area_Code,
          vacation_date: row.Vacation_Date,
          season_code: row.Season_Code,
          is_fake: row.IS_Fake,
          is_active: row.IS_Active,
          is_package_active: row.IS_Package_Active,
          master_voyage_departure_date: row.Master_Voyage_Departure_Date,
          master_voyage1: row.Master_Voyage1,
          master_voyage1_length: row.Master_Voyage1_Length,
          master_voyage1_sail_days: row.Master_Voyage1_Sail_Days,
          master_voyage2: row.Master_Voyage2,
          master_voyage2_length: row.Master_Voyage2_Length,
          master_voyage2_sail_days: row.Master_Voyage2_Sail_Days,
          is_main: row.IS_Main,
          is_primary: row.IS_Primary,
          created_at: currentTime
        }));

      case 'reservationPromotion':
        return data.map(row => ({
          res_promo_id: row.RES_PROMO_ID ? parseFloat(row.RES_PROMO_ID) : null,
          res_id: row.RES_ID ? parseFloat(row.RES_ID) : null,
          guest_id: row.GUEST_ID ? parseFloat(row.GUEST_ID) : null,
          promo_code: row.PROMO_CODE || null,
          is_excluded: row.IS_EXCLUDED || null,
          is_active: row.IS_ACTIVE || null,
          res_package_id: row.RES_PACKAGE_ID ? parseFloat(row.RES_PACKAGE_ID) : null,
          is_manual: row.IS_MANUAL || null,
          promo_value: row.PROMO_VALUE ? parseFloat(row.PROMO_VALUE) : null,
          promo_value_type: row.PROMO_VALUE_TYPE || null,
          is_static: row.IS_STATIC || null,
          created_at: currentTime
        }));

      default:
        console.warn(`⚠️  No transformation defined for key: ${transformKey}`);
        return data;
    }
  }

  async loadReservationFoundationEnrichment(pool, resIds = []) {
    const enrichment = new Map();
    const normalizedResIds = [...new Set((resIds || []).map(id => Number(id)).filter(Number.isFinite))];
    if (!normalizedResIds.length) {
      return enrichment;
    }

    // Current state from dwh.Fact_Reservation (not Fact_Reservation_daily — unreliable).
    // Weekly history lives in dwh.Fact_Reservation_History (WC_Snapshot_Date = Monday).
    const chunkSize = 2000;
    for (let i = 0; i < normalizedResIds.length; i += chunkSize) {
      const chunk = normalizedResIds.slice(i, i + chunkSize);
      const inClause = chunk.join(', ');
      const query = `
        SELECT
          fr.Res_ID,
          fr.Sail_code,
          fr.Sail_Duration,
          fr.Pax_Type,
          fr.Pax_Status,
          fr.Res_Probability,
          fr.Group_Probability,
          fr.Group_ID,
          fr.GrossTicketRevenue,
          fr.NetTicketRevenue,
          fr.NetInvoiceRevenue,
          fr.GrossTicketRevenueEUR,
          fr.NetTicketRevenueEUR,
          fr.NetInvoiceRevenueEUR,
          fr.TotalDiscountsEUR
        FROM dwh.Fact_Reservation fr
        WHERE fr.Res_ID IN (${inClause})
      `;

      const result = await pool.request().query(query);
      for (const row of result.recordset || []) {
        if (!row?.Res_ID) continue;
        enrichment.set(Number(row.Res_ID), {
          sail_code: row.Sail_code || null,
          sail_duration: row.Sail_Duration != null ? Number(row.Sail_Duration) : null,
          pax_type: row.Pax_Type || null,
          pax_status: row.Pax_Status || null,
          res_probability: row.Res_Probability != null ? Number(row.Res_Probability) : null,
          group_probability: row.Group_Probability != null ? Number(row.Group_Probability) : null,
          group_id: row.Group_ID != null ? Number(row.Group_ID) : null,
          gross_ticket_revenue: row.GrossTicketRevenue != null ? Number(row.GrossTicketRevenue) : null,
          net_ticket_revenue: row.NetTicketRevenue != null ? Number(row.NetTicketRevenue) : null,
          net_invoice_revenue: row.NetInvoiceRevenue != null ? Number(row.NetInvoiceRevenue) : null,
          gross_ticket_revenue_eur: row.GrossTicketRevenueEUR != null ? Number(row.GrossTicketRevenueEUR) : null,
          net_ticket_revenue_eur: row.NetTicketRevenueEUR != null ? Number(row.NetTicketRevenueEUR) : null,
          net_invoice_revenue_eur: row.NetInvoiceRevenueEUR != null ? Number(row.NetInvoiceRevenueEUR) : null,
          total_discounts_eur: row.TotalDiscountsEUR != null ? Number(row.TotalDiscountsEUR) : null,
        });
      }
    }

    return enrichment;
  }

  async insertData(tableName, data, logger = null) {
    try {
      logger?.info(`📥 Inserting ${data.length} records into ${tableName}...`);

      const batchSize = 1000;
      let insertedCount = 0;

      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);

        const { error } = await supabaseDataService.client
          .from(tableName)
          .insert(batch);

        if (error) throw error;

        insertedCount += batch.length;
        logger?.info(`   📊 Inserted ${insertedCount}/${data.length} records...`);
      }

      logger?.info(`✅ Successfully inserted ${insertedCount} records into ${tableName}`);
    } catch (error) {
      logger?.error(`❌ Failed to insert into ${tableName}:`, error.message);
      throw error;
    }
  }

  async syncSmallTable(runtime, logger) {
    const startTime = Date.now();
    let pool = null;

    try {
      pool = await this.createConnection();
      logger?.info(`✅ Connected to Synapse for ${runtime.tableName}`);

      // Execute query with retry logic for connection errors
      let rawData;
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries) {
        try {
          // Check connection health before query
          try {
            await pool.request().query('SELECT 1 as health_check');
          } catch (healthError) {
            logger?.warn(`⚠️  Connection unhealthy before query, reconnecting...`);
            if (pool) {
              try {
                await pool.close();
              } catch (closeError) {
                // Ignore
              }
            }
            pool = await this.createConnection();
            logger?.info(`✅ Reconnected to Synapse`);
          }
          
          const result = await pool.request().query(runtime.selectQuery);
          rawData = result.recordset;
          break; // Success - exit retry loop
        } catch (queryError) {
          const isConnectionError = queryError.code === 'ECONNCLOSED' || 
                                   queryError.message?.includes('Connection is closed') ||
                                   queryError.message?.includes('connection is closed');
          
          if (isConnectionError && retryCount < maxRetries) {
            retryCount++;
            logger?.warn(`⚠️  Connection closed during query (attempt ${retryCount}/${maxRetries}), reconnecting...`);
            
            try {
              if (pool) {
                try {
                  await pool.close();
                } catch (closeError) {
                  // Ignore
                }
              }
              pool = await this.createConnection();
              logger?.info(`✅ Reconnected to Synapse, retrying query (attempt ${retryCount})...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            } catch (reconnectError) {
              logger?.error(`❌ Failed to reconnect:`, reconnectError.message);
              if (retryCount >= maxRetries) {
                throw queryError;
              }
              continue;
            }
          } else {
            throw queryError;
          }
        }
      }
      
      if (!rawData) {
        throw new Error(`Failed to execute query after ${maxRetries} retries`);
      }

      if (rawData.length === 0) {
        logger?.warn(`⚠️  No data found for ${runtime.tableName} with current constraints`);
        const duration = Date.now() - startTime;
        
        // Emit progress event for empty result
        if (logger?.tableName && logger?.eventEmitter) {
          syncEventEmitter.emitProgress(logger.tableName, {
            current: 0,
            total: 0,
            percentage: 100,
            type: 'complete',
            message: 'No data found with current constraints'
          });
        }
        
        // Update sync metadata using SyncMetadataService (consistent with derived tables)
        // Direct tables don't have snapshot dates, so pass null
        // Use getSyncType to map camelCase tableName to snake_case syncType
        await SyncMetadataService.updateSyncMetadata(
          supabaseDataService.client,
          this.getSyncType(runtime.tableName),
          null, // lastProcessedSnapshotDate - direct tables don't have snapshots
          null, // latestAvailableSnapshotDate - direct tables don't have snapshots
          0, // recordsProcessed
          0, // changesDetected - direct tables don't track changes
          duration,
          runtime.datasetName
        );
        return {
          tableName: runtime.tableName,
          success: true,
          recordsProcessed: 0,
          duration,
          message: 'No data found with current constraints'
        };
      }

      const totalRecords = rawData.length;
      logger?.info(`📥 Fetched ${totalRecords.toLocaleString()} records from Synapse`);
      
      // Emit initial progress event
      if (logger?.tableName && logger?.eventEmitter) {
        syncEventEmitter.emitProgress(logger.tableName, {
          current: 0,
          total: totalRecords,
          percentage: 0,
          type: 'records',
          message: `Found ${totalRecords.toLocaleString()} records to process`
        });
      }

      let transformContext = {};
      if (runtime.transformKey === 'reservations' && !String(runtime.source || '').toLowerCase().includes('fact_reservation_daily')) {
        const resIds = rawData.map(row => row.RES_ID).filter(Boolean);
        transformContext = {
          reservationEnrichmentMap: await this.loadReservationFoundationEnrichment(pool, resIds)
        };
        logger?.info(`📌 Loaded fou enrichment for ${transformContext.reservationEnrichmentMap.size.toLocaleString()} reservations`);
      }

      const transformedData = this.transformData(runtime.transformKey, rawData, transformContext);
      logger?.info(`🔄 Transformed ${transformedData.length} records`);
      
      // Emit progress for transformation
      if (logger?.tableName && logger?.eventEmitter) {
        syncEventEmitter.emitProgress(logger.tableName, {
          current: totalRecords,
          total: totalRecords,
          percentage: 50,
          type: 'records',
          message: `Transformed ${transformedData.length.toLocaleString()} records`
        });
      }

      await this.applyReplaceStrategy(runtime);

      await this.insertData(runtime.targetTable, transformedData, logger);
      
      // Emit progress for insertion completion
      if (logger?.tableName && logger?.eventEmitter) {
        syncEventEmitter.emitProgress(logger.tableName, {
          current: transformedData.length,
          total: transformedData.length,
          percentage: 100,
          type: 'complete',
          message: `Successfully synced ${transformedData.length.toLocaleString()} records`
        });
      }

      const duration = Date.now() - startTime;
      // Logger automatically emits events via eventEmitter
      logger?.info(`✅ Sync completed for ${runtime.tableName} in ${duration}ms`);

      // Update sync metadata using SyncMetadataService (consistent with derived tables)
      // Direct tables don't have snapshot dates, so pass null
      // Use getSyncType to map camelCase tableName to snake_case syncType
      await SyncMetadataService.updateSyncMetadata(
        supabaseDataService.client,
        this.getSyncType(runtime.tableName),
        null, // lastProcessedSnapshotDate - direct tables don't have snapshots
        null, // latestAvailableSnapshotDate - direct tables don't have snapshots
        transformedData.length, // recordsProcessed
        0, // changesDetected - direct tables don't track changes
        duration,
        runtime.datasetName
      );

      return {
        tableName: runtime.tableName,
        success: true,
        recordsProcessed: transformedData.length,
        duration,
        message: `Successfully synced ${transformedData.length} records`
      };

    } catch (error) {
      // Only enhance connection errors - preserve original message for others
      const isConnectionError = 
        error.code === 'ETIMEOUT' ||
        error.code === 'ESOCKET' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNRESET' ||
        error.message?.includes('Connection is closed') ||
        error.message?.includes('connection is closed') ||
        error.message?.includes('connection lost');
      
      const errorMessage = isConnectionError 
        ? this._enhanceConnectionError(error)
        : (error.message || 'Unknown error occurred');
      
      logger?.error(`❌ Sync failed for ${runtime.tableName}:`, errorMessage);
      const duration = Date.now() - startTime;
      // Still try to update metadata even on failure using SyncMetadataService
      // Direct tables don't have snapshot dates, so pass null
      // Use getSyncType to map camelCase tableName to snake_case syncType
      await SyncMetadataService.updateSyncMetadata(
        supabaseDataService.client,
        this.getSyncType(runtime.tableName),
        null, // lastProcessedSnapshotDate - direct tables don't have snapshots
        null, // latestAvailableSnapshotDate - direct tables don't have snapshots
        0, // recordsProcessed
        0, // changesDetected - direct tables don't track changes
        duration,
        runtime.datasetName
      );
      return {
        tableName: runtime.tableName,
        success: false,
        recordsProcessed: 0,
        duration,
        error: errorMessage
      };
    } finally {
      if (pool) {
        try {
          await pool.close();
        } catch (closeError) {
          // Ignore close errors - connection may already be closed
        }
      }
    }
  }

  async syncLargeTable(runtime, logger) {
    const startTime = Date.now();
    let pool = null;
    const BATCH_SIZE = 10000;
    let totalProcessed = 0;

    try {
      pool = await this.createConnection();
      logger?.info(`✅ Connected to Synapse for ${runtime.tableName}`);

      await this.applyReplaceStrategy(runtime);

      logger?.info(`📊 Getting total record count from ${runtime.source}...`);
      const countQuery = this.buildCountQuery(runtime);
      
      // Execute count query with retry logic
      let countResult;
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries) {
        try {
          // Check connection health before query
          try {
            await pool.request().query('SELECT 1 as health_check');
          } catch (healthError) {
            logger?.warn(`⚠️  Connection unhealthy before count query, reconnecting...`);
            if (pool) {
              try {
                await pool.close();
              } catch (closeError) {
                // Ignore
              }
            }
            pool = await this.createConnection();
            logger?.info(`✅ Reconnected to Synapse for count query`);
          }
          
          countResult = await pool.request().query(countQuery);
          break; // Success - exit retry loop
        } catch (queryError) {
          const isConnectionError = queryError.code === 'ECONNCLOSED' || 
                                   queryError.message?.includes('Connection is closed') ||
                                   queryError.message?.includes('connection is closed');
          
          if (isConnectionError && retryCount < maxRetries) {
            retryCount++;
            logger?.warn(`⚠️  Connection closed during count query (attempt ${retryCount}/${maxRetries}), reconnecting...`);
            
            try {
              if (pool) {
                try {
                  await pool.close();
                } catch (closeError) {
                  // Ignore
                }
              }
              pool = await this.createConnection();
              logger?.info(`✅ Reconnected to Synapse, retrying count query (attempt ${retryCount})...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            } catch (reconnectError) {
              logger?.error(`❌ Failed to reconnect for count query:`, reconnectError.message);
              if (retryCount >= maxRetries) {
                throw queryError;
              }
              continue;
            }
          } else {
            throw queryError;
          }
        }
      }
      
      const totalRecords = countResult.recordset[0].total;
      logger?.info(`📊 Total records to process: ${totalRecords.toLocaleString()}`);
      
      // Emit initial progress
      if (logger?.tableName && logger?.eventEmitter) {
        syncEventEmitter.emitProgress(logger.tableName, {
          current: 0,
          total: totalRecords,
          percentage: 0,
          type: 'total'
        });
      }

      const totalBatches = Math.ceil(totalRecords / BATCH_SIZE);
      for (let offset = 0; offset < totalRecords; offset += BATCH_SIZE) {
        const batchNumber = Math.floor(offset / BATCH_SIZE) + 1;
        const batchQuery = this.buildBatchQuery(runtime, offset, BATCH_SIZE);
        // Logger automatically emits events via eventEmitter
        logger?.info(`📊 Processing batch ${batchNumber}/${totalBatches} (${offset + 1}-${Math.min(offset + BATCH_SIZE, totalRecords)})...`);

        // Execute batch query with automatic reconnection on connection errors
        let batchData;
        let retryCount = 0;
        const maxRetries = 2;
        
        while (retryCount <= maxRetries) {
          try {
            // Check connection health right before query (catches race conditions)
            try {
              await pool.request().query('SELECT 1 as health_check');
            } catch (healthError) {
              // Connection is closed - reconnect before query
              logger?.warn(`⚠️  Connection unhealthy before batch ${batchNumber} query, reconnecting...`);
              if (pool) {
                try {
                  await pool.close();
                } catch (closeError) {
                  // Ignore
                }
              }
              pool = await this.createConnection();
              logger?.info(`✅ Reconnected to Synapse for batch ${batchNumber}`);
            }
            
            // Execute the actual batch query
            const batchResult = await pool.request().query(batchQuery);
            batchData = batchResult.recordset;
            break; // Success - exit retry loop
          } catch (queryError) {
            // If it's a connection error, try to reconnect and retry
            const isConnectionError = queryError.code === 'ECONNCLOSED' || 
                                     queryError.message?.includes('Connection is closed') ||
                                     queryError.message?.includes('connection is closed');
            
            if (isConnectionError && retryCount < maxRetries) {
              retryCount++;
              logger?.warn(`⚠️  Connection closed during batch ${batchNumber} query (attempt ${retryCount}/${maxRetries}), reconnecting...`);
              
              try {
                // Close old pool if it exists
                if (pool) {
                  try {
                    await pool.close();
                  } catch (closeError) {
                    // Ignore close errors
                  }
                }
                
                // Create new connection
                pool = await this.createConnection();
                logger?.info(`✅ Reconnected to Synapse, retrying batch ${batchNumber} (attempt ${retryCount})...`);
                
                // Wait a moment before retrying to let connection stabilize
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Continue loop to retry query
                continue;
              } catch (reconnectError) {
                logger?.error(`❌ Failed to reconnect for batch ${batchNumber}:`, reconnectError.message);
                if (retryCount >= maxRetries) {
                  // Max retries reached - throw original error
                  throw queryError;
                }
                // Try again
                continue;
              }
            } else {
              // Not a connection error, or max retries reached - log and throw
              logger?.error(`❌ Failed to execute batch query for ${runtime.tableName} (batch ${batchNumber}):`, queryError.message);
              if (queryError.code) {
                logger?.error(`   Error code: ${queryError.code}`);
              }
              throw queryError;
            }
          }
        }
        
        // If we get here without breaking, all retries failed
        if (!batchData) {
          throw new Error(`Failed to execute batch ${batchNumber} after ${maxRetries} retries`);
        }

        if (!batchData.length) {
          break;
        }

        let transformContext = {};
        if (runtime.transformKey === 'reservations' && !String(runtime.source || '').toLowerCase().includes('fact_reservation_daily')) {
          const resIds = batchData.map(row => row.RES_ID).filter(Boolean);
          transformContext = {
            reservationEnrichmentMap: await this.loadReservationFoundationEnrichment(pool, resIds)
          };
          logger?.info(`📌 Batch ${batchNumber}: loaded fou enrichment for ${transformContext.reservationEnrichmentMap.size.toLocaleString()} reservations`);
        }

        const transformedBatch = this.transformData(runtime.transformKey, batchData, transformContext);
        await this.insertData(runtime.targetTable, transformedBatch, logger);

        totalProcessed += batchData.length;
        const percentage = Math.round((totalProcessed / totalRecords) * 100);
        logger?.info(`✅ Processed ${totalProcessed.toLocaleString()}/${totalRecords.toLocaleString()} records`);
        
        // Emit progress event for progress bar (logger handles log events automatically)
        if (logger?.tableName && logger?.eventEmitter) {
          syncEventEmitter.emitProgress(logger.tableName, {
            current: totalProcessed,
            total: totalRecords,
            percentage,
            type: 'batch',
            batchNumber,
            totalBatches
          });
        }
      }

      // Post-processing note: For reservations table, sail_code should be populated via migration
      // The migration 20251210182348_populate_reservation_sail_code.sql will backfill sail_code
      // from master_sail table. New reservations will get sail_code on next migration run.
      if (runtime.tableName === 'reservations' && totalProcessed > 0) {
        logger?.info(`ℹ️  Note: Run migration to populate sail_code in reservation table from master_sail`);
      }

      if (runtime.tableName === 'masterSail' && totalProcessed > 0) {
        const { error: hierarchyError } = await supabaseDataService.client.rpc(
          'refresh_inventory_item_sailing_hierarchy'
        );
        if (hierarchyError) {
          logger?.warn(`⚠️  Could not refresh inventory_item sailing hierarchy: ${hierarchyError.message}`);
        } else {
          logger?.info('🔗 Refreshed inventory_item sailing hierarchy from master_sail');
        }
      }

      const duration = Date.now() - startTime;
      // Logger automatically emits events via eventEmitter
      logger?.info(`✅ Sync completed for ${runtime.tableName} in ${duration}ms`);
      logger?.info(`📊 Total records processed: ${totalProcessed.toLocaleString()}`);

      // Update sync metadata using SyncMetadataService (consistent with derived tables)
      // Direct tables don't have snapshot dates, so pass null
      // Use getSyncType to map camelCase tableName to snake_case syncType
      await SyncMetadataService.updateSyncMetadata(
        supabaseDataService.client,
        this.getSyncType(runtime.tableName),
        null, // lastProcessedSnapshotDate - direct tables don't have snapshots
        null, // latestAvailableSnapshotDate - direct tables don't have snapshots
        totalProcessed, // recordsProcessed
        0, // changesDetected - direct tables don't track changes
        duration,
        runtime.datasetName
      );

      return {
        tableName: runtime.tableName,
        success: true,
        recordsProcessed: totalProcessed,
        duration,
        message: `Successfully synced ${totalProcessed.toLocaleString()} records in batches`
      };

    } catch (error) {
      // Only enhance connection errors - preserve original message for others
      const isConnectionError = 
        error.code === 'ETIMEOUT' ||
        error.code === 'ESOCKET' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNRESET' ||
        error.message?.includes('Connection is closed') ||
        error.message?.includes('connection is closed') ||
        error.message?.includes('connection lost');
      
      const errorMessage = isConnectionError 
        ? this._enhanceConnectionError(error)
        : (error.message || 'Unknown error occurred');
      
      logger?.error(`❌ Sync failed for ${runtime.tableName}:`, errorMessage);
      const duration = Date.now() - startTime;
      // Still try to update metadata even on failure using SyncMetadataService
      // Direct tables don't have snapshot dates, so pass null
      // Use getSyncType to map camelCase tableName to snake_case syncType
      await SyncMetadataService.updateSyncMetadata(
        supabaseDataService.client,
        this.getSyncType(runtime.tableName),
        null, // lastProcessedSnapshotDate - direct tables don't have snapshots
        null, // latestAvailableSnapshotDate - direct tables don't have snapshots
        totalProcessed, // recordsProcessed
        0, // changesDetected - direct tables don't track changes
        duration,
        runtime.datasetName
      );
      return {
        tableName: runtime.tableName,
        success: false,
        recordsProcessed: totalProcessed,
        duration,
        error: errorMessage
      };
    } finally {
      if (pool) {
        try {
          await pool.close();
        } catch (closeError) {
          // Ignore close errors - connection may already be closed
        }
      }
    }
  }

  /**
   * Generic batching wrapper for derived table syncs
   * Handles all batching logic - individual sync functions only process single batches
   * 
   * @param {Object} runtime - Runtime configuration
   * @param {Object} logger - Logger instance
   * @param {Function} currentStateLoader - Function to load current state: () => Promise<Map>
   * @param {Function} batchProcessor - Function to process a batch: (batch, currentState, logger) => Promise<{changes, updatedStates}>
   * @param {Function} insertChanges - Function to insert changes: (supabaseClient, changes, logger) => Promise<void>
   * @param {Function} updateCurrentState - Function to update current state: (supabaseClient, updatedStates, logger) => Promise<void>
   * @param {Object} metadataConfig - Metadata configuration {syncType, dateRange, forceFullSync, dataset}
   */
  async syncDerivedTableWithBatching(
    runtime, 
    logger, 
    currentStateLoader,
    batchProcessor,
    insertChanges,
    updateCurrentState,
    metadataConfig
  ) {
    const startTime = Date.now();
    let pool = null;
    const BATCH_SIZE = 50000; // Standard batch size for derived tables
    let totalProcessed = 0;
    let totalChangesDetected = 0;
    const allChanges = [];
    const allUpdatedStates = [];
    let maxSnapshotDate = null;

    try {
      // STEP 1: Load current state once before batching
      logger?.info(`📥 Loading current state for ${runtime.tableName}...`);
      // For reservationChanges, currentStateLoader needs synapseConfig and dateRange
      // For others, it only needs supabaseClient and logger
      const currentState = metadataConfig.syncType === 'reservation_changes'
        ? await currentStateLoader(supabaseDataService.client, this.synapseConfig, metadataConfig.dateRange, logger)
        : await currentStateLoader(supabaseDataService.client, logger);
      logger?.info(`✅ Loaded ${currentState.size.toLocaleString()} current state records`);

      // STEP 2: Check metadata and determine sync type
      const { syncType, dateRange, forceFullSync, dataset } = metadataConfig;
      
      // STEP 3: Connect to Synapse FIRST (before checking metadata)
      // This ensures we have a connection pool that won't be closed by getLatestSnapshotDate
      pool = await this.createConnection();
      logger?.info(`✅ Connected to Synapse for ${runtime.tableName}`);
      
      // Get latest snapshot date from source (using the existing pool)
      // For competitor and publishedRates, use the appropriate snapshot date column
      const snapshotDateColumn = metadataConfig.syncType === 'competitor' 
        ? 'Snapshot_Date' 
        : metadataConfig.syncType === 'published_rates' 
          ? 'SNAPSHOT_DATE' 
          : runtime.dateColumn || 'Snapshot_Date';
      
      // Use the existing pool instead of creating a new one
      let latestAvailableSnapshotDate;
      try {
        const query = `
          SELECT MAX(${snapshotDateColumn}) as latest_snapshot_date
          FROM ${runtime.source}
        `;
        const result = await pool.request().query(query);
        const latestDate = result.recordset[0]?.latest_snapshot_date;
        if (latestDate) {
          const date = new Date(latestDate);
          date.setHours(0, 0, 0, 0);
          latestAvailableSnapshotDate = date.toISOString();
        } else {
          latestAvailableSnapshotDate = null;
        }
      } catch (error) {
        logger?.error(`❌ Failed to get latest snapshot date:`, error.message);
        throw error;
      }

      // Get last processed snapshot date
      const lastProcessedSnapshotDate = forceFullSync 
        ? null 
        : await SyncMetadataService.getLastProcessedSnapshotDate(supabaseDataService.client, syncType);

      // Check if sync is needed
      const isInitialLoad = !lastProcessedSnapshotDate || forceFullSync;
      
      if (!isInitialLoad && latestAvailableSnapshotDate && lastProcessedSnapshotDate) {
        if (new Date(latestAvailableSnapshotDate) <= new Date(lastProcessedSnapshotDate)) {
          const duration = Date.now() - startTime;
          await SyncMetadataService.updateSyncMetadataNoData(
            supabaseDataService.client,
            syncType,
            latestAvailableSnapshotDate,
            lastProcessedSnapshotDate,
            duration,
            dataset
          );
          // Close pool before returning
          if (pool) {
            try {
              await pool.close();
            } catch (closeError) {
              // Ignore close errors
            }
          }
          return {
            tableName: runtime.tableName,
            success: true,
            recordsProcessed: 0,
            recordsUpdated: 0,
            duration,
            message: 'No new snapshots available',
            detailedLogs: logger?.getLogs() || []
          };
        }
      }

      // Build WHERE clause for the query
      // For derived tables (competitor, publishedRates), build dynamic WHERE clause
      // that includes Departure_Date range and optionally Snapshot_Date filter
      let whereClause = runtime.whereClause || '';
      
      // For competitor and published_rates, build WHERE clause dynamically
      if (metadataConfig.syncType === 'competitor' || metadataConfig.syncType === 'published_rates') {
        const { dateRange, forceFullSync } = metadataConfig;
        const departureDateColumn = metadataConfig.syncType === 'competitor' ? 'Departure_Date' : 'DEPARTURE_DATE';
        const snapshotDateColumn = metadataConfig.syncType === 'competitor' ? 'Snapshot_Date' : 'SNAPSHOT_DATE';
        
        // Always filter by Departure_Date range (dataset requirement)
        whereClause = `${departureDateColumn} >= '${dateRange.from}' AND ${departureDateColumn} <= '${dateRange.to}'`;

        // Published rates: first Talia load should not replay every historical SNAPSHOT_DATE in the
        // departure window (one change row per snapshot transition). Scope to latest warehouse publish
        // for that same departure slice only. Incremental runs use SNAPSHOT_DATE > last_processed.
        if (metadataConfig.syncType === 'published_rates' && isInitialLoad) {
          whereClause += ` AND CAST(${snapshotDateColumn} AS DATE) = (
            SELECT CAST(MAX(${snapshotDateColumn}) AS DATE)
            FROM ${runtime.source}
            WHERE ${departureDateColumn} >= '${dateRange.from}' AND ${departureDateColumn} <= '${dateRange.to}'
          )`;
        } else if (!isInitialLoad && lastProcessedSnapshotDate) {
          const datePart = lastProcessedSnapshotDate.split('T')[0]; // Extract date part from ISO datetime
          whereClause += ` AND ${snapshotDateColumn} > '${datePart}'`;
        }
      }
      
      const columnsSql = runtime.columnsSql;
      const rowNumberOrder = runtime.rowNumberOrder || [];

      // Build row number query
      const order = rowNumberOrder.length
        ? rowNumberOrder.join(', ')
        : runtime.dateColumn ? `[${runtime.dateColumn}]` : '[id]';

      const rowNumberQuery = `
        SELECT ${columnsSql}, ROW_NUMBER() OVER (ORDER BY ${order}) as rn
        FROM ${runtime.source}
        ${whereClause ? `WHERE ${whereClause}` : ''}
      `;

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM (${rowNumberQuery}) AS numbered`;
      let totalRecords;
      try {
        const countResult = await pool.request().query(countQuery);
        totalRecords = countResult.recordset[0].total;
        logger?.info(`📊 Total records to process: ${totalRecords.toLocaleString()}`);
      } catch (queryError) {
        // Log SQL query errors with full context
        logger?.error(`❌ Failed to execute count query for ${runtime.tableName}:`, queryError.message);
        logger?.error(`   Query: ${countQuery.substring(0, 200)}...`);
        if (queryError.code) {
          logger?.error(`   Error code: ${queryError.code}`);
        }
        // Re-throw - let the catch block handle it
        throw queryError;
      }
      
      // Emit initial progress event
      if (logger?.tableName && logger?.eventEmitter) {
        syncEventEmitter.emitProgress(logger.tableName, {
          current: 0,
          total: totalRecords,
          percentage: 0,
          type: 'records',
          message: `Found ${totalRecords.toLocaleString()} records to process`
        });
      }

      if (totalRecords === 0) {
        const duration = Date.now() - startTime;
        const finalProcessedSnapshotDate = lastProcessedSnapshotDate || latestAvailableSnapshotDate;
        await SyncMetadataService.updateSyncMetadataNoData(
          supabaseDataService.client,
          syncType,
          latestAvailableSnapshotDate || finalProcessedSnapshotDate,
          finalProcessedSnapshotDate,
          duration,
          dataset
        );
        return {
          tableName: runtime.tableName,
          success: true,
          recordsProcessed: 0,
          recordsUpdated: 0,
          duration,
          message: 'No records to process',
          detailedLogs: logger?.getLogs() || []
        };
      }

      // STEP 4: Process in batches
      const totalBatches = Math.ceil(totalRecords / BATCH_SIZE);
      let batchNumber = 1;

      for (let offset = 0; offset < totalRecords; offset += BATCH_SIZE) {
        const batchQuery = `
          SELECT *
          FROM (
            ${rowNumberQuery}
          ) AS numbered
          WHERE rn > ${offset} AND rn <= ${offset + BATCH_SIZE}
          ORDER BY rn
        `;

        // Logger automatically emits events via eventEmitter
        logger?.info(`📊 Processing batch ${batchNumber}/${totalBatches} (${offset + 1}-${Math.min(offset + BATCH_SIZE, totalRecords)})...`);

        // Execute batch query with automatic reconnection on connection errors
        let batch;
        let retryCount = 0;
        const maxRetries = 2;
        
        while (retryCount <= maxRetries) {
          try {
            // Check connection health right before query (catches race conditions)
            try {
              await pool.request().query('SELECT 1 as health_check');
            } catch (healthError) {
              // Connection is closed - reconnect before query
              logger?.warn(`⚠️  Connection unhealthy before batch ${batchNumber} query, reconnecting...`);
              if (pool) {
                try {
                  await pool.close();
                } catch (closeError) {
                  // Ignore
                }
              }
              pool = await this.createConnection();
              logger?.info(`✅ Reconnected to Synapse for batch ${batchNumber}`);
            }
            
            // Execute the actual batch query
            // Wrap in try-catch to handle connection errors that occur during query execution
            try {
              const batchResult = await pool.request().query(batchQuery);
              batch = batchResult.recordset;
              break; // Success - exit retry loop
            } catch (queryExecError) {
              // Re-throw to be caught by outer catch block
              throw queryExecError;
            }
          } catch (queryError) {
            // Log the error details for debugging
            console.error(`[RETRY DEBUG] Batch ${batchNumber} query error:`, {
              code: queryError.code,
              message: queryError.message,
              name: queryError.name,
              retryCount
            });
            
            // If it's a connection error, try to reconnect and retry
            // Check both error code and error name/type
            const isConnectionError = queryError.code === 'ECONNCLOSED' || 
                                     queryError.code === 'ETIMEOUT' ||
                                     queryError.code === 'ESOCKET' ||
                                     queryError.code === 'ECONNRESET' ||
                                     queryError.name === 'ConnectionError' ||
                                     queryError.name === 'RequestError' ||
                                     queryError.message?.includes('Connection is closed') ||
                                     queryError.message?.includes('connection is closed') ||
                                     queryError.message?.includes('connection lost') ||
                                     queryError.message?.includes('ConnectionError') ||
                                     queryError.message?.includes('RequestError');
            
            if (isConnectionError && retryCount < maxRetries) {
              retryCount++;
              logger?.warn(`⚠️  Connection closed during batch ${batchNumber} query (attempt ${retryCount}/${maxRetries}), reconnecting...`);
              
              try {
                // Close old pool if it exists
                if (pool) {
                  try {
                    await pool.close();
                  } catch (closeError) {
                    // Ignore close errors
                  }
                }
                
                // Create new connection
                pool = await this.createConnection();
                logger?.info(`✅ Reconnected to Synapse, retrying batch ${batchNumber} (attempt ${retryCount})...`);
                
                // Wait a moment before retrying to let connection stabilize
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Continue loop to retry query
                continue;
              } catch (reconnectError) {
                logger?.error(`❌ Failed to reconnect for batch ${batchNumber}:`, reconnectError.message);
                if (retryCount >= maxRetries) {
                  // Max retries reached - throw original error
                  throw queryError;
                }
                // Try again
                continue;
              }
            } else {
              // Not a connection error, or max retries reached - log and throw
              logger?.error(`❌ Failed to execute batch query for ${runtime.tableName} (batch ${batchNumber}):`, queryError.message);
              logger?.error(`   Query: ${batchQuery.substring(0, 200)}...`);
              if (queryError.code) {
                logger?.error(`   Error code: ${queryError.code}`);
              }
              throw queryError;
            }
          }
        }
        
        // If we get here without breaking, all retries failed
        if (!batch) {
          throw new Error(`Failed to execute batch ${batchNumber} after ${maxRetries} retries`);
        }

        if (!batch.length) {
          break;
        }

        // Process this batch using the provided processor function
        const batchResult_data = await batchProcessor(batch, currentState, logger);
        allChanges.push(...batchResult_data.changes);
        allUpdatedStates.push(...batchResult_data.updatedStates);
        totalProcessed += batch.length;
        totalChangesDetected += batchResult_data.changes.length;

        // Track max snapshot date
        if (batch.length > 0) {
          // For competitor and published_rates, use the appropriate snapshot date column
          const snapshotDateColumn = metadataConfig.syncType === 'competitor' 
            ? 'Snapshot_Date' 
            : metadataConfig.syncType === 'published_rates' 
              ? 'SNAPSHOT_DATE' 
              : runtime.dateColumn || 'Snapshot_Date';
          
          const batchSnapshotDates = batch
            .map(r => r[snapshotDateColumn] ? new Date(r[snapshotDateColumn]).getTime() : null)
            .filter(d => d !== null);
          if (batchSnapshotDates.length > 0) {
            const batchMaxDate = Math.max(...batchSnapshotDates);
            if (maxSnapshotDate === null || batchMaxDate > maxSnapshotDate) {
              maxSnapshotDate = batchMaxDate;
            }
          }
        }

        logger?.info(`✅ Processed ${totalProcessed.toLocaleString()}/${totalRecords.toLocaleString()} records (${batchResult_data.changes.length} changes detected)`);
        
        // Emit progress event for progress bar (logger handles log events automatically)
        if (logger?.tableName && logger?.eventEmitter) {
          const percentage = Math.round((totalProcessed / totalRecords) * 100);
          syncEventEmitter.emitProgress(logger.tableName, {
            current: totalProcessed,
            total: totalRecords,
            percentage,
            type: 'records',
            batchNumber,
            totalBatches,
            message: `Processed ${totalProcessed.toLocaleString()}/${totalRecords.toLocaleString()} records`
          });
        }

        // Flush changes and states in batches to avoid memory issues
        if (allChanges.length >= 10000) {
          logger?.info(`💾 Flushing ${allChanges.length.toLocaleString()} changes to database...`);
          await insertChanges(supabaseDataService.client, allChanges, logger);
          allChanges.length = 0;
        }

        if (allUpdatedStates.length >= 10000) {
          logger?.info(`💾 Flushing ${allUpdatedStates.length.toLocaleString()} state updates to database...`);
          await updateCurrentState(supabaseDataService.client, allUpdatedStates, logger);
          allUpdatedStates.length = 0;
        }

        batchNumber++;
      }

      // STEP 5: Insert remaining changes and update state
      if (allChanges.length > 0) {
        logger?.info(`💾 Inserting final ${allChanges.length.toLocaleString()} changes...`);
        await insertChanges(supabaseDataService.client, allChanges, logger);
      }

      if (allUpdatedStates.length > 0) {
        logger?.info(`💾 Updating final ${allUpdatedStates.length.toLocaleString()} state records...`);
        await updateCurrentState(supabaseDataService.client, allUpdatedStates, logger);
      }

      // STEP 6: Update metadata
      let finalProcessedSnapshotDate;
      if (maxSnapshotDate) {
        const date = new Date(maxSnapshotDate);
        date.setHours(0, 0, 0, 0);
        finalProcessedSnapshotDate = date.toISOString();
      } else if (lastProcessedSnapshotDate) {
        const date = new Date(lastProcessedSnapshotDate);
        date.setHours(0, 0, 0, 0);
        finalProcessedSnapshotDate = date.toISOString();
      } else if (latestAvailableSnapshotDate) {
        finalProcessedSnapshotDate = latestAvailableSnapshotDate;
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        finalProcessedSnapshotDate = today.toISOString();
      }

      const duration = Date.now() - startTime;
      await SyncMetadataService.updateSyncMetadata(
        supabaseDataService.client,
        syncType,
        finalProcessedSnapshotDate,
        latestAvailableSnapshotDate || finalProcessedSnapshotDate,
        totalProcessed,
        totalChangesDetected,
        duration,
        dataset
      );

      // Logger automatically emits events via eventEmitter
      logger?.info(`✅ Sync completed for ${runtime.tableName} in ${duration}ms`);
      logger?.info(`📊 Total records processed: ${totalProcessed.toLocaleString()}, changes detected: ${totalChangesDetected.toLocaleString()}`);

      return {
        tableName: runtime.tableName,
        success: true,
        recordsProcessed: totalProcessed,
        recordsUpdated: totalChangesDetected,
        duration,
        message: `Processed ${totalProcessed.toLocaleString()} records, detected ${totalChangesDetected.toLocaleString()} changes`,
        detailedLogs: logger?.getLogs() || []
      };
    } catch (error) {
      // CRITICAL: Log original error FIRST before any enhancement
      // This ensures we see the real error in logs and UI
      const originalError = error;
      const originalMessage = error.message || 'Unknown error occurred';
      const originalCode = error.code;
      
      // Log original error details immediately
      // CRITICAL: Log to console FIRST so we see the real error even if logger fails
      console.error(`[ERROR] Batch processing failed for ${runtime.tableName}:`, originalMessage);
      console.error(`[ERROR] Error code:`, originalCode);
      console.error(`[ERROR] Error name:`, error.name);
      console.error(`[ERROR] Full error:`, error);
      if (error.stack) {
        console.error(`[ERROR] Stack:`, error.stack);
      }
      
      logger?.error(`❌ Batch processing failed for ${runtime.tableName}:`, originalMessage);
      if (originalCode) {
        logger?.error(`   Error code: ${originalCode}`);
      }
      if (error.stack) {
        logger?.debug(`   Stack: ${error.stack.substring(0, 500)}`);
      }
      
      // ONLY enhance if it's clearly a connection error
      // Check error codes first (most reliable)
      const isConnectionError = 
        originalCode === 'ETIMEOUT' ||
        originalCode === 'ESOCKET' ||
        originalCode === 'ECONNREFUSED' ||
        originalCode === 'ENOTFOUND' ||
        originalCode === 'ECONNRESET' ||
        // Only check message if code doesn't indicate connection error
        (!originalCode && (
          originalMessage?.includes('Connection is closed') ||
          originalMessage?.includes('connection is closed') ||
          originalMessage?.includes('connection lost')
        ));
      
      let errorMessage;
      if (isConnectionError) {
        errorMessage = this._enhanceConnectionError(error);
        logger?.error(`   Enhanced connection error message: ${errorMessage}`);
      } else {
        // Preserve original error message - this is the REAL error
        errorMessage = originalMessage;
      }
      
      // Create error with appropriate message
      const finalError = new Error(errorMessage);
      finalError.originalError = originalError;
      finalError.originalMessage = originalMessage;
      finalError.originalCode = originalCode;
      finalError.isConnectionError = isConnectionError;
      throw finalError;
    } finally {
      if (pool) {
        try {
          await pool.close();
        } catch (closeError) {
          // Ignore close errors - connection may already be closed
        }
      }
    }
  }

  async syncDerivedTable(runtime, logger) {
    switch (runtime.definition.handler) {
      case 'reservationChanges': {
        if (!runtime.dateRange) {
          throw new Error('reservationChanges requires a date range in the configuration');
        }

        // Check if forceFullSync is requested (e.g., via CLI flag or config)
        const forceFullSync = runtime.overrides?.forceFullSync || false;

        // NOTE: reservationChanges uses SyncOperation wrapper instead of syncDerivedTableWithBatching
        // because it requires special handling for active reservation IDs filtering.
        // The loadReservationChangesCurrentState function needs synapseConfig and dateRange
        // to query stg.RES_HEADER for active reservations, which is different from other derived tables.
        // This pattern is intentional and correct for this use case.
        // 
        // Template for other derived tables: Use syncDerivedTableWithBatching (see competitor/publishedRates)
        // Template for direct tables: Use syncSmallTable (small) or syncLargeTable (large datasets)
        
        // Wrap sync function with SyncOperation for logging
        // Pass logger directly - it already has tableName and eventEmitter set from syncTable
        const syncOp = new SyncOperation(syncReservationChanges, logger, {
          tableName: runtime.tableName,
          syncType: 'reservation_changes' // snake_case - matches tableSources.js
        });
        
        // Ensure logger has eventEmitter (should already be set, but verify)
        if (!logger.eventEmitter) {
          logger.eventEmitter = syncEventEmitter;
        }
        if (!logger.tableName) {
          logger.tableName = runtime.tableName;
        }

        const result = await syncOp.execute({
          synapseConfig: this.synapseConfig,
          supabaseClient: supabaseDataService.client,
          source: runtime.definition.source,
          columns: runtime.definition.columns,
          dateColumn: runtime.definition.dateColumn,
          supabaseDateColumn: runtime.overrides.replace?.column || runtime.definition.supabaseDateColumn,
          dateRange: runtime.dateRange,
          targetTable: runtime.definition.target,
          rowNumberOrder: runtime.definition.rowNumberOrder,
          forceFullSync,
          dataset: runtime.datasetName
        });

        return {
          tableName: runtime.tableName,
          success: result.success,
          recordsProcessed: result.recordsProcessed || 0,
          recordsUpdated: result.recordsUpdated || result.changesDetected || 0,
          duration: result.duration || null,
          message: result.message,
          detailedLogs: result.detailedLogs || []
        };
      }
      case 'competitor': {
        if (!runtime.dateRange) {
          throw new Error('competitor requires a date range in the configuration');
        }

        // Check if forceFullSync is requested
        const forceFullSync = runtime.overrides?.forceFullSync || false;

        // Use batching wrapper - sync service handles all batching, logging, and state management
        return await this.syncDerivedTableWithBatching(
          runtime,
          logger,
          loadCompetitorCurrentState,
          processCompetitorBatch,
          insertCompetitorChanges,
          updateCompetitorCurrentState,
          {
            syncType: 'competitor', // snake_case - matches tableSources.js
            dateRange: runtime.dateRange,
            forceFullSync,
            dataset: runtime.datasetName
          }
        );
      }

      case 'publishedRates': {
        if (!runtime.dateRange) {
          throw new Error('publishedRates requires a date range in the configuration');
        }

        // Check if forceFullSync is requested
        const forceFullSync = runtime.overrides?.forceFullSync || false;

        // Use batching wrapper - sync service handles all batching, logging, and state management
        return await this.syncDerivedTableWithBatching(
          runtime,
          logger,
          loadPublishedRatesCurrentState,
          processPublishedRatesBatch,
          insertPublishedRatesChanges,
          updatePublishedRatesCurrentState,
          {
            syncType: 'published_rates', // Must match tableSources.js syncType (snake_case)
            dateRange: runtime.dateRange,
            forceFullSync,
            dataset: runtime.datasetName
          }
        );
      }

      default:
        throw new Error(`Unsupported derived table handler "${runtime.definition.handler}"`);
    }
  }

  async syncTable(tableName, datasetName = this.defaultDataset, overrides = {}) {
    // CRITICAL: Use uiTableName for event emission (what UI listens to)
    // tableName is the sync config name (camelCase), uiTableName is the UI table name (snake_case)
    const eventTableName = overrides.uiTableName || tableName;

    if (isSynapseSyncDisabled()) {
      return {
        success: false,
        tableName,
        message: 'Synapse sync is disabled (TALIA_SYNAPSE_SYNC_DISABLED).',
        recordsProcessed: 0,
        duration: 0,
        error: 'Synapse sync disabled (TALIA_SYNAPSE_SYNC_DISABLED)',
        detailedLogs: []
      };
    }
    
    // CONCURRENCY CONTROL: Check if sync is already running (use sync config name)
    const existingSync = this.activeSyncs.get(tableName);
    if (existingSync && existingSync.status === 'running') {
      throw new Error(`Sync already in progress for ${tableName}. Please wait for it to complete.`);
    }
    
    // Note: Connection validation removed - let actual sync operations handle connection errors
    // The connection test was too strict and could fail even when syncs work.
    // Actual sync operations will fail gracefully with clear error messages if connection fails.
    
      // Create a logger instance for this sync operation (with event emission)
      // Use eventTableName so UI receives events (UI listens to snake_case like "published_rates")
      const logger = new SyncLogger(eventTableName, syncEventEmitter);
      const startTime = Date.now();
      
      // DEBUG: Verify logger has correct tableName for event emission
      console.log(`[SYNC DEBUG] syncTable called: tableName=${tableName}, eventTableName=${eventTableName}, logger.tableName=${logger.tableName}`);
      
      // DEBUG: Log tableName mapping to verify correct event emission
      console.log(`[DEBUG] syncTable: tableName=${tableName}, eventTableName=${eventTableName}, logger.tableName=${logger.tableName}`);
    
    // Store in active syncs for real-time status tracking
    this.activeSyncs.set(tableName, {
      logger,
      startTime,
      status: 'running'
    });
    
    try {
      const runtime = this.buildRuntimeConfig(tableName, datasetName, overrides);
      
      // Merge overrides into runtime config
      if (overrides.forceFullSync !== undefined) {
        runtime.overrides = { ...runtime.overrides, forceFullSync: overrides.forceFullSync };
      }

      // Emit explicit start event for server logs (logger.info automatically emits via eventEmitter)
      logger.info(`🔄 Starting sync for table: ${tableName} (dataset: ${datasetName})`);

      let result;
      if (runtime.type === 'derived') {
        result = await this.syncDerivedTable(runtime, logger);
        // For derived tables, detailedLogs come from SyncOperation wrapper
        // If not present, fall back to logger
        if (!result.detailedLogs) {
          result.detailedLogs = logger.getLogs();
        }
      } else if (runtime.isLargeDataset) {
        result = await this.syncLargeTable(runtime, logger);
        result.detailedLogs = logger.getLogs();
      } else {
        result = await this.syncSmallTable(runtime, logger);
        result.detailedLogs = logger.getLogs();
      }
      
      // Mark as completed
      const syncInfo = this.activeSyncs.get(tableName);
      if (syncInfo) {
        syncInfo.status = result.success ? 'completed' : 'failed';
      }
      
      // Emit completion event (logger already emitted log events, just emit complete event)
      // Use eventTableName so UI receives events
      const finalDuration = Date.now() - startTime;
      syncEventEmitter.emitComplete(eventTableName, {
        success: result.success,
        recordsProcessed: result.recordsProcessed || 0,
        duration: finalDuration,
        message: result.message
      });
      
      // Clean up after a delay (for UI polling) - terminal doesn't need this
      // But we'll keep it for now to support both UI and terminal
      setTimeout(() => {
        this.activeSyncs.delete(tableName);
      }, 60000); // Clean up after 60 seconds
      
      return result;
    } catch (error) {
      // CRITICAL: Log original error details - don't enhance here
      // The error may have already been enhanced in syncDerivedTableWithBatching
      // If it has originalError, use that; otherwise use the error itself
      const originalError = error.originalError || error;
      const originalMessage = error.originalMessage || originalError.message || error.message || 'Unknown error occurred';
      const originalCode = error.originalCode || originalError.code;
      
      // Log the REAL error message
      logger.error(`❌ Sync failed for ${tableName}:`, originalMessage);
      if (originalCode) {
        logger.error(`   Error code: ${originalCode}`);
      }
      
      // Mark as failed
      const syncInfo = this.activeSyncs.get(tableName);
      if (syncInfo) {
        syncInfo.status = 'failed';
      }
      
      // Emit error event with original message - UI needs to see the REAL error
      // Use eventTableName so UI receives events
      // Use the error.message (which may be enhanced if it's a connection error)
      // but also include originalMessage in the error object
      syncEventEmitter.emitError(eventTableName, {
        message: error.message || originalMessage, // Use enhanced message if available, otherwise original
        error: originalError.stack || originalMessage,
        originalMessage: originalMessage, // Always include original for debugging
        originalCode: originalCode
      });
      
      // Clean up failed syncs immediately
      this.activeSyncs.delete(tableName);
      
      // Re-throw with original context preserved
      const finalError = new Error(error.message || originalMessage);
      finalError.originalError = originalError;
      finalError.originalMessage = originalMessage;
      finalError.originalCode = originalCode;
      throw finalError;
    }
  }

  async syncDataset(datasetName = this.defaultDataset, runtimeOverrides = {}) {
    if (!datasetName) {
      throw new Error('No dataset specified and no default dataset available.');
    }

    if (isSynapseSyncDisabled()) {
      console.warn('Synapse sync disabled (TALIA_SYNAPSE_SYNC_DISABLED); skipping dataset sync.');
      return {
        success: false,
        dataset: datasetName,
        totalTables: 0,
        successfulTables: 0,
        totalRecords: 0,
        duration: 0,
        results: []
      };
    }

    const dataset = this.getDatasetConfig(datasetName);
    const tableOrder = dataset.tableSequence || Object.keys(dataset.tables || {});

    console.log(`🚀 Starting dataset sync: ${datasetName}`);
    console.log(`📋 Tables: ${tableOrder.join(', ')}`);

    const startTime = Date.now();
    const results = [];
    let successCount = 0;
    let totalRecords = 0;

    for (const tableName of tableOrder) {
      console.log(`\n${'='.repeat(60)}`);
      const result = await this.syncTable(tableName, datasetName, runtimeOverrides);
      results.push(result);

      if (result.success) {
        successCount += 1;
        totalRecords += result.recordsProcessed || 0;
      }

      console.log(`${'='.repeat(60)}`);
    }

    const duration = Date.now() - startTime;
    const overallSuccess = successCount === results.length;

    console.log('\n🎯 DATASET SYNC SUMMARY');
    console.log('========================');
    console.log(`Dataset: ${datasetName}`);
    console.log(`✅ Successful tables: ${successCount}/${results.length}`);
    console.log(`📊 Total records processed: ${totalRecords.toLocaleString()}`);
    console.log(`⏱️  Total duration: ${duration}ms (${(duration / 1000).toFixed(1)}s)`);

    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${result.tableName}: ${result.message || result.error}`);
    });

    return {
      success: overallSuccess,
      dataset: datasetName,
      totalTables: results.length,
      successfulTables: successCount,
      totalRecords,
      duration,
      results
    };
  }

  async syncAllTables(runtimeOverrides = {}) {
    return this.syncDataset(this.defaultDataset, runtimeOverrides);
  }

  async testTableQuery(tableName, datasetName = this.defaultDataset) {
    const runtime = this.buildRuntimeConfig(tableName, datasetName);

    if (runtime.type === 'derived') {
      return {
        tableName,
        success: true,
        message: 'Derived tables use specialised handlers and are not directly queryable.'
      };
    }

    try {
      const countQuery = this.buildCountQuery(runtime).replace('COUNT(*) as total', 'COUNT(*) as record_count');
      const result = await this.executeQuery(countQuery);
      const count = result.recordset[0].record_count;
      return {
        tableName,
        recordCount: count,
        success: true
      };
    } catch (error) {
      return {
        tableName,
        error: error.message,
        success: false
      };
    }
  }

  async getSyncStatus() {
    console.log('📊 Checking sync status...');

    const status = {};

    for (const [tableName, definition] of Object.entries(this.tableDefinitions)) {
      try {
        const { data, error } = await supabaseDataService.client
          .from(definition.target)
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        const { count, error: countError } = await supabaseDataService.client
          .from(definition.target)
          .select('*', { count: 'exact', head: true });

        if (countError) throw countError;

        status[tableName] = {
          lastSync: data[0]?.created_at || 'Never',
          recordCount: count || 0,
          success: true
        };
      } catch (error) {
        status[tableName] = {
          lastSync: 'Error',
          recordCount: 0,
          error: error.message,
          success: false
        };
      }
    }

    return status;
  }
}

export const synapseSyncService = new SynapseSyncService();
