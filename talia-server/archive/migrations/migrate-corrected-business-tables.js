#!/usr/bin/env node

/**
 * Migrate key business tables with correct column mappings for 2025-2026 data
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

// Define key business tables with correct column mappings
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
    filter: '1=1', // All allocations
    orderBy: 'Res_ID DESC',
    createSQL: `
      CREATE TABLE IF NOT EXISTS cabin_allocation (
        id SERIAL PRIMARY KEY,
        res_id BIGINT,
        ship_code TEXT,
        cabin_category TEXT,
        cabin_number TEXT,
        occupancy INTEGER,
        price_category TEXT,
        cabin_seq_number INTEGER,
        inventory_request_type TEXT,
        inventory_result_type TEXT,
        allocation_owner_type TEXT,
        probability DECIMAL(5,2),
        allocation_id BIGINT,
        allocation_owner_id BIGINT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  },
  'master_sail': {
    schema: 'dwh',
    table: 'Dim_Master_Sail',
    filter: 'YEAR(Sail_Date_From) = 2025 OR YEAR(Sail_Date_From) = 2026',
    orderBy: 'Sail_Date_From DESC',
    createSQL: `
      CREATE TABLE IF NOT EXISTS master_sail (
        id SERIAL PRIMARY KEY,
        sail_id BIGINT,
        ship_code TEXT,
        ship_name TEXT,
        sail_date_from DATE,
        port_from TEXT,
        sail_date_to DATE,
        port_to TEXT,
        package_id BIGINT,
        package_type TEXT,
        sail_code TEXT,
        package_name TEXT,
        sail_days INTEGER,
        geog_area_code TEXT,
        vacation_date DATE,
        season_code TEXT,
        is_fake TEXT,
        is_active TEXT,
        is_package_active TEXT,
        master_voyage_departure_date DATE,
        master_voyage1 TEXT,
        master_voyage1_length INTEGER,
        master_voyage1_sail_days INTEGER,
        master_voyage2 TEXT,
        master_voyage2_length INTEGER,
        master_voyage2_sail_days INTEGER,
        is_main INTEGER,
        is_primary INTEGER,
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
        ship_id INTEGER,
        ship_code TEXT,
        ship_name TEXT,
        ship_pax_capacity TEXT,
        ship_length TEXT,
        ship_tonnage TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  },
  'itinerary': {
    schema: 'dwh',
    table: 'Dim_Itinerary',
    filter: 'YEAR(Sail_Date) = 2025 OR YEAR(Sail_Date) = 2026',
    orderBy: 'Sail_Date DESC',
    createSQL: `
      CREATE TABLE IF NOT EXISTS itinerary (
        id SERIAL PRIMARY KEY,
        sail_code TEXT,
        itinerary_code TEXT,
        package_name TEXT,
        cruise_day DECIMAL(5,2),
        port_code TEXT,
        port_name TEXT,
        sail_date DATE,
        arrival_time TEXT,
        departure_time TEXT,
        first_day INTEGER,
        last_day INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  },
  'reservation': {
    schema: 'dwh',
    table: 'Fact_Reservation',
    filter: 'YEAR(Sail_From_Date) = 2025 OR YEAR(Sail_From_Date) = 2026',
    orderBy: 'Sail_From_Date DESC',
    createSQL: `
      CREATE TABLE IF NOT EXISTS reservation (
        id SERIAL PRIMARY KEY,
        res_id BIGINT,
        res_status TEXT,
        source_code TEXT,
        res_probability DECIMAL(5,2),
        pax_type TEXT,
        pax_status TEXT,
        ship TEXT,
        sail_code TEXT,
        sail_duration INTEGER,
        sail_from_date DATE,
        sail_to_date DATE,
        agency_id BIGINT,
        sec_agency_id BIGINT,
        agency_channel TEXT,
        agency_country_code TEXT,
        agency_market TEXT,
        cabin_type TEXT,
        cabin_category TEXT,
        ticket_type TEXT,
        promo_code INTEGER,
        currency TEXT,
        currency_rate DECIMAL(10,6),
        guest_count DECIMAL(5,2),
        foc_guest_count DECIMAL(5,2),
        gross_published_fare DECIMAL(15,2),
        gross_selling_fare DECIMAL(15,2),
        net_selling_fare DECIMAL(15,2),
        cruise_fare_comm DECIMAL(15,2),
        published_discount DECIMAL(15,2),
        promotional_discounts DECIMAL(15,2),
        total_discounts DECIMAL(15,2),
        gross_ticket_revenue DECIMAL(15,2),
        net_ticket_revenue DECIMAL(15,2),
        net_invoice_revenue DECIMAL(15,2),
        gross_ticket_revenue_eur DECIMAL(15,2),
        net_ticket_revenue_eur DECIMAL(15,2),
        net_invoice_revenue_eur DECIMAL(15,2),
        total_discounts_eur DECIMAL(15,2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  },
  'gql_cabin_availability': {
    schema: 'fou',
    table: 'GQL_CABIN_AVAILABILITY',
    filter: 'YEAR(SNAPSHOT_DATE) = 2025 OR YEAR(SNAPSHOT_DATE) = 2026',
    orderBy: 'SNAPSHOT_DATE DESC',
    createSQL: `
      CREATE TABLE IF NOT EXISTS gql_cabin_availability (
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
  'sail_header': {
    schema: 'fou',
    table: 'SAIL_HEADER',
    filter: 'YEAR(SAIL_DATE_FROM) = 2025 OR YEAR(SAIL_DATE_FROM) = 2026',
    orderBy: 'SAIL_DATE_FROM DESC',
    createSQL: `
      CREATE TABLE IF NOT EXISTS sail_header (
        id SERIAL PRIMARY KEY,
        sk_id INTEGER,
        sail_id BIGINT,
        ship_code TEXT,
        sail_date_from DATE,
        sail_date_to DATE,
        rel_day_from INTEGER,
        rel_day_to INTEGER,
        season_code TEXT,
        port_from TEXT,
        port_to TEXT,
        geog_area_code TEXT,
        is_fake TEXT,
        is_active TEXT,
        comments TEXT,
        sail_status TEXT,
        sail_code TEXT,
        dep_ref_id BIGINT,
        arr_ref_id BIGINT,
        route_code TEXT,
        is_locked TEXT,
        effective_from TIMESTAMP WITH TIME ZONE,
        effective_to TIMESTAMP WITH TIME ZONE,
        active_record_flag INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  },
  'ship_cabin': {
    schema: 'fou',
    table: 'SHIP_CABIN',
    filter: 'ACTIVE_RECORD_FLAG = 1',
    orderBy: 'SHIP_CODE, CABIN_NUMBER',
    createSQL: `
      CREATE TABLE IF NOT EXISTS ship_cabin (
        id SERIAL PRIMARY KEY,
        ship_code TEXT,
        cabin_number TEXT,
        cabin_id BIGINT,
        deck_number INTEGER,
        cabin_name TEXT,
        comments TEXT,
        image_id BIGINT,
        cabin_rank INTEGER,
        firezone_code TEXT,
        ext_cabin_id BIGINT,
        record_added_manually TEXT,
        effective_from TIMESTAMP WITH TIME ZONE,
        effective_to TIMESTAMP WITH TIME ZONE,
        active_record_flag INTEGER,
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
  
  // Process data based on table type with correct column mappings
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
        res_id: row.Res_ID,
        ship_code: row.Ship_Code,
        cabin_category: row.Cabin_Category,
        cabin_number: row.Cabin_Number,
        occupancy: row.Occupancy,
        price_category: row.Price_Category,
        cabin_seq_number: row.Cabin_Seq_Number,
        inventory_request_type: row.Inventory_Request_Type,
        inventory_result_type: row.Inventory_Result_Type,
        allocation_owner_type: row.Allocation_Owner_Type,
        probability: row.Probability,
        allocation_id: row.Allocation_ID,
        allocation_owner_id: row.Allocation_Owner_ID
      }));
      break;
      
    case 'master_sail':
      processedData = data.map(row => ({
        sail_id: row.Sail_ID,
        ship_code: row.Ship_Code,
        ship_name: row.Ship_name,
        sail_date_from: row.Sail_Date_From ? new Date(row.Sail_Date_From).toISOString().split('T')[0] : null,
        port_from: row.Port_From,
        sail_date_to: row.Sail_Date_To ? new Date(row.Sail_Date_To).toISOString().split('T')[0] : null,
        port_to: row.Port_To,
        package_id: row.Package_ID,
        package_type: row.Package_Type,
        sail_code: row.Sail_Code,
        package_name: row.Package_Name,
        sail_days: row.Sail_Days,
        geog_area_code: row.Geog_Area_Code,
        vacation_date: row.Vacation_Date ? new Date(row.Vacation_Date).toISOString().split('T')[0] : null,
        season_code: row.Season_Code,
        is_fake: row.IS_Fake,
        is_active: row.IS_Active,
        is_package_active: row.IS_Package_Active,
        master_voyage_departure_date: row.Master_Voyage_Departure_date ? new Date(row.Master_Voyage_Departure_date).toISOString().split('T')[0] : null,
        master_voyage1: row.Master_Voyage1,
        master_voyage1_length: row.Master_Voyage1_Length,
        master_voyage1_sail_days: row.Master_Voyage1_Sail_Days,
        master_voyage2: row.Master_Voyage2,
        master_voyage2_length: row.Master_Voyage2_Length,
        master_voyage2_sail_days: row.Master_Voyage2_Sail_Days,
        is_main: row.IS_Main,
        is_primary: row.IS_Primary
      }));
      break;
      
    case 'ship':
      processedData = data.map(row => ({
        ship_id: row.Ship_Id,
        ship_code: row.Ship_Code,
        ship_name: row.Ship_Name,
        ship_pax_capacity: row.Ship_Pax_Capacity,
        ship_length: row.Ship_Length,
        ship_tonnage: row.Ship_Tonnage
      }));
      break;
      
    case 'itinerary':
      processedData = data.map(row => ({
        sail_code: row.Sail_Code,
        itinerary_code: row.Itinerary_Code,
        package_name: row.Package_Name,
        cruise_day: row.Cruise_Day,
        port_code: row.Port_Code,
        port_name: row.Port_Name,
        sail_date: row.Sail_Date ? new Date(row.Sail_Date).toISOString().split('T')[0] : null,
        arrival_time: row.Arrival_Time,
        departure_time: row.Departure_Time,
        first_day: row.First_Day,
        last_day: row.Last_Day
      }));
      break;
      
    case 'reservation':
      processedData = data.map(row => ({
        res_id: row.Res_ID,
        res_status: row.Res_Status,
        source_code: row.Source_Code,
        res_probability: row.Res_Probability,
        pax_type: row.Pax_Type,
        pax_status: row.Pax_Status,
        ship: row.Ship,
        sail_code: row.Sail_code,
        sail_duration: row.Sail_Duration,
        sail_from_date: row.Sail_From_Date ? new Date(row.Sail_From_Date).toISOString().split('T')[0] : null,
        sail_to_date: row.Sail_To_Date ? new Date(row.Sail_To_Date).toISOString().split('T')[0] : null,
        agency_id: row.Agency_ID,
        sec_agency_id: row.Sec_Agency_ID,
        agency_channel: row.Agency_Channel,
        agency_country_code: row.Agency_Country_Code,
        agency_market: row.Agency_Market,
        cabin_type: row.Cabin_Type,
        cabin_category: row.Cabin_Category,
        ticket_type: row.Ticket_Type,
        promo_code: row.Promo_Code,
        currency: row.Currency,
        currency_rate: row.Currency_Rate,
        guest_count: row.Guest_Count,
        foc_guest_count: row.FOC_Guest_Count,
        gross_published_fare: row.GrossPublishedFare,
        gross_selling_fare: row.GrossSellingFare,
        net_selling_fare: row.NetSellingFare,
        cruise_fare_comm: row.CruiseFareComm,
        published_discount: row.PublishedDiscount,
        promotional_discounts: row.PromotionalDiscounts,
        total_discounts: row.TotalDiscounts,
        gross_ticket_revenue: row.GrossTicketRevenue,
        net_ticket_revenue: row.NetTicketRevenue,
        net_invoice_revenue: row.NetInvoiceRevenue,
        gross_ticket_revenue_eur: row.GrossTicketRevenueEUR,
        net_ticket_revenue_eur: row.NetTicketRevenueEUR,
        net_invoice_revenue_eur: row.NetInvoiceRevenueEUR,
        total_discounts_eur: row.TotalDiscountsEUR
      }));
      break;
      
    case 'gql_cabin_availability':
      processedData = data.map(row => ({
        snapshot_date: row.SNAPSHOT_DATE ? new Date(row.SNAPSHOT_DATE).toISOString().split('T')[0] : null,
        sail_code: row.SAIL_CODE,
        package_name: row.PACKAGE_NAME,
        sail_days: row.SAIL_DAYS,
        cabin_category: row.CABIN_CATEGORY,
        available_cabins: row.AVAILABLE_CABINS,
        total_cabins: row.TOTAL_CABINS,
        available_absolute: row.AVAILABLE_ABSOLUTE,
        available_weighted: row.AVAILABLE_WEIGHTED,
        availability_result: row.AVAILABILITY_RESULT,
        nested_cabins: row.NESTED_CABINS
      }));
      break;
      
    case 'sail_header':
      processedData = data.map(row => ({
        sk_id: row.SK_ID,
        sail_id: row.SAIL_ID,
        ship_code: row.SHIP_CODE,
        sail_date_from: row.SAIL_DATE_FROM ? new Date(row.SAIL_DATE_FROM).toISOString().split('T')[0] : null,
        sail_date_to: row.SAIL_DATE_TO ? new Date(row.SAIL_DATE_TO).toISOString().split('T')[0] : null,
        rel_day_from: row.REL_DAY_FROM,
        rel_day_to: row.REL_DAY_TO,
        season_code: row.SEASON_CODE,
        port_from: row.PORT_FROM,
        port_to: row.PORT_TO,
        geog_area_code: row.GEOG_AREA_CODE,
        is_fake: row.IS_FAKE,
        is_active: row.IS_ACTIVE,
        comments: row.COMMENTS,
        sail_status: row.SAIL_STATUS,
        sail_code: row.SAIL_CODE,
        dep_ref_id: row.DEP_REF_ID,
        arr_ref_id: row.ARR_REF_ID,
        route_code: row.ROUTE_CODE,
        is_locked: row.IS_LOCKED,
        effective_from: row.EFFECTIVE_FROM ? new Date(row.EFFECTIVE_FROM).toISOString() : null,
        effective_to: row.EFFECTIVE_TO ? new Date(row.EFFECTIVE_TO).toISOString() : null,
        active_record_flag: row.ACTIVE_RECORD_FLAG
      }));
      break;
      
    case 'ship_cabin':
      processedData = data.map(row => ({
        ship_code: row.SHIP_CODE,
        cabin_number: row.CABIN_NUMBER,
        cabin_id: row.CABIN_ID,
        deck_number: row.DECK_NUMBER,
        cabin_name: row.CABIN_NAME,
        comments: row.COMMENTS,
        image_id: row.IMAGE_ID,
        cabin_rank: row.CABIN_RANK,
        firezone_code: row.FIREZONE_CODE,
        ext_cabin_id: row.EXT_CABIN_ID,
        record_added_manually: row.RECORD_ADDED_MANUALLY,
        effective_from: row.EFFECTIVE_FROM ? new Date(row.EFFECTIVE_FROM).toISOString() : null,
        effective_to: row.EFFECTIVE_TO ? new Date(row.EFFECTIVE_TO).toISOString() : null,
        active_record_flag: row.ACTIVE_RECORD_FLAG
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
  console.log('🚀 Migrating key business tables with correct column mappings for 2025-2026 data...\n');
  
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


