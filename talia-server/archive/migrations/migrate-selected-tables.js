#!/usr/bin/env node

/**
 * Migrate selected tables with ALL 2025-2026 data
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
  url: process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
};

// Initialize Supabase client
const supabase = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey);

// Define available tables for migration
const AVAILABLE_TABLES = {
  'budget': {
    schema: 'lkp',
    table: 'BUDGET',
    filter: 'ACTIVE_RECORD_FLAG = 1 AND (FY = 2025 OR FY = 2026)',
    orderBy: 'FY DESC, ACCOUNTING_MONTH DESC'
  },
  'published_rates': {
    schema: 'fou',
    table: 'GQL_PUBLISHED_RATES',
    filter: '(YEAR(SNAPSHOT_DATE) = 2025 OR YEAR(SNAPSHOT_DATE) = 2026) OR (YEAR(DEPARTURE_DATE) = 2025 OR YEAR(DEPARTURE_DATE) = 2026)',
    orderBy: 'SNAPSHOT_DATE DESC, SAIL_CODE'
  },
  'cabin_availability': {
    schema: 'dwh',
    table: 'Dim_Cabin_Availability',
    filter: 'YEAR(Snapshot_Date) = 2025',
    orderBy: 'Snapshot_Date DESC, Sail_Code'
  },
  'cabin_allocation': {
    schema: 'dwh',
    table: 'Dim_Cabin_Allocation',
    filter: 'YEAR(Allocation_Date) = 2025 OR YEAR(Allocation_Date) = 2026',
    orderBy: 'Allocation_Date DESC'
  },
  'master_sail': {
    schema: 'dwh',
    table: 'Dim_Master_Sail',
    filter: 'YEAR(Departure_Date) = 2025 OR YEAR(Departure_Date) = 2026',
    orderBy: 'Departure_Date DESC'
  },
  'ship': {
    schema: 'dwh',
    table: 'Dim_Ship',
    filter: '1=1', // All ships
    orderBy: 'Ship_Code'
  },
  'itinerary': {
    schema: 'dwh',
    table: 'Dim_Itinerary',
    filter: '1=1', // All itineraries
    orderBy: 'Itinerary_Code'
  }
};

async function queryTableData(tableName, config) {
  console.log(`🔗 Connecting to Azure Synapse for ${tableName}...`);
  await sql.connect(azureConfig);
  console.log('✅ Connected to Azure Synapse');
  
  const query = `
    SELECT *
    FROM [${config.schema}].[${config.table}]
    WHERE ${config.filter}
    ORDER BY ${config.orderBy}
  `;
  
  console.log(`📊 Querying ${config.schema}.${config.table}...`);
  const result = await sql.query(query);
  console.log(`✅ Retrieved ${result.recordset.length} rows from ${config.table}`);
  
  await sql.close();
  console.log('🔌 Disconnected from Azure Synapse');
  
  return result.recordset;
}

async function createTableIfNotExists(tableName) {
  console.log(`🏗️  Checking if ${tableName} table exists...`);
  
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error && error.code === 'PGRST116') {
      console.log(`❌ Table ${tableName} does not exist`);
      console.log(`📋 Please create the ${tableName} table manually in Supabase SQL Editor`);
      return false;
    } else {
      console.log(`✅ Table ${tableName} exists`);
      return true;
    }
  } catch (error) {
    console.log(`❌ Error checking ${tableName} table:`, error.message);
    return false;
  }
}

async function importTableData(tableName, data) {
  if (!data || data.length === 0) {
    console.log(`⚠️  No data to import for ${tableName}`);
    return;
  }

  console.log(`📥 Importing ${data.length} rows into ${tableName} table...`);
  
  // Import data in batches
  const batchSize = 100;
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    console.log(`📥 Importing ${tableName} batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(data.length / batchSize)} (${batch.length} rows)`);
    
    try {
      const { error } = await supabase
        .from(tableName)
        .insert(batch);
      
      if (error) {
        console.error(`❌ Error in ${tableName} batch ${Math.floor(i / batchSize) + 1}:`, error.message);
        errorCount += batch.length;
      } else {
        console.log(`✅ ${tableName} batch ${Math.floor(i / batchSize) + 1} imported successfully`);
        successCount += batch.length;
      }
    } catch (error) {
      console.error(`❌ Error in ${tableName} batch ${Math.floor(i / batchSize) + 1}:`, error.message);
      errorCount += batch.length;
    }
  }
  
  console.log(`\n🎉 ${tableName} import completed!`);
  console.log(`✅ Successfully imported: ${successCount} rows`);
  console.log(`❌ Failed: ${errorCount} rows`);
}

async function main() {
  console.log('🚀 Migrating selected tables with ALL 2025-2026 data...\n');
  
  // List available tables
  console.log('📋 Available tables for migration:');
  Object.keys(AVAILABLE_TABLES).forEach((tableName, index) => {
    const config = AVAILABLE_TABLES[tableName];
    console.log(`${index + 1}. ${tableName} (${config.schema}.${config.table})`);
  });
  
  console.log('\n🎯 Migrating the following tables:');
  console.log('- budget (lkp.BUDGET)');
  console.log('- published_rates (fou.GQL_PUBLISHED_RATES)');
  console.log('- cabin_availability (dwh.Dim_Cabin_Availability)');
  
  const tablesToMigrate = ['budget', 'published_rates', 'cabin_availability'];
  
  try {
    for (const tableName of tablesToMigrate) {
      console.log(`\n🔄 Processing ${tableName}...`);
      
      // Check if table exists
      const tableExists = await createTableIfNotExists(tableName);
      if (!tableExists) {
        console.log(`⚠️  Skipping ${tableName} - table does not exist`);
        continue;
      }
      
      // Query data from Azure
      const config = AVAILABLE_TABLES[tableName];
      const data = await queryTableData(tableName, config);
      
      // Import data into Supabase
      await importTableData(tableName, data);
    }
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('📊 All selected tables migrated');
    console.log('🔗 Supabase Dashboard: http://127.0.0.1:54321/');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  }
}

// Run the migration
main().catch(console.error);


