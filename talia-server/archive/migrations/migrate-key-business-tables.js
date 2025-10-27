#!/usr/bin/env node

/**
 * Migrate key business tables with ALL 2025-2026 data
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

// Define key business tables for migration
const KEY_TABLES = {
  'cabin_availability': {
    schema: 'dwh',
    table: 'Dim_Cabin_Availability',
    filter: 'YEAR(Snapshot_Date) = 2025 OR YEAR(Snapshot_Date) = 2026',
    orderBy: 'Snapshot_Date DESC, Sail_Code',
    createSQL: `
      CREATE TABLE IF NOT EXISTS cabin_availability (
        id SERIAL PRIMARY KEY,
        snapshot_date DATE,
        sail_code TEXT,
        package_name TEXT,
        sail_days INTEGER,
        cabin_category TEXT,
        available_cabins INTEGER,
        total_cabins INTEGER,
        available_absolute INTEGER,
        available_weighted DECIMAL(10,2),
        availability_result TEXT,
        nested_cabins INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  },
  'cabin_allocation': {
    schema: 'dwh',
    table: 'Dim_Cabin_Allocation',
    filter: 'YEAR(Allocation_Date) = 2025 OR YEAR(Allocation_Date) = 2026',
    orderBy: 'Allocation_Date DESC',
    createSQL: `
      CREATE TABLE IF NOT EXISTS cabin_allocation (
        id SERIAL PRIMARY KEY,
        allocation_date DATE,
        sail_code TEXT,
        cabin_category TEXT,
        allocated_cabins INTEGER,
        total_cabins INTEGER,
        allocation_percentage DECIMAL(5,2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  },
  'master_sail': {
    schema: 'dwh',
    table: 'Dim_Master_Sail',
    filter: 'YEAR(Departure_Date) = 2025 OR YEAR(Departure_Date) = 2026',
    orderBy: 'Departure_Date DESC',
    createSQL: `
      CREATE TABLE IF NOT EXISTS master_sail (
        id SERIAL PRIMARY KEY,
        sail_code TEXT,
        ship_code TEXT,
        departure_date DATE,
        arrival_date DATE,
        itinerary_code TEXT,
        package_name TEXT,
        sail_days INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  },
  'ship': {
    schema: 'dwh',
    table: 'Dim_Ship',
    filter: '1=1', // All ships
    orderBy: 'Ship_Code',
    createSQL: `
      CREATE TABLE IF NOT EXISTS ship (
        id SERIAL PRIMARY KEY,
        ship_code TEXT,
        ship_name TEXT,
        capacity INTEGER,
        built_year INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  },
  'itinerary': {
    schema: 'dwh',
    table: 'Dim_Itinerary',
    filter: '1=1', // All itineraries
    orderBy: 'Itinerary_Code',
    createSQL: `
      CREATE TABLE IF NOT EXISTS itinerary (
        id SERIAL PRIMARY KEY,
        itinerary_code TEXT,
        itinerary_name TEXT,
        region TEXT,
        duration_days INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  },
  'reservation': {
    schema: 'dwh',
    table: 'Fact_Reservation',
    filter: 'YEAR(Booking_Date) = 2025 OR YEAR(Booking_Date) = 2026',
    orderBy: 'Booking_Date DESC',
    createSQL: `
      CREATE TABLE IF NOT EXISTS reservation (
        id SERIAL PRIMARY KEY,
        reservation_id TEXT,
        booking_date DATE,
        sail_code TEXT,
        cabin_category TEXT,
        passenger_count INTEGER,
        total_revenue DECIMAL(15,2),
        currency TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  },
  'gql_cabin_availability': {
    schema: 'fou',
    table: 'GQL_CABIN_AVAILABILITY',
    filter: 'YEAR(Snapshot_Date) = 2025 OR YEAR(Snapshot_Date) = 2026',
    orderBy: 'Snapshot_Date DESC',
    createSQL: `
      CREATE TABLE IF NOT EXISTS gql_cabin_availability (
        id SERIAL PRIMARY KEY,
        snapshot_date DATE,
        sail_code TEXT,
        cabin_category TEXT,
        available_cabins INTEGER,
        total_cabins INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  },
  'sail_header': {
    schema: 'fou',
    table: 'SAIL_HEADER',
    filter: 'YEAR(Departure_Date) = 2025 OR YEAR(Departure_Date) = 2026',
    orderBy: 'Departure_Date DESC',
    createSQL: `
      CREATE TABLE IF NOT EXISTS sail_header (
        id SERIAL PRIMARY KEY,
        sail_code TEXT,
        ship_code TEXT,
        departure_date DATE,
        arrival_date DATE,
        itinerary_name TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  },
  'ship_cabin': {
    schema: 'fou',
    table: 'SHIP_CABIN',
    filter: '1=1', // All ship cabins
    orderBy: 'Ship_Code, Cabin_Category',
    createSQL: `
      CREATE TABLE IF NOT EXISTS ship_cabin (
        id SERIAL PRIMARY KEY,
        ship_code TEXT,
        cabin_category TEXT,
        cabin_name TEXT,
        capacity INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  }
};

async function createTable(tableName, config) {
  console.log(`🏗️  Creating ${tableName} table...`);
  
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error && error.code === 'PGRST116') {
      console.log(`❌ Table ${tableName} does not exist`);
      console.log(`📋 Please create the ${tableName} table manually in Supabase SQL Editor:`);
      console.log(config.createSQL);
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

async function importTableData(tableName, data, config) {
  if (!data || data.length === 0) {
    console.log(`⚠️  No data to import for ${tableName}`);
    return;
  }

  console.log(`📥 Importing ${data.length} rows into ${tableName} table...`);
  
  // Process data based on table type
  let processedData;
  
  switch (tableName) {
    case 'cabin_availability':
      processedData = data.map(row => ({
        snapshot_date: row.Snapshot_Date ? new Date(row.Snapshot_Date).toISOString().split('T')[0] : null,
        sail_code: row.Sail_Code,
        package_name: row.Package_Name,
        sail_days: row.Sail_Days,
        cabin_category: row.Cabin_Category,
        available_cabins: row.Available_Cabins,
        total_cabins: row.Total_Cabins,
        available_absolute: row.Available_Absolute,
        available_weighted: row.Available_Weighted,
        availability_result: row.Availability_Result,
        nested_cabins: row.Nested_Cabins
      }));
      break;
      
    case 'cabin_allocation':
      processedData = data.map(row => ({
        allocation_date: row.Allocation_Date ? new Date(row.Allocation_Date).toISOString().split('T')[0] : null,
        sail_code: row.Sail_Code,
        cabin_category: row.Cabin_Category,
        allocated_cabins: row.Allocated_Cabins,
        total_cabins: row.Total_Cabins,
        allocation_percentage: row.Allocation_Percentage
      }));
      break;
      
    case 'master_sail':
      processedData = data.map(row => ({
        sail_code: row.Sail_Code,
        ship_code: row.Ship_Code,
        departure_date: row.Departure_Date ? new Date(row.Departure_Date).toISOString().split('T')[0] : null,
        arrival_date: row.Arrival_Date ? new Date(row.Arrival_Date).toISOString().split('T')[0] : null,
        itinerary_code: row.Itinerary_Code,
        package_name: row.Package_Name,
        sail_days: row.Sail_Days
      }));
      break;
      
    case 'ship':
      processedData = data.map(row => ({
        ship_code: row.Ship_Code,
        ship_name: row.Ship_Name,
        capacity: row.Capacity,
        built_year: row.Built_Year
      }));
      break;
      
    case 'itinerary':
      processedData = data.map(row => ({
        itinerary_code: row.Itinerary_Code,
        itinerary_name: row.Itinerary_Name,
        region: row.Region,
        duration_days: row.Duration_Days
      }));
      break;
      
    case 'reservation':
      processedData = data.map(row => ({
        reservation_id: row.Reservation_ID,
        booking_date: row.Booking_Date ? new Date(row.Booking_Date).toISOString().split('T')[0] : null,
        sail_code: row.Sail_Code,
        cabin_category: row.Cabin_Category,
        passenger_count: row.Passenger_Count,
        total_revenue: row.Total_Revenue,
        currency: row.Currency
      }));
      break;
      
    case 'gql_cabin_availability':
      processedData = data.map(row => ({
        snapshot_date: row.Snapshot_Date ? new Date(row.Snapshot_Date).toISOString().split('T')[0] : null,
        sail_code: row.Sail_Code,
        cabin_category: row.Cabin_Category,
        available_cabins: row.Available_Cabins,
        total_cabins: row.Total_Cabins
      }));
      break;
      
    case 'sail_header':
      processedData = data.map(row => ({
        sail_code: row.Sail_Code,
        ship_code: row.Ship_Code,
        departure_date: row.Departure_Date ? new Date(row.Departure_Date).toISOString().split('T')[0] : null,
        arrival_date: row.Arrival_Date ? new Date(row.Arrival_Date).toISOString().split('T')[0] : null,
        itinerary_name: row.Itinerary_Name
      }));
      break;
      
    case 'ship_cabin':
      processedData = data.map(row => ({
        ship_code: row.Ship_Code,
        cabin_category: row.Cabin_Category,
        cabin_name: row.Cabin_Name,
        capacity: row.Capacity
      }));
      break;
      
    default:
      console.log(`⚠️  Unknown table type: ${tableName}`);
      return;
  }

  // Import data in batches
  const batchSize = 100;
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < processedData.length; i += batchSize) {
    const batch = processedData.slice(i, i + batchSize);
    console.log(`📥 Importing ${tableName} batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(processedData.length / batchSize)} (${batch.length} rows)`);
    
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
  console.log('🚀 Migrating key business tables with 2025-2026 data...\n');
  
  const tablesToMigrate = Object.keys(KEY_TABLES);
  
  console.log('📋 Tables to migrate:');
  tablesToMigrate.forEach((tableName, index) => {
    const config = KEY_TABLES[tableName];
    console.log(`${index + 1}. ${tableName} (${config.schema}.${config.table})`);
  });
  
  try {
    for (const tableName of tablesToMigrate) {
      console.log(`\n🔄 Processing ${tableName}...`);
      
      const config = KEY_TABLES[tableName];
      
      // Check if table exists
      const tableExists = await createTable(tableName, config);
      if (!tableExists) {
        console.log(`⚠️  Skipping ${tableName} - table does not exist`);
        continue;
      }
      
      // Query data from Azure
      const data = await queryTableData(tableName, config);
      
      // Import data into Supabase
      await importTableData(tableName, data, config);
    }
    
    console.log('\n🎉 Key business tables migration completed!');
    console.log('📊 All selected tables migrated with 2025-2026 data');
    console.log('🔗 Supabase Dashboard: http://127.0.0.1:54321/');
    console.log('📋 Tables migrated: cabin_availability, cabin_allocation, master_sail, ship, itinerary, reservation, gql_cabin_availability, sail_header, ship_cabin');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  }
}

// Run the migration
main().catch(console.error);


