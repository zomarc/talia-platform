import sql from 'mssql';
import { createRequire } from 'module';

import { supabaseDataService } from './supabase.js';
import { syncReservationChanges } from './reservation-changes-sync.js';
import { syncCompetitors } from './competitor-sync.js';
import { syncPublishedRates } from './published-rates-sync.js';

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
        idleTimeoutMillis: 30000
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

  async createConnection() {
    try {
      const pool = await sql.connect(this.synapseConfig);
      return pool;
    } catch (error) {
      console.error('❌ Failed to create connection:', error.message);
      throw error;
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

        const { error } = await supabaseDataService.client
          .from(table)
          .delete()
          .gte(replace.column, replace.from)
          .lte(replace.column, replace.to);
        if (error) {
          throw new Error(`Failed to delete rows in ${table} between ${replace.from} and ${replace.to}: ${error.message}`);
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
          res_id: row.Res_ID,
          res_status: row.Res_Status,
          pax_status: row.Pax_Status,
          ship: row.Ship,
          sail_code: row.Sail_code,
          sail_from_date: row.Sail_From_Date,
          sail_to_date: row.Sail_To_Date,
          agency_id: row.Agency_ID,
          cabin_category: row.Cabin_Category,
          guest_count: row.Guest_Count,
          gross_selling_fare: row.GrossSellingFare,
          net_selling_fare: row.NetSellingFare,
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

      default:
        console.warn(`⚠️  No transformation defined for key: ${transformKey}`);
        return data;
    }
  }

  async insertData(tableName, data) {
    try {
      console.log(`📥 Inserting ${data.length} records into ${tableName}...`);

      const batchSize = 1000;
      let insertedCount = 0;

      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);

        const { error } = await supabaseDataService.client
          .from(tableName)
          .insert(batch);

        if (error) throw error;

        insertedCount += batch.length;
        console.log(`   📊 Inserted ${insertedCount}/${data.length} records...`);
      }

      console.log(`✅ Successfully inserted ${insertedCount} records into ${tableName}`);
    } catch (error) {
      console.error(`❌ Failed to insert into ${tableName}:`, error.message);
      throw error;
    }
  }

  async syncSmallTable(runtime) {
    const startTime = Date.now();
    let pool = null;

    try {
      pool = await this.createConnection();
      console.log(`✅ Connected to Synapse for ${runtime.tableName}`);

      const result = await pool.request().query(runtime.selectQuery);
      const rawData = result.recordset;

      if (rawData.length === 0) {
        console.log(`⚠️  No data found for ${runtime.tableName} with current constraints`);
        return {
          tableName: runtime.tableName,
          success: true,
          recordsProcessed: 0,
          duration: Date.now() - startTime,
          message: 'No data found with current constraints'
        };
      }

      console.log(`📥 Fetched ${rawData.length} records from Synapse`);

      const transformedData = this.transformData(runtime.transformKey, rawData);
      console.log(`🔄 Transformed ${transformedData.length} records`);

      await this.applyReplaceStrategy(runtime);

      await this.insertData(runtime.targetTable, transformedData);

      const duration = Date.now() - startTime;
      console.log(`✅ Sync completed for ${runtime.tableName} in ${duration}ms`);

      return {
        tableName: runtime.tableName,
        success: true,
        recordsProcessed: transformedData.length,
        duration,
        message: `Successfully synced ${transformedData.length} records`
      };

    } catch (error) {
      console.error(`❌ Sync failed for ${runtime.tableName}:`, error.message);
      return {
        tableName: runtime.tableName,
        success: false,
        recordsProcessed: 0,
        duration: Date.now() - startTime,
        error: error.message
      };
    } finally {
      if (pool) {
        await pool.close();
      }
    }
  }

  async syncLargeTable(runtime) {
    const startTime = Date.now();
    let pool = null;
    const BATCH_SIZE = 10000;
    let totalProcessed = 0;

    try {
      pool = await this.createConnection();
      console.log(`✅ Connected to Synapse for ${runtime.tableName}`);

      await this.applyReplaceStrategy(runtime);

      console.log(`📊 Getting total record count from ${runtime.source}...`);
      const countQuery = this.buildCountQuery(runtime);
      const countResult = await pool.request().query(countQuery);
      const totalRecords = countResult.recordset[0].total;
      console.log(`📊 Total records to process: ${totalRecords.toLocaleString()}`);

      for (let offset = 0; offset < totalRecords; offset += BATCH_SIZE) {
        const batchQuery = this.buildBatchQuery(runtime, offset, BATCH_SIZE);
        console.log(`📊 Processing batch ${Math.floor(offset / BATCH_SIZE) + 1}/${Math.ceil(totalRecords / BATCH_SIZE)} (${offset + 1}-${Math.min(offset + BATCH_SIZE, totalRecords)})...`);

        const batchResult = await pool.request().query(batchQuery);
        const batchData = batchResult.recordset;

        if (!batchData.length) {
          break;
        }

        const transformedBatch = this.transformData(runtime.transformKey, batchData);
        await this.insertData(runtime.targetTable, transformedBatch);

        totalProcessed += batchData.length;
        console.log(`✅ Processed ${totalProcessed.toLocaleString()}/${totalRecords.toLocaleString()} records`);

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Sync completed for ${runtime.tableName} in ${duration}ms`);
      console.log(`📊 Total records processed: ${totalProcessed.toLocaleString()}`);

      return {
        tableName: runtime.tableName,
        success: true,
        recordsProcessed: totalProcessed,
        duration,
        message: `Successfully synced ${totalProcessed.toLocaleString()} records in batches`
      };

    } catch (error) {
      console.error(`❌ Sync failed for ${runtime.tableName}:`, error.message);
      return {
        tableName: runtime.tableName,
        success: false,
        recordsProcessed: totalProcessed,
        duration: Date.now() - startTime,
        error: error.message
      };
    } finally {
      if (pool) {
        await pool.close();
      }
    }
  }

  async syncDerivedTable(runtime) {
    switch (runtime.definition.handler) {
      case 'reservationChanges': {
        if (!runtime.dateRange) {
          throw new Error('reservationChanges requires a date range in the configuration');
        }

        // Check if forceFullSync is requested (e.g., via CLI flag or config)
        const forceFullSync = runtime.overrides?.forceFullSync || false;

        const result = await syncReservationChanges({
          synapseConfig: this.synapseConfig,
          supabaseClient: supabaseDataService.client,
          source: runtime.definition.source,
          columns: runtime.definition.columns,
          dateColumn: runtime.definition.dateColumn,
          supabaseDateColumn: runtime.overrides.replace?.column || runtime.definition.supabaseDateColumn,
          dateRange: runtime.dateRange,
          targetTable: runtime.definition.target,
          rowNumberOrder: runtime.definition.rowNumberOrder,
          forceFullSync
        });

        return {
          tableName: runtime.tableName,
          success: result.success,
          recordsProcessed: result.recordsProcessed || 0,
          changesDetected: result.changesDetected || 0,
          duration: null,
          message: result.message
        };
      }
      case 'competitor': {
        if (!runtime.dateRange) {
          throw new Error('competitor requires a date range in the configuration');
        }

        // Check if forceFullSync is requested
        const forceFullSync = runtime.overrides?.forceFullSync || false;

        const result = await syncCompetitors({
          synapseConfig: this.synapseConfig,
          supabaseClient: supabaseDataService.client,
          source: runtime.definition.source,
          columns: runtime.definition.columns,
          dateColumn: runtime.definition.dateColumn,
          dateRange: runtime.dateRange,
          targetTable: runtime.definition.target,
          rowNumberOrder: runtime.definition.rowNumberOrder,
          forceFullSync
        });

        return {
          tableName: runtime.tableName,
          success: result.success,
          recordsProcessed: result.recordsProcessed || 0,
          recordsUpdated: result.recordsUpdated || 0,
          duration: null,
          message: result.message
        };
      }

      case 'publishedRates': {
        if (!runtime.dateRange) {
          throw new Error('publishedRates requires a date range in the configuration');
        }

        // Check if forceFullSync is requested
        const forceFullSync = runtime.overrides?.forceFullSync || false;

        const result = await syncPublishedRates({
          synapseConfig: this.synapseConfig,
          supabaseClient: supabaseDataService.client,
          source: runtime.definition.source,
          columns: runtime.definition.columns,
          dateColumn: runtime.definition.dateColumn,
          dateRange: runtime.dateRange,
          targetTable: runtime.definition.target,
          rowNumberOrder: runtime.definition.rowNumberOrder,
          forceFullSync
        });

        return {
          tableName: runtime.tableName,
          success: result.success,
          recordsProcessed: result.recordsProcessed || 0,
          changesDetected: result.recordsUpdated || 0,
          duration: null,
          message: result.message
        };
      }

      default:
        throw new Error(`Unsupported derived table handler "${runtime.definition.handler}"`);
    }
  }

  async syncTable(tableName, datasetName = this.defaultDataset, overrides = {}) {
    const runtime = this.buildRuntimeConfig(tableName, datasetName);
    
    // Merge overrides into runtime config
    if (overrides.forceFullSync !== undefined) {
      runtime.overrides = { ...runtime.overrides, forceFullSync: overrides.forceFullSync };
    }

    console.log(`🔄 Starting sync for table: ${tableName} (dataset: ${datasetName})`);

    if (runtime.type === 'derived') {
      return await this.syncDerivedTable(runtime);
    }

    if (runtime.isLargeDataset) {
      return await this.syncLargeTable(runtime);
    }

    return await this.syncSmallTable(runtime);
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
