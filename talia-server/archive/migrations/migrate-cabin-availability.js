#!/usr/bin/env node

/**
 * Migrate Dim_Cabin_Availability from Azure Synapse to Supabase
 * Filters for 2025 data only
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

async function queryCabinAvailability2025(connection) {
  return new Promise((resolve, reject) => {
    // SQL query to get 2025 data from Dim_Cabin_Availability
    const sql = `
      SELECT TOP 1000 *
      FROM [dwh].[Dim_Cabin_Availability]
      WHERE YEAR([Snapshot_Date]) = 2025
      ORDER BY [Snapshot_Date] DESC
    `;
    
    console.log('📊 Querying Azure table: [dwh].[Dim_Cabin_Availability] for 2025 data');
    console.log('🔍 SQL:', sql);
    
    const request = new Request(sql, (err, rowCount, rows) => {
      if (err) {
        console.error('❌ Error querying Dim_Cabin_Availability:', err);
        reject(err);
      } else {
        console.log(`✅ Retrieved ${rowCount} rows from Dim_Cabin_Availability`);
        resolve(rows);
      }
    });
    
    connection.execSql(request);
  });
}

async function clearSupabaseTable() {
  try {
    console.log('🗑️  Clearing Supabase cabin_availability table...');
    const { error } = await supabase
      .from('cabin_availability')
      .delete()
      .neq('id', 0); // Delete all rows
    
    if (error) {
      console.log('⚠️  Could not clear table (might not exist yet):', error.message);
    } else {
      console.log('✅ Cleared cabin_availability table');
    }
  } catch (error) {
    console.log('⚠️  Could not clear table:', error.message);
  }
}

async function insertIntoSupabase(data) {
  if (!data || data.length === 0) {
    console.log('⚠️  No data to insert');
    return;
  }

  try {
    console.log(`📥 Inserting ${data.length} rows into Supabase cabin_availability table`);
    
    // Process the data to match Supabase schema
    const processedData = data.map(row => {
      return {
        Snapshot_Date: row.Snapshot_Date,
        Sailing_Id: row.Sailing_Id,
        Package_Name: row.Package_Name,
        Sail_Days: row.Sail_Days,
        Cabin_Category: row.Cabin_Category,
        Available_Cabins: row.Available_Cabins,
        Total_Cabins: row.Total_Cabins,
        Available_Absolute: row.Available_Absolute,
        Available_Weighted: row.Available_Weighted,
        Availability_Result: row.Availability_Result,
        Nested_Cabins: row.Nested_Cabins
      };
    });

    const { error } = await supabase
      .from('cabin_availability')
      .insert(processedData);

    if (error) {
      console.error('❌ Error inserting into cabin_availability:', error);
      throw error;
    } else {
      console.log('✅ Successfully inserted data into cabin_availability');
    }
  } catch (error) {
    console.error('❌ Failed to insert data:', error);
    throw error;
  }
}

async function migrateCabinAvailability() {
  console.log('🚀 Starting Dim_Cabin_Availability migration (2025 data only)...\n');
  
  let connection = null;
  
  try {
    // Step 1: Connect to Azure
    connection = await connectToAzure();
    
    // Step 2: Query 2025 data from Azure
    const azureData = await queryCabinAvailability2025(connection);
    
    if (!azureData || azureData.length === 0) {
      console.log('⚠️  No 2025 data found in Dim_Cabin_Availability');
      return;
    }

    console.log(`📊 Found ${azureData.length} records for 2025`);
    
    // Step 3: Clear Supabase table
    await clearSupabaseTable();
    
    // Step 4: Insert data into Supabase
    await insertIntoSupabase(azureData);
    
    console.log('\n🎉 Cabin Availability migration completed successfully!');
    console.log('📊 You can now query your local Supabase database');
    console.log('🔗 Supabase Dashboard: http://127.0.0.1:54323/');
    console.log('📋 Table: cabin_availability');
    
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
migrateCabinAvailability().catch(console.error);


