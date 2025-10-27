#!/usr/bin/env node

/**
 * Migrate Dim_Cabin_Availability from Azure Synapse to Supabase using mssql
 * Filters for 2025 data only
 */

import dotenv from 'dotenv';
import sql from 'mssql';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

// Azure Synapse configuration
const azureConfig = {
  server: process.env.AZURE_SYNAPSE_SERVER || 'celestyaldataplatform-prd.sql.azuresynapse.net',
  port: parseInt(process.env.AZURE_SYNAPSE_PORT) || 1433,
  database: process.env.AZURE_SYNAPSE_DATABASE || 'CDP_Dedicated_SQL_DWH',
  user: process.env.AZURE_SYNAPSE_USERNAME || 'RBryer',
  password: process.env.AZURE_SYNAPSE_PASSWORD || 'Cele5tyalrbUser!',
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true
  }
};

// Supabase configuration
const supabaseConfig = {
  url: process.env.SUPABASE_URL || 'http://127.0.0.1:54323',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key-here'
};

// Initialize Supabase client
const supabase = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey);

async function queryCabinAvailability2025() {
  console.log('🔗 Connecting to Azure Synapse...');
  await sql.connect(azureConfig);
  console.log('✅ Connected to Azure Synapse');
  
  // SQL query to get 2025 data from Dim_Cabin_Availability
  const query = `
    SELECT TOP 1000 *
    FROM [dwh].[Dim_Cabin_Availability]
    WHERE YEAR([Snapshot_Date]) = 2025
    ORDER BY [Snapshot_Date] DESC
  `;
  
  console.log('📊 Querying Azure table: [dwh].[Dim_Cabin_Availability] for 2025 data');
  console.log('🔍 SQL:', query);
  
  const result = await sql.query(query);
  console.log(`✅ Retrieved ${result.recordset.length} rows from Dim_Cabin_Availability`);
  
  await sql.close();
  console.log('🔌 Disconnected from Azure Synapse');
  
  return result.recordset;
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

    // Insert data in batches to avoid timeout
    const batchSize = 100;
    for (let i = 0; i < processedData.length; i += batchSize) {
      const batch = processedData.slice(i, i + batchSize);
      console.log(`📥 Inserting batch ${Math.floor(i / batchSize) + 1} (${batch.length} rows)`);
      
      const { error } = await supabase
        .from('cabin_availability')
        .insert(batch);

      if (error) {
        console.error('❌ Error inserting batch:', error);
        throw error;
      }
    }
    
    console.log('✅ Successfully inserted all data into cabin_availability');
  } catch (error) {
    console.error('❌ Failed to insert data:', error);
    throw error;
  }
}

async function migrateCabinAvailability() {
  console.log('🚀 Starting Dim_Cabin_Availability migration (2025 data only)...\n');
  
  try {
    // Step 1: Query 2025 data from Azure
    const azureData = await queryCabinAvailability2025();
    
    if (!azureData || azureData.length === 0) {
      console.log('⚠️  No 2025 data found in Dim_Cabin_Availability');
      return;
    }

    console.log(`📊 Found ${azureData.length} records for 2025`);
    
    // Step 2: Clear Supabase table
    await clearSupabaseTable();
    
    // Step 3: Insert data into Supabase
    await insertIntoSupabase(azureData);
    
    console.log('\n🎉 Cabin Availability migration completed successfully!');
    console.log('📊 You can now query your local Supabase database');
    console.log('🔗 Supabase Dashboard: http://127.0.0.1:54323/');
    console.log('📋 Table: cabin_availability');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  }
}

// Run the migration
migrateCabinAvailability().catch(console.error);


