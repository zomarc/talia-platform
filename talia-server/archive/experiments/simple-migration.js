#!/usr/bin/env node

/**
 * Simple Azure to Supabase Migration
 * 
 * This script pulls specific tables from Azure Synapse into local Supabase
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
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key-here'
};

// Initialize Supabase client
const supabase = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey);

async function connectToAzure() {
  return new Promise((resolve, reject) => {
    console.log('🔗 Connecting to Azure Synapse...');
    const connection = new Connection(azureConfig);
    
    connection.on('connect', (err) => {
      if (err) {
        console.error('❌ Azure connection failed:', err);
        reject(err);
      } else {
        console.log('✅ Connected to Azure Synapse');
        resolve(connection);
      }
    });
    
    connection.on('error', (err) => {
      console.error('❌ Azure connection error:', err);
      reject(err);
    });
    
    connection.connect();
  });
}

async function queryAzureTable(connection, tableName, limit = 100) {
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
    
    connection.execSql(request);
  });
}

async function insertIntoSupabase(tableName, data) {
  if (!data || data.length === 0) {
    console.log(`⚠️  No data to insert into ${tableName}`);
    return;
  }

  try {
    console.log(`📥 Inserting ${data.length} rows into Supabase table: ${tableName}`);
    
    const { error } = await supabase
      .from(tableName)
      .insert(data);

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

async function migrateTable(connection, azureTableName, supabaseTableName, limit = 100) {
  try {
    console.log(`\n🔄 Migrating ${azureTableName} → ${supabaseTableName}`);
    
    // Query data from Azure
    const azureData = await queryAzureTable(connection, azureTableName, limit);
    
    if (!azureData || azureData.length === 0) {
      console.log(`⚠️  No data found in ${azureTableName}`);
      return;
    }

    // Insert data into Supabase
    await insertIntoSupabase(supabaseTableName, azureData);
    
    console.log(`✅ Successfully migrated ${azureTableName} → ${supabaseTableName}`);
    
  } catch (error) {
    console.error(`❌ Failed to migrate ${azureTableName}:`, error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting Azure to Supabase data migration...\n');
  
  let connection = null;
  
  try {
    // Connect to Azure
    connection = await connectToAzure();
    
    // Define the tables you want to migrate
    // Add your specific table names here
    const tablesToMigrate = [
      // Format: ['azure_table_name', 'supabase_table_name']
      ['dim_ship', 'ships'],
      ['fact_sailing', 'sailings'],
      // Add more tables as needed
    ];
    
    // Migrate each table
    for (const [azureTable, supabaseTable] of tablesToMigrate) {
      await migrateTable(connection, azureTable, supabaseTable);
    }
    
    console.log('\n🎉 Data migration completed successfully!');
    console.log('📊 You can now query your local Supabase database');
    console.log('🔗 Supabase Dashboard: http://127.0.0.1:54323/');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  } finally {
    // Disconnect from Azure
    if (connection) {
      connection.close();
      console.log('🔌 Disconnected from Azure Synapse');
    }
  }
}

// Run the migration
main().catch(console.error);


