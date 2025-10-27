// Synapse Data Sync Service
// One-way sync from Azure Synapse to Supabase with year constraints (2025-2026)

import sql from 'mssql';
import { supabaseDataService } from './supabase.js';

/**
 * SynapseSyncService - Controlled one-way data synchronization
 * 
 * Features:
 * - One-way sync: Synapse → Supabase only
 * - Year constraints: 2025-2026 data only
 * - Specific table targeting
 * - Replace strategy (clear and reload)
 * - Error handling and logging
 */
class SynapseSyncService {
  constructor() {
    // Azure Synapse connection configuration
    this.config = {
      server: process.env.AZURE_SYNAPSE_SERVER || 'celestyaldataplatform-prd.sql.azuresynapse.net',
      port: parseInt(process.env.AZURE_SYNAPSE_PORT) || 1433,
      database: process.env.AZURE_SYNAPSE_DATABASE || 'CDP_Dedicated_SQL_DWH',
      user: process.env.AZURE_SYNAPSE_USERNAME || 'RBryer',
      password: process.env.AZURE_SYNAPSE_PASSWORD || 'Cele5tyalrbUser!',
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

    // Sync configuration - ONLY these tables will be synced
    this.syncConfig = {
      tables: {
        // Ships table - no date constraints (static reference data)
        ships: {
          sourceTable: 'dwh.Dim_Ship',
          targetTable: 'ship',
          query: `SELECT Ship_Id, Ship_Code, Ship_Name, Ship_Pax_Capacity, Ship_Length, Ship_Tonnage 
                  FROM dwh.Dim_Ship`,
          constraints: [], // No date constraints for ships
          primaryKey: 'Ship_Id',
          description: 'Ship reference data'
        },
        
        // Cabin Availability - 2025-2026 only
        cabinAvailability: {
          sourceTable: 'dwh.Dim_Cabin_Availability',
          targetTable: 'cabin_availability',
          query: `SELECT [Snapshot_Date], [Sail_Code], [Package_Name], [Sail_Days], [Cabin_Category],
                         [Available_Cabins], [Total_Cabins], [Available_Absolute], [Available_Weighted],
                         [Availability_Result], [Nested_Cabins]
                  FROM dwh.Dim_Cabin_Availability
                  WHERE YEAR([Snapshot_Date]) IN (2025, 2026)`,
          constraints: ['YEAR([Snapshot_Date]) IN (2025, 2026)'],
          primaryKey: 'Snapshot_Date,Sail_Code,Cabin_Category',
          description: 'Cabin availability data for 2025-2026'
        },
        
        // Reservations - September 2025 only (much smaller dataset)
        reservations: {
          sourceTable: 'dwh.Fact_Reservation_History',
          targetTable: 'reservation',
          query: `SELECT [WC_Snapshot_Date], [Group_ID], [Res_ID], [Ship], [Sail_code], [Sail_From_Date],
                         [Sail_To_Date], [Agency_ID], [Cabin_Category], [Guest_Count], [Pax_Status],
                         [Group_Status], [Res_Status], [GrossSellingFare], [NetSellingFare]
                  FROM dwh.Fact_Reservation_History
                  WHERE [Sail_From_Date] >= '2025-09-01' AND [Sail_From_Date] <= '2025-09-30'`,
          constraints: ['Sail_From_Date >= 2025-09-01 AND Sail_From_Date <= 2025-09-30'],
          primaryKey: 'Res_ID',
          description: 'Reservation data for September 2025 sailings only'
        },
        
        // Published Rates - September 2025 only
        publishedRates: {
          sourceTable: 'fou.GQL_PUBLISHED_RATES',
          targetTable: 'published_rates',
          query: `SELECT [SNAPSHOT_DATE], [SAIL_CODE], [SHIP_CODE], [PACKAGE_NAME], [REGION],
                         [RATE_TYPE], [SAIL_DAYS], [DEPARTURE_DATE], [CABIN_CATEGORY], [PROMO_NAME],
                         [PROMO_TYPE], [CURRENCY_CODE], [FARE_PER_PERSON], [PORT_TAXES_SERVICES],
                         [EXTRA_ADULT], [EXTRA_CHILD], [DISCOUNT]
                  FROM fou.GQL_PUBLISHED_RATES
                  WHERE [DEPARTURE_DATE] >= '2025-09-01' AND [DEPARTURE_DATE] <= '2025-09-30'`,
          constraints: ['DEPARTURE_DATE >= 2025-09-01 AND DEPARTURE_DATE <= 2025-09-30'],
          primaryKey: 'SNAPSHOT_DATE,SAIL_CODE,CABIN_CATEGORY',
          description: 'Published rates data for September 2025 sailings'
        },
        
        // Sail By Cabin Occupancy - September 2025 only
        sailByCabinOccupancy: {
          sourceTable: 'dwh.Dim_Sail_By_Cabin_Occupancy',
          targetTable: 'sail_by_cabin_occupancy',
          query: `SELECT [Sail_ID], [Sail_Code], [Sail_Days], [Sail_Date_From], [Master_Voyage],
                         [Sail_Itinerary_Date], [Sail_Itinerary_Night], [Port_Code], [Ship_Code], [Ship_name],
                         [Package_Type], [Package_Name], [Geog_Area_Code], [Season_Code], [IS_Fake],
                         [IS_Active], [IS_Package_Active], [Cabin_Category], [Cabin_Capacity],
                         [Total_Cabins], [Occupied_Cabins], [Remaining_Cabins]
                  FROM dwh.Dim_Sail_By_Cabin_Occupancy
                  WHERE [Sail_Date_From] >= '2025-09-01' AND [Sail_Date_From] <= '2025-09-30'`,
          constraints: ['Sail_Date_From >= 2025-09-01 AND Sail_Date_From <= 2025-09-30'],
          primaryKey: 'Sail_ID,Cabin_Category',
          description: 'Sail by cabin occupancy data for September 2025 sailings'
        }
      }
    };

    console.log('🔄 SynapseSyncService initialized');
    console.log(`📊 Configured tables: ${Object.keys(this.syncConfig.tables).join(', ')}`);
  }

  /**
   * Test connection to Azure Synapse
   * @returns {Promise<boolean>} Connection success status
   */
  async testConnection() {
    console.log('🔍 Testing Azure Synapse connection...');
    console.log(`   Server: ${this.config.server}`);
    console.log(`   Database: ${this.config.database}`);
    console.log(`   User: ${this.config.user}`);
    
    try {
      const pool = await sql.connect(this.config);
      console.log('✅ Successfully connected to Azure Synapse');
      
      // Test query to verify connection
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

  /**
   * Create a new connection pool to Azure Synapse
   * @returns {Promise<sql.Connection>} Connection pool
   */
  async createConnection() {
    try {
      const pool = await sql.connect(this.config);
      return pool;
    } catch (error) {
      console.error('❌ Failed to create connection:', error.message);
      throw error;
    }
  }

  /**
   * Execute a query on Azure Synapse
   * @param {string} query - SQL query to execute
   * @param {Object} pool - Connection pool (optional, will create if not provided)
   * @returns {Promise<Object>} Query result
   */
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

  /**
   * Test a specific table query
   * @param {string} tableName - Name of the table to test
   * @returns {Promise<Object>} Test result
   */
  async testTableQuery(tableName) {
    const config = this.getTableConfig(tableName);
    if (!config) {
      throw new Error(`Table ${tableName} not configured for sync`);
    }

    console.log(`🧪 Testing query for table: ${tableName}`);
    console.log(`   Source: ${config.sourceTable}`);
    console.log(`   Constraints: ${config.constraints.join(', ') || 'None'}`);

    try {
      // Modify query to get count only for testing
      const testQuery = config.query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) record_count FROM');
      
      const result = await this.executeQuery(testQuery);
      const count = result.recordset[0].record_count;
      
      console.log(`✅ Table test successful: ${count} records found`);
      return {
        tableName,
        recordCount: count,
        success: true
      };
    } catch (error) {
      console.error(`❌ Table test failed for ${tableName}:`, error.message);
      return {
        tableName,
        error: error.message,
        success: false
      };
    }
  }

  /**
   * Get sync configuration for a specific table
   * @param {string} tableName - Name of the table
   * @returns {Object|null} Table configuration or null if not found
   */
  getTableConfig(tableName) {
    return this.syncConfig.tables[tableName] || null;
  }

  /**
   * List all configured tables for sync
   * @returns {Array} Array of table configurations
   */
  listConfiguredTables() {
    return Object.entries(this.syncConfig.tables).map(([name, config]) => ({
      name,
      sourceTable: config.sourceTable,
      targetTable: config.targetTable,
      constraints: config.constraints,
      description: config.description
    }));
  }

  /**
   * Transform data from Synapse format to Supabase format
   * @param {string} tableName - Name of the table being transformed
   * @param {Array} data - Raw data from Synapse
   * @returns {Array} Transformed data for Supabase
   */
  transformData(tableName, data) {
    console.log(`🔄 Transforming ${data.length} records for ${tableName}...`);
    
    const currentTime = new Date().toISOString();
    
    switch (tableName) {
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

      default:
        console.warn(`⚠️  No transformation defined for table: ${tableName}`);
        return data;
    }
  }

  /**
   * Clear target table in Supabase (ONE WAY SYNC - replace, don't merge)
   * @param {string} tableName - Name of the target table
   * @returns {Promise<void>}
   */
  async clearTargetTable(tableName) {
    try {
      console.log(`🗑️  Clearing existing data in ${tableName}...`);
      
      const { error } = await supabaseDataService.client
        .from(tableName)
        .delete()
        .gte('id', 0); // Delete all records (id is always >= 0)
      
      if (error) throw error;
      
      console.log(`✅ Cleared existing data in ${tableName}`);
    } catch (error) {
      console.error(`❌ Failed to clear ${tableName}:`, error.message);
      throw error;
    }
  }

  /**
   * Insert transformed data into Supabase
   * @param {string} tableName - Name of the target table
   * @param {Array} data - Transformed data to insert
   * @returns {Promise<void>}
   */
  async insertData(tableName, data) {
    try {
      console.log(`📥 Inserting ${data.length} records into ${tableName}...`);
      
      // Insert in batches to avoid memory issues with large datasets
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

  /**
   * Sync a specific table from Synapse to Supabase
   * @param {string} tableName - Name of the table to sync
   * @returns {Promise<Object>} Sync result
   */
  async syncTable(tableName) {
    const config = this.getTableConfig(tableName);
    if (!config) {
      throw new Error(`Table ${tableName} not configured for sync`);
    }

    console.log(`🔄 Starting sync for table: ${tableName}`);
    console.log(`   Source: ${config.sourceTable}`);
    console.log(`   Target: ${config.targetTable}`);
    console.log(`   Constraints: ${config.constraints.join(', ') || 'None'}`);

    // Check if this is a large dataset that needs streaming
    const isLargeDataset = tableName === 'reservations';
    
    if (isLargeDataset) {
      return await this.syncLargeTable(tableName, config);
    } else {
      return await this.syncSmallTable(tableName, config);
    }
  }

  /**
   * Sync small/medium tables (load all data into memory)
   */
  async syncSmallTable(tableName, config) {
    const startTime = Date.now();
    let pool = null;

    try {
      // 1. Connect to Synapse
      pool = await this.createConnection();
      console.log(`✅ Connected to Synapse for ${tableName}`);

      // 2. Fetch data from Synapse
      console.log(`📊 Fetching data from ${config.sourceTable}...`);
      const result = await pool.request().query(config.query);
      const rawData = result.recordset;
      
      if (rawData.length === 0) {
        console.log(`⚠️  No data found for ${tableName} with current constraints`);
        return {
          tableName,
          success: true,
          recordsProcessed: 0,
          duration: Date.now() - startTime,
          message: 'No data found with current constraints'
        };
      }

      console.log(`📥 Fetched ${rawData.length} records from Synapse`);

      // 3. Transform data
      const transformedData = this.transformData(tableName, rawData);
      console.log(`🔄 Transformed ${transformedData.length} records`);

      // 4. Clear target table (ONE WAY SYNC)
      await this.clearTargetTable(config.targetTable);

      // 5. Insert data into Supabase
      await this.insertData(config.targetTable, transformedData);

      const duration = Date.now() - startTime;
      console.log(`✅ Sync completed for ${tableName} in ${duration}ms`);

      return {
        tableName,
        success: true,
        recordsProcessed: transformedData.length,
        duration,
        message: `Successfully synced ${transformedData.length} records`
      };

    } catch (error) {
      console.error(`❌ Sync failed for ${tableName}:`, error.message);
      return {
        tableName,
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

  /**
   * Sync large tables using streaming/batching to avoid memory issues
   */
  async syncLargeTable(tableName, config) {
    const startTime = Date.now();
    let pool = null;
    const BATCH_SIZE = 10000; // Process 10K records at a time
    let totalProcessed = 0;

    try {
      // 1. Connect to Synapse
      pool = await this.createConnection();
      console.log(`✅ Connected to Synapse for ${tableName}`);

      // 2. Clear target table first (ONE WAY SYNC)
      console.log(`🗑️  Clearing existing data in ${config.targetTable}...`);
      await this.clearTargetTable(config.targetTable);

      // 3. Get total count first
      console.log(`📊 Getting total record count from ${config.sourceTable}...`);
      // Create a simple count query for reservations (September 2025 only)
      const countQuery = `SELECT COUNT(*) as total FROM dwh.Fact_Reservation_History WHERE [Sail_From_Date] >= '2025-09-01' AND [Sail_From_Date] <= '2025-09-30'`;
      
      const countResult = await pool.request().query(countQuery);
      const totalRecords = countResult.recordset[0].total;
      console.log(`📊 Total records to process: ${totalRecords.toLocaleString()}`);

      // 4. Process in batches using ROW_NUMBER() for Azure Synapse compatibility
      let offset = 0;
      while (offset < totalRecords) {
        const batchQuery = `
          SELECT * FROM (
            SELECT *, ROW_NUMBER() OVER (ORDER BY [Res_ID]) as rn
            FROM (${config.query}) as subquery
          ) as numbered
          WHERE rn > ${offset} AND rn <= ${offset + BATCH_SIZE}
        `;
        
        console.log(`📊 Processing batch ${Math.floor(offset/BATCH_SIZE) + 1}/${Math.ceil(totalRecords/BATCH_SIZE)} (${offset + 1}-${Math.min(offset + BATCH_SIZE, totalRecords)})...`);
        
        const batchResult = await pool.request().query(batchQuery);
        const batchData = batchResult.recordset;
        
        if (batchData.length === 0) break;
        
        // Transform batch
        const transformedBatch = this.transformData(tableName, batchData);
        
        // Insert batch
        await this.insertData(config.targetTable, transformedBatch);
        
        totalProcessed += batchData.length;
        console.log(`✅ Processed ${totalProcessed.toLocaleString()}/${totalRecords.toLocaleString()} records`);
        
        offset += BATCH_SIZE;
        
        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Sync completed for ${tableName} in ${duration}ms`);
      console.log(`📊 Total records processed: ${totalProcessed.toLocaleString()}`);

      return {
        tableName,
        success: true,
        recordsProcessed: totalProcessed,
        duration,
        message: `Successfully synced ${totalProcessed.toLocaleString()} records in batches`
      };

    } catch (error) {
      console.error(`❌ Sync failed for ${tableName}:`, error.message);
      return {
        tableName,
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

  /**
   * Sync all configured tables from Synapse to Supabase
   * @returns {Promise<Object>} Overall sync result
   */
  async syncAllTables() {
    console.log('🚀 Starting full data sync from Synapse to Supabase...');
    console.log(`📋 Tables to sync: ${Object.keys(this.syncConfig.tables).join(', ')}`);
    console.log('');

    const startTime = Date.now();
    const results = [];
    let totalRecords = 0;
    let successCount = 0;

    // Sync each table individually
    for (const tableName of Object.keys(this.syncConfig.tables)) {
      console.log(`\n${'='.repeat(60)}`);
      const result = await this.syncTable(tableName);
      results.push(result);
      
      if (result.success) {
        successCount++;
        totalRecords += result.recordsProcessed;
      }
      
      console.log(`${'='.repeat(60)}`);
    }

    const duration = Date.now() - startTime;
    const overallSuccess = successCount === results.length;

    console.log('\n🎯 SYNC SUMMARY');
    console.log('================');
    console.log(`✅ Successful tables: ${successCount}/${results.length}`);
    console.log(`📊 Total records processed: ${totalRecords.toLocaleString()}`);
    console.log(`⏱️  Total duration: ${duration}ms (${(duration/1000).toFixed(1)}s)`);
    
    if (overallSuccess) {
      console.log('🎉 All tables synced successfully!');
    } else {
      console.log('⚠️  Some tables failed to sync. Check individual results below.');
    }

    console.log('\n📋 Individual Results:');
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${result.tableName}: ${result.message || result.error}`);
    });

    return {
      success: overallSuccess,
      totalTables: results.length,
      successfulTables: successCount,
      totalRecords,
      duration,
      results
    };
  }

  /**
   * Get sync status for all tables
   * @returns {Promise<Object>} Status information
   */
  async getSyncStatus() {
    console.log('📊 Checking sync status...');
    
    const status = {};
    
    for (const [tableName, config] of Object.entries(this.syncConfig.tables)) {
      try {
        const { data, error } = await supabaseDataService.client
          .from(config.targetTable)
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (error) throw error;
        
        // Get total count
        const { count, error: countError } = await supabaseDataService.client
          .from(config.targetTable)
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

// Export singleton instance
export const synapseSyncService = new SynapseSyncService();
