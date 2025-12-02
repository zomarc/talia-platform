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

const require = createRequire(import.meta.url);
const syncConfig = require('../../sync.config.json');

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
  }
  
  /**
   * Get current sync status and logs for a table
   * Returns null if no active sync
   * Can check by either UI table name (snake_case) or sync config name (camelCase)
   */
  getSyncStatus(tableName) {
    // Try direct lookup first
    let syncInfo = this.activeSyncs.get(tableName);
    
    // If not found, try reverse mapping (for UI table names)
    if (!syncInfo) {
      const reverseMap = {
        'ships': 'ship',
        'cabinAvailability': 'cabin_availability',
        'reservations': 'reservation',
        'reservationPromotion': 'reservation_promotion',
        'masterSail': 'master_sail',
        'sailByCabinOccupancy': 'sail_by_cabin_occupancy',
        'reservationChanges': 'reservation_changes',
        'publishedRates': 'published_rates',
        'competitor': 'competitor'
      };
      
      // Check if any active sync matches this UI table name
      for (const [syncConfigName, uiTableName] of Object.entries(reverseMap)) {
        if (uiTableName === tableName) {
          syncInfo = this.activeSyncs.get(syncConfigName);
          if (syncInfo) {
            tableName = syncConfigName; // Use sync config name for return
            break;
          }
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

    try {
      const pool = await sql.connect(this.synapseConfig);
      console.log('✅ Successfully connected to Azure Synapse');
      const result = await pool.request().query('SELECT 1 test');
      console.log(`✅ Test query successful: ${result.recordset[0].test}`);
      await pool.close();
      return true;
    } catch (error) {
      console.error('❌ Connection failed:', error.message);
      if (error.code) {
        console.error(`   Error code: ${error.code}`);
      }
      return false;
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
   * Generic helper used by all sync methods
   */
  _enhanceConnectionError(error) {
    let errorMessage = error.message || 'Unknown error';
    
    if (error.message?.includes('Connection is closed') || 
        error.message?.includes('connection is closed') || 
        error.message?.includes('connection lost')) {
      errorMessage = 'Database connection closed during sync. Please check VPN connection and ensure Azure Synapse is accessible.';
    } else if (error.code === 'ETIMEOUT' || error.code === 'ESOCKET' || error.message?.includes('timeout')) {
      errorMessage = 'Connection timeout during sync. Please check VPN connection and network settings.';
    } else if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
      errorMessage = 'Connection refused. Please check VPN connection and ensure Azure Synapse is accessible.';
    } else if (error.code === 'ENOTFOUND' || error.message?.includes('ENOTFOUND')) {
      errorMessage = 'Cannot resolve server address. Please check VPN connection.';
    } else if (error.message?.includes('Login failed') || error.message?.includes('authentication')) {
      errorMessage = 'Authentication failed. Please check credentials.';
    } else if (error.message?.includes('getaddrinfo') || error.message?.includes('DNS')) {
      errorMessage = 'DNS resolution failed. Please check VPN connection.';
    }
    
    return errorMessage;
  }

  /**
   * Validate database connection before operations
   * Generic helper used by all sync methods - fails fast if connection is closed
   */
  async _validateConnection(pool, tableName) {
    try {
      await pool.request().query('SELECT 1 as connection_test');
    } catch (connError) {
      const errorMessage = this._enhanceConnectionError(connError);
      throw new Error(`Database connection lost during sync for ${tableName}. ${errorMessage}`);
    }
  }

  async createConnection() {
    try {
      // Use connect with the same config as syncs - this ensures consistency
      const pool = await sql.connect(this.synapseConfig);
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
   * Test connection using the same method as actual syncs
   * This ensures the test behaves the same way as real operations
   */
  async testConnectionUsingSyncMethod() {
    let pool = null;
    try {
      // Use the same connection method as syncs
      pool = await this.createConnection();
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
      if (pool) {
        try {
          await pool.close();
        } catch (closeError) {
          // Ignore close errors
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

  buildRuntimeConfig(tableName, datasetName = this.defaultDataset) {
    const definition = this.getTableDefinition(tableName);
    const dataset = this.getDatasetConfig(datasetName);
    const datasetTables = dataset.tables || {};
    const overrides = datasetTables[tableName] || {};

    const filters = [
      ...(definition.defaultFilters || []),
      ...(overrides.filters || [])
    ];

    const whereClause = this.buildWhereClause(filters);
    const columnsSql = definition.columns?.join(', ') || '*';
    const selectQuery = `SELECT ${columnsSql} FROM ${definition.source}${whereClause ? ` WHERE ${whereClause}` : ''}`;

    const replace = overrides.replace || definition.defaultReplace || null;

    let dateRange = null;
    if (replace?.from && replace?.to) {
      dateRange = { from: replace.from, to: replace.to };
    } else {
      const betweenFilter = filters.find(filter => filter.operator === 'between');
      if (betweenFilter?.from && betweenFilter?.to) {
        dateRange = { from: betweenFilter.from, to: betweenFilter.to };
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
      overrides,
      transformKey: definition.transformKey || tableName,
      isLargeDataset: Boolean(definition.isLargeDataset),
      rowNumberOrder: definition.rowNumberOrder || [],
      dateColumn: definition.dateColumn,
      supabaseDateColumn: definition.supabaseDateColumn,
      dateRange
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
    const replace = runtime.replace;
    if (!replace || replace.strategy === 'none') {
      console.log(`ℹ️  No replace strategy configured for ${runtime.targetTable}. Existing data will remain.`);
      return;
    }

    const table = runtime.targetTable;
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

  transformData(transformKey, data) {
    console.log(`🔄 Transforming ${data.length} records for ${transformKey}...`);
    const currentTime = new Date().toISOString();

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
        return data.map(row => ({
          res_id: row.RES_ID,
          res_status: row.RES_STATUS,
          source_code: row.SOURCE_CODE || null,
          res_probability: row.PROBABILITY || null,
          pax_type: null, // Not available in RES_HEADER
          pax_status: null, // Not available in RES_HEADER
          ship: row.SHIP_CODE || null,
          sail_code: null, // May need to derive from SAIL_DATE_FROM or join with master_sail
          sail_duration: null, // May need to calculate from SAIL_DATE_FROM and SAIL_DATE_TO
          sail_from_date: row.SAIL_DATE_FROM ? new Date(row.SAIL_DATE_FROM).toISOString().split('T')[0] : null,
          sail_to_date: row.SAIL_DATE_TO ? new Date(row.SAIL_DATE_TO).toISOString().split('T')[0] : null,
          agency_id: row.AGENCY_ID || null,
          sec_agency_id: row.SEC_AGENCY_ID || null,
          agency_channel: null, // Not available in RES_HEADER
          agency_country_code: null, // Not available in RES_HEADER
          agency_market: null, // Not available in RES_HEADER
          cabin_type: null, // Not available in RES_HEADER
          cabin_category: row.CABIN_CATEGORY || null,
          ticket_type: null, // Not available in RES_HEADER
          promo_code: null, // Not available in RES_HEADER
          currency: row.CURRENCY_CODE || null,
          currency_rate: row.CURRENCY_RATE || null,
          guest_count: row.RES_GUEST_COUNT || null,
          foc_guest_count: null, // Not available in RES_HEADER
          gross_published_fare: null, // Not available in RES_HEADER (may be in SNAPSHOT)
          gross_selling_fare: null, // Not available in RES_HEADER (may be in SNAPSHOT)
          net_selling_fare: null, // Not available in RES_HEADER (may be in SNAPSHOT)
          cruise_fare_comm: null, // Not available in RES_HEADER (may be in SNAPSHOT)
          published_discount: null, // Not available in RES_HEADER
          promotional_discounts: null, // Not available in RES_HEADER
          total_discounts: null, // Not available in RES_HEADER
          gross_ticket_revenue: null, // Not available in RES_HEADER (may be in SNAPSHOT)
          net_ticket_revenue: null, // Not available in RES_HEADER (may be in SNAPSHOT)
          net_invoice_revenue: null, // Not available in RES_HEADER (may be in SNAPSHOT)
          gross_ticket_revenue_eur: null, // Not available in RES_HEADER
          net_ticket_revenue_eur: null, // Not available in RES_HEADER
          net_invoice_revenue_eur: null, // Not available in RES_HEADER
          total_discounts_eur: null, // Not available in RES_HEADER
          created_at: currentTime
        }));

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

  /**
   * Update sync metadata for direct tables
   */
  async updateSyncMetadata(tableName, recordsProcessed, durationMs) {
    try {
      console.log(`📝 Updating sync metadata for ${tableName}: records=${recordsProcessed}, duration=${durationMs}ms`);
      const now = new Date();
      const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format for date
      
      const { data, error } = await supabaseDataService.client
        .from('sync_metadata')
        .upsert({
          sync_type: tableName,
          last_processed_date: today, // Required field - use today's date for direct tables
          records_processed: recordsProcessed,
          duration_ms: durationMs,
          last_sync_at: now.toISOString(),
          updated_at: now.toISOString()
        }, {
          onConflict: 'sync_type'
        });

      if (error) {
        console.error(`❌ Failed to update sync metadata for ${tableName}:`, error);
        console.error(`   Error details:`, JSON.stringify(error, null, 2));
        // Don't throw - metadata update failure shouldn't fail the sync
        // But log it prominently so it's visible
        console.warn(`⚠️  WARNING: Sync metadata not updated for ${tableName}. Sync succeeded but metadata update failed.`);
      } else {
        console.log(`✅ Updated sync metadata for ${tableName}`);
        if (data && data.length > 0) {
          console.log(`   Metadata record:`, JSON.stringify(data[0], null, 2));
        }
      }
    } catch (error) {
      console.error(`❌ Error updating sync metadata for ${tableName}:`, error);
      console.error(`   Stack:`, error.stack);
      console.warn(`⚠️  WARNING: Sync metadata update threw exception for ${tableName}. Sync succeeded but metadata may not be updated.`);
      // Don't throw - metadata update failure shouldn't fail the sync
    }
  }

  async syncSmallTable(runtime, logger) {
    const startTime = Date.now();
    let pool = null;

    try {
      pool = await this.createConnection();
      logger?.info(`✅ Connected to Synapse for ${runtime.tableName}`);

      // Validate connection before query - fail fast if connection is closed
      // Uses generic helper method for consistency across all sync methods
      await this._validateConnection(pool, runtime.tableName);

      const result = await pool.request().query(runtime.selectQuery);
      const rawData = result.recordset;
      
      // Validate connection after query - connection might have closed during query execution
      // This ensures we catch connection issues early before processing data
      try {
        await this._validateConnection(pool, runtime.tableName);
      } catch (connError) {
        // Connection closed during query - fail fast with clear error
        throw new Error(`Database connection closed during query execution for ${runtime.tableName}. ${connError.message}`);
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
        
        // Update sync metadata - use sync config name (tableName) not target table name
        await this.updateSyncMetadata(runtime.tableName, 0, duration);
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

      const transformedData = this.transformData(runtime.transformKey, rawData);
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

      // Update sync metadata - use sync config name (tableName) not target table name
      await this.updateSyncMetadata(runtime.tableName, transformedData.length, duration);

      return {
        tableName: runtime.tableName,
        success: true,
        recordsProcessed: transformedData.length,
        duration,
        message: `Successfully synced ${transformedData.length} records`
      };

    } catch (error) {
      // Use generic error enhancement helper for consistent error messages
      const errorMessage = this._enhanceConnectionError(error);
      
      logger?.error(`❌ Sync failed for ${runtime.tableName}:`, errorMessage);
      const duration = Date.now() - startTime;
      // Still try to update metadata even on failure - use sync config name (tableName) not target table name
      await this.updateSyncMetadata(runtime.tableName, 0, duration);
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
      const countResult = await pool.request().query(countQuery);
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

        // Validate connection before each batch - fail fast if connection is closed
        // Uses generic helper method for consistency across all sync methods
        await this._validateConnection(pool, runtime.tableName);

        const batchResult = await pool.request().query(batchQuery);
        const batchData = batchResult.recordset;

        if (!batchData.length) {
          break;
        }

        const transformedBatch = this.transformData(runtime.transformKey, batchData);
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

      const duration = Date.now() - startTime;
      // Logger automatically emits events via eventEmitter
      logger?.info(`✅ Sync completed for ${runtime.tableName} in ${duration}ms`);
      logger?.info(`📊 Total records processed: ${totalProcessed.toLocaleString()}`);

      // Update sync metadata - use sync config name (tableName) not target table name
      await this.updateSyncMetadata(runtime.tableName, totalProcessed, duration);

      return {
        tableName: runtime.tableName,
        success: true,
        recordsProcessed: totalProcessed,
        duration,
        message: `Successfully synced ${totalProcessed.toLocaleString()} records in batches`
      };

    } catch (error) {
      // Use generic error enhancement helper for consistent error messages
      const errorMessage = this._enhanceConnectionError(error);
      
      logger?.error(`❌ Sync failed for ${runtime.tableName}:`, errorMessage);
      const duration = Date.now() - startTime;
      // Still try to update metadata even on failure
      await this.updateSyncMetadata(runtime.targetTable, totalProcessed, duration);
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
      const currentState = metadataConfig.syncType === 'reservationChanges'
        ? await currentStateLoader(supabaseDataService.client, this.synapseConfig, metadataConfig.dateRange, logger)
        : await currentStateLoader(supabaseDataService.client, logger);
      logger?.info(`✅ Loaded ${currentState.size.toLocaleString()} current state records`);

      // STEP 2: Check metadata and determine sync type
      const { syncType, dateRange, forceFullSync, dataset } = metadataConfig;
      
      // Get latest snapshot date from source
      // For competitor and publishedRates, use the appropriate snapshot date column
      const snapshotDateColumn = metadataConfig.syncType === 'competitor' 
        ? 'Snapshot_Date' 
        : metadataConfig.syncType === 'publishedRates' 
          ? 'SNAPSHOT_DATE' 
          : runtime.dateColumn || 'Snapshot_Date';
      
      const latestAvailableSnapshotDate = await SyncMetadataService.getLatestSnapshotDate(
        this.synapseConfig,
        runtime.source,
        snapshotDateColumn
      );

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

      // STEP 3: Connect to Synapse and query in batches
      pool = await this.createConnection();
      logger?.info(`✅ Connected to Synapse for ${runtime.tableName}`);

      // Build WHERE clause for the query
      // For derived tables (competitor, publishedRates), build dynamic WHERE clause
      // that includes Departure_Date range and optionally Snapshot_Date filter
      let whereClause = runtime.whereClause || '';
      
      // For competitor and publishedRates, build WHERE clause dynamically
      if (metadataConfig.syncType === 'competitor' || metadataConfig.syncType === 'publishedRates') {
        const { dateRange, forceFullSync } = metadataConfig;
        const departureDateColumn = metadataConfig.syncType === 'competitor' ? 'Departure_Date' : 'DEPARTURE_DATE';
        const snapshotDateColumn = metadataConfig.syncType === 'competitor' ? 'Snapshot_Date' : 'SNAPSHOT_DATE';
        
        // Always filter by Departure_Date range (dataset requirement)
        whereClause = `${departureDateColumn} >= '${dateRange.from}' AND ${departureDateColumn} <= '${dateRange.to}'`;
        
        // For incremental syncs, also filter by snapshot date
        if (!isInitialLoad && lastProcessedSnapshotDate) {
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
      const countResult = await pool.request().query(countQuery);
      const totalRecords = countResult.recordset[0].total;
      logger?.info(`📊 Total records to process: ${totalRecords.toLocaleString()}`);
      
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
        // Validate connection before each batch - fail fast if connection is closed
        // Uses generic helper method for consistency across all sync methods
        await this._validateConnection(pool, runtime.tableName);

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

        const batchResult = await pool.request().query(batchQuery);
        const batch = batchResult.recordset;

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
          // For competitor and publishedRates, use the appropriate snapshot date column
          const snapshotDateColumn = metadataConfig.syncType === 'competitor' 
            ? 'Snapshot_Date' 
            : metadataConfig.syncType === 'publishedRates' 
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
      // Use generic error enhancement helper for consistent error messages
      const errorMessage = this._enhanceConnectionError(error);
      
      logger?.error(`❌ Batch processing failed for ${runtime.tableName}:`, errorMessage);
      
      // Create enhanced error with better message
      const enhancedError = new Error(errorMessage);
      enhancedError.originalError = error;
      throw enhancedError;
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
          syncType: 'reservationChanges'
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
            syncType: 'competitor',
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
            syncType: 'publishedRates',
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
    // CONCURRENCY CONTROL: Check if sync is already running
    const existingSync = this.activeSyncs.get(tableName);
    if (existingSync && existingSync.status === 'running') {
      throw new Error(`Sync already in progress for ${tableName}. Please wait for it to complete.`);
    }
    
    // Note: Connection validation removed - let actual sync operations handle connection errors
    // The connection test was too strict and could fail even when syncs work.
    // Actual sync operations will fail gracefully with clear error messages if connection fails.
    
    // Create a logger instance for this sync operation (with event emission)
    const logger = new SyncLogger(tableName, syncEventEmitter);
    const startTime = Date.now();
    
    // Store in active syncs for real-time status tracking
    this.activeSyncs.set(tableName, {
      logger,
      startTime,
      status: 'running'
    });
    
    try {
      const runtime = this.buildRuntimeConfig(tableName, datasetName);
      
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
      const finalDuration = Date.now() - startTime;
      syncEventEmitter.emitComplete(tableName, {
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
      logger.error(`❌ Sync failed for ${tableName}:`, error.message);
      
      // Mark as failed
      const syncInfo = this.activeSyncs.get(tableName);
      if (syncInfo) {
        syncInfo.status = 'failed';
      }
      
      // Emit error event (logger already emitted log event, just emit error event)
      syncEventEmitter.emitError(tableName, {
        message: error.message,
        error: error.stack || error.message
      });
      
      // Clean up failed syncs immediately
      this.activeSyncs.delete(tableName);
      
      throw error;
    }
  }

  async syncDataset(datasetName = this.defaultDataset) {
    if (!datasetName) {
      throw new Error('No dataset specified and no default dataset available.');
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
      const result = await this.syncTable(tableName, datasetName);
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

  async syncAllTables() {
    return this.syncDataset(this.defaultDataset);
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
