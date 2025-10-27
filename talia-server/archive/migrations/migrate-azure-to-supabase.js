#!/usr/bin/env node

/**
 * Azure to Supabase Data Migration Script
 * 
 * This script pulls data from Azure Synapse and inserts it into local Supabase
 */

import dotenv from 'dotenv';
import { Connection, Request } from 'tedious';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

// Azure Synapse configuration
const azureConfig = {
  server: process.env.AZURE_SYNAPSE_SERVER || 'celestyaldataplatform-prd.sql.azuresynapse.net',
  port: parseInt(process.env.AZURE_SYNAPSE_PORT) || 1433,
  database: process.env.AZURE_SYNAPSE_DATABASE || 'CDP_Dedicated_SQL_DWH',
  userName: process.env.AZURE_SYNAPSE_USERNAME || 'RBryer',
  password: process.env.AZURE_SYNAPSE_PASSWORD || 'Cele5tyalrbUser!',
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
    rowCollectionOnRequestCompletion: true
  }
};

// Supabase configuration
const supabaseConfig = {
  url: process.env.SUPABASE_URL || 'http://127.0.0.1:54323',
  anonKey: process.env.SUPABASE_ANON_KEY || 'your-anon-key-here',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key-here'
};

// Initialize Supabase client
const supabase = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey);

// Table mapping configuration
const TABLE_MAPPINGS = {
  // Add your table mappings here
  // Format: 'azure_table_name': 'supabase_table_name'
  'dim_ship': 'ships',
  'fact_sailing': 'sailings',
  'fact_cabin_availability': 'cabin_availability',
  'fact_kpis': 'kpis',
  'fact_exceptions': 'exceptions'
};

class DataMigrator {
  constructor() {
    this.azureConnection = null;
  }

  async connectToAzure() {
    return new Promise((resolve, reject) => {
      console.log('🔗 Connecting to Azure Synapse...');
      this.azureConnection = new Connection(azureConfig);
      
      this.azureConnection.on('connect', (err) => {
        if (err) {
          console.error('❌ Azure connection failed:', err);
          reject(err);
        } else {
          console.log('✅ Connected to Azure Synapse');
          resolve();
        }
      });
      
      this.azureConnection.on('error', (err) => {
        console.error('❌ Azure connection error:', err);
        reject(err);
      });
      
      this.azureConnection.connect();
    });
  }

  async disconnectFromAzure() {
    if (this.azureConnection) {
      this.azureConnection.close();
      console.log('🔌 Disconnected from Azure Synapse');
    }
  }

  async queryAzureTable(tableName, limit = 1000) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT TOP ${limit} * FROM ${tableName}`;
      console.log(`📊 Querying Azure table: ${tableName}`);
      
      const request = new Request(sql, (err, rowCount, rows) => {
        if (err) {
          console.error(`❌ Error querying ${tableName}:`, err);
          reject(err);
        } else {
          console.log(`✅ Retrieved ${rowCount} rows from ${tableName}`);
          resolve(rows);
        }
      });
      
      this.azureConnection.execSql(request);
    });
  }

  async clearSupabaseTable(tableName) {
    try {
      console.log(`🗑️  Clearing Supabase table: ${tableName}`);
      const { error } = await supabase.from(tableName).delete().neq('id', 0);
      if (error) {
        console.log(`⚠️  Could not clear table ${tableName} (might not exist yet):`, error.message);
      } else {
        console.log(`✅ Cleared table ${tableName}`);
      }
    } catch (error) {
      console.log(`⚠️  Could not clear table ${tableName}:`, error.message);
    }
  }

  async insertIntoSupabase(tableName, data) {
    if (!data || data.length === 0) {
      console.log(`⚠️  No data to insert into ${tableName}`);
      return;
    }

    try {
      console.log(`📥 Inserting ${data.length} rows into Supabase table: ${tableName}`);
      
      // Process data to handle any Azure-specific formatting
      const processedData = data.map(row => {
        const processedRow = {};
        for (const [key, value] of Object.entries(row)) {
          // Convert Azure column names to match Supabase schema
          const supabaseKey = this.convertColumnName(key);
          processedRow[supabaseKey] = value;
        }
        return processedRow;
      });

      const { error } = await supabase
        .from(tableName)
        .insert(processedData);

      if (error) {
        console.error(`❌ Error inserting into ${tableName}:`, error);
        throw error;
      } else {
        console.log(`✅ Successfully inserted data into ${tableName}`);
      }
    } catch (error) {
      console.error(`❌ Failed to insert into ${tableName}:`, error);
      throw error;
    }
  }

  convertColumnName(azureColumnName) {
    // Convert Azure column names to Supabase format
    const columnMappings = {
      'Ship_Id': 'Ship_Id',
      'Ship_Code': 'Ship_Code', 
      'Ship_Name': 'Ship_Name',
      'Ship_Pax_Capacity': 'Ship_Pax_Capacity',
      'Ship_Length': 'Ship_Length',
      'Ship_Tonnage': 'Ship_Tonnage',
      'Sailing_Id': 'Sailing_Id',
      'Depart_Date': 'Depart_Date',
      'Return_Date': 'Return_Date',
      'Status': 'Status',
      'Booked_Cabins': 'Booked_Cabins',
      'Available_Cabins': 'Available_Cabins',
      'Projected_Cabins': 'Projected_Cabins',
      'Snapshot_Date': 'Snapshot_Date',
      'Package_Name': 'Package_Name',
      'Sail_Days': 'Sail_Days',
      'Cabin_Category': 'Cabin_Category',
      'Available_Cabins': 'Available_Cabins',
      'Total_Cabins': 'Total_Cabins',
      'Available_Absolute': 'Available_Absolute',
      'Available_Weighted': 'Available_Weighted',
      'Availability_Result': 'Availability_Result',
      'Nested_Cabins': 'Nested_Cabins',
      'KPI_Id': 'KPI_Id',
      'KPI_Name': 'KPI_Name',
      'KPI_Value': 'KPI_Value',
      'KPI_Target': 'KPI_Target',
      'KPI_Unit': 'KPI_Unit',
      'Trend': 'Trend',
      'Change_Percentage': 'Change_Percentage',
      'Period': 'Period',
      'User_Role': 'User_Role',
      'Exception_Id': 'Exception_Id',
      'Exception_Type': 'Exception_Type',
      'Severity': 'Severity',
      'Message': 'Message',
      'Created_Date': 'Created_Date',
      'Resolved': 'Resolved'
    };

    return columnMappings[azureColumnName] || azureColumnName;
  }

  async migrateTable(azureTableName, supabaseTableName, limit = 1000) {
    try {
      console.log(`\n🔄 Migrating ${azureTableName} → ${supabaseTableName}`);
      
      // Step 1: Query data from Azure
      const azureData = await this.queryAzureTable(azureTableName, limit);
      
      if (!azureData || azureData.length === 0) {
        console.log(`⚠️  No data found in ${azureTableName}`);
        return;
      }

      // Step 2: Clear Supabase table
      await this.clearSupabaseTable(supabaseTableName);
      
      // Step 3: Insert data into Supabase
      await this.insertIntoSupabase(supabaseTableName, azureData);
      
      console.log(`✅ Successfully migrated ${azureTableName} → ${supabaseTableName}`);
      
    } catch (error) {
      console.error(`❌ Failed to migrate ${azureTableName}:`, error);
      throw error;
    }
  }

  async migrateAllTables() {
    console.log('🚀 Starting Azure to Supabase data migration...\n');
    
    try {
      // Connect to Azure
      await this.connectToAzure();
      
      // Migrate each table
      for (const [azureTable, supabaseTable] of Object.entries(TABLE_MAPPINGS)) {
        await this.migrateTable(azureTable, supabaseTable);
      }
      
      console.log('\n🎉 Data migration completed successfully!');
      console.log('📊 You can now query your local Supabase database');
      console.log('🔗 Supabase Dashboard: http://127.0.0.1:54323/');
      
    } catch (error) {
      console.error('\n❌ Migration failed:', error);
      throw error;
    } finally {
      // Disconnect from Azure
      await this.disconnectFromAzure();
    }
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const migrator = new DataMigrator();
  migrator.migrateAllTables().catch(console.error);
}

export { DataMigrator };


