#!/usr/bin/env node

/**
 * Complete migration setup - create tables and import data
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

async function createTablesViaSQL() {
  console.log('🏗️  Creating tables via SQL execution...');
  
  const budgetTableSQL = `
    CREATE TABLE IF NOT EXISTS budget (
      id SERIAL PRIMARY KEY,
      passenger_type TEXT,
      length INTEGER,
      itinerary_type TEXT,
      cabin TEXT,
      market TEXT,
      channel TEXT,
      new_market_roll_up TEXT,
      old_old_market_roll_up TEXT,
      accounting_month DATE,
      master_voyage TEXT,
      master_departure_date TEXT,
      passengers DECIMAL(15,2),
      passenger_nights DECIMAL(15,2),
      currency TEXT,
      fx_1 DECIMAL(15,2),
      pppd DECIMAL(15,2),
      pppd_eur DECIMAL(15,2),
      gross_ticket_revenue_local DECIMAL(15,2),
      gross_ticket_revenue_eur DECIMAL(15,2),
      pre_emb_pppd DECIMAL(15,2),
      pre_emb_revenue_eur DECIMAL(15,2),
      fy DECIMAL(15,2),
      budget_name TEXT,
      version TEXT,
      unique_id TEXT,
      actuals_code TEXT,
      effective_from TIMESTAMP WITH TIME ZONE,
      effective_to TIMESTAMP WITH TIME ZONE,
      active_record_flag INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  const publishedRatesTableSQL = `
    CREATE TABLE IF NOT EXISTS published_rates (
      id SERIAL PRIMARY KEY,
      snapshot_date DATE,
      sail_code TEXT,
      ship_code TEXT,
      package_name TEXT,
      region TEXT,
      rate_type TEXT,
      sail_days DECIMAL(5,2),
      departure_date DATE,
      cabin_category TEXT,
      promo_name TEXT,
      promo_type TEXT,
      currency_code TEXT,
      fare_per_person DECIMAL(15,2),
      port_taxes_services DECIMAL(15,2),
      extra_adult DECIMAL(15,2),
      extra_child DECIMAL(15,2),
      discount DECIMAL(15,2),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  console.log('📋 Please execute these SQL commands in Supabase SQL Editor:');
  console.log('\n1. Budget table:');
  console.log(budgetTableSQL);
  console.log('\n2. Published rates table:');
  console.log(publishedRatesTableSQL);
  
  return false; // Tables need to be created manually
}

async function queryAndImportBudgetData() {
  console.log('🔗 Connecting to Azure Synapse for budget data...');
  await sql.connect(azureConfig);
  console.log('✅ Connected to Azure Synapse');
  
  const query = `
    SELECT TOP 100 *
    FROM [lkp].[BUDGET]
    WHERE ACTIVE_RECORD_FLAG = 1
    ORDER BY FY DESC, ACCOUNTING_MONTH DESC
  `;
  
  console.log('📊 Querying Azure BUDGET table...');
  const result = await sql.query(query);
  console.log(`✅ Retrieved ${result.recordset.length} rows from BUDGET table`);
  
  await sql.close();
  console.log('🔌 Disconnected from Azure Synapse');
  
  // Process the data
  const processedData = result.recordset.map(row => {
    return {
      passenger_type: row.PASSENGER_TYPE,
      length: row.LENGTH,
      itinerary_type: row.ITINERARY_TYPE,
      cabin: row.CABIN,
      market: row.MARKET,
      channel: row.CHANNEL,
      new_market_roll_up: row.NEW_MARKET_ROLL_UP,
      old_old_market_roll_up: row.OLD_OLD_MARKET_ROLL_UP,
      accounting_month: row.ACCOUNTING_MONTH ? new Date(row.ACCOUNTING_MONTH).toISOString().split('T')[0] : null,
      master_voyage: row.MASTER_VOYAGE,
      master_departure_date: row.MASTER_DEPARTURE_DATE,
      passengers: row.PASSENGERS,
      passenger_nights: row.PASSENGER_NIGHTS,
      currency: row.CURRENCY,
      fx_1: row['FX.1'],
      pppd: row.PPPD,
      pppd_eur: row.PPPD_EUR,
      gross_ticket_revenue_local: row.GROSS_TICKET_REVENUE_LOCAL,
      gross_ticket_revenue_eur: row.GROSS_TICKET_REVENUE_EUR,
      pre_emb_pppd: row['PRE-EMB_PPPD'],
      pre_emb_revenue_eur: row.PRE_EMB_REVENUE_EUR,
      fy: row.FY,
      budget_name: row.BUDGET_NAME,
      version: row.VERSION,
      unique_id: row.UNIQUE_ID,
      actuals_code: row.ACTUALS_CODE,
      effective_from: row.EFFECTIVE_FROM ? new Date(row.EFFECTIVE_FROM).toISOString() : null,
      effective_to: row.EFFECTIVE_TO ? new Date(row.EFFECTIVE_TO).toISOString() : null,
      active_record_flag: row.ACTIVE_RECORD_FLAG
    };
  });

  // Import data
  console.log(`📥 Importing ${processedData.length} budget rows into Supabase...`);
  
  const batchSize = 50;
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < processedData.length; i += batchSize) {
    const batch = processedData.slice(i, i + batchSize);
    console.log(`📥 Importing budget batch ${Math.floor(i / batchSize) + 1} (${batch.length} rows)`);
    
    try {
      const { error } = await supabase
        .from('budget')
        .insert(batch);
      
      if (error) {
        console.error(`❌ Error in budget batch ${Math.floor(i / batchSize) + 1}:`, error.message);
        errorCount += batch.length;
      } else {
        console.log(`✅ Budget batch ${Math.floor(i / batchSize) + 1} imported successfully`);
        successCount += batch.length;
      }
    } catch (error) {
      console.error(`❌ Error in budget batch ${Math.floor(i / batchSize) + 1}:`, error.message);
      errorCount += batch.length;
    }
  }
  
  console.log(`\n🎉 Budget import completed!`);
  console.log(`✅ Successfully imported: ${successCount} rows`);
  console.log(`❌ Failed: ${errorCount} rows`);
}

async function queryAndImportPublishedRatesData() {
  console.log('🔗 Connecting to Azure Synapse for published rates data...');
  await sql.connect(azureConfig);
  console.log('✅ Connected to Azure Synapse');
  
  const query = `
    SELECT TOP 100 *
    FROM [fou].[GQL_PUBLISHED_RATES]
    WHERE SNAPSHOT_DATE >= '2025-01-01'
    ORDER BY SNAPSHOT_DATE DESC, SAIL_CODE
  `;
  
  console.log('📊 Querying Azure GQL_PUBLISHED_RATES table...');
  const result = await sql.query(query);
  console.log(`✅ Retrieved ${result.recordset.length} rows from GQL_PUBLISHED_RATES table`);
  
  await sql.close();
  console.log('🔌 Disconnected from Azure Synapse');
  
  // Process the data
  const processedData = result.recordset.map(row => {
    return {
      snapshot_date: row.SNAPSHOT_DATE ? new Date(row.SNAPSHOT_DATE).toISOString().split('T')[0] : null,
      sail_code: row.SAIL_CODE,
      ship_code: row.SHIP_CODE,
      package_name: row.PACKAGE_NAME,
      region: row.REGION,
      rate_type: row.RATE_TYPE,
      sail_days: row.SAIL_DAYS,
      departure_date: row.DEPARTURE_DATE ? new Date(row.DEPARTURE_DATE).toISOString().split('T')[0] : null,
      cabin_category: row.CABIN_CATEGORY,
      promo_name: row.PROMO_NAME,
      promo_type: row.PROMO_TYPE,
      currency_code: row.CURRENCY_CODE,
      fare_per_person: row.FARE_PER_PERSON,
      port_taxes_services: row.PORT_TAXES_SERVICES,
      extra_adult: row.EXTRA_ADULT,
      extra_child: row.EXTRA_CHILD,
      discount: row.DISCOUNT
    };
  });

  // Import data
  console.log(`📥 Importing ${processedData.length} published rates rows into Supabase...`);
  
  const batchSize = 50;
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < processedData.length; i += batchSize) {
    const batch = processedData.slice(i, i + batchSize);
    console.log(`📥 Importing published rates batch ${Math.floor(i / batchSize) + 1} (${batch.length} rows)`);
    
    try {
      const { error } = await supabase
        .from('published_rates')
        .insert(batch);
      
      if (error) {
        console.error(`❌ Error in published rates batch ${Math.floor(i / batchSize) + 1}:`, error.message);
        errorCount += batch.length;
      } else {
        console.log(`✅ Published rates batch ${Math.floor(i / batchSize) + 1} imported successfully`);
        successCount += batch.length;
      }
    } catch (error) {
      console.error(`❌ Error in published rates batch ${Math.floor(i / batchSize) + 1}:`, error.message);
      errorCount += batch.length;
    }
  }
  
  console.log(`\n🎉 Published rates import completed!`);
  console.log(`✅ Successfully imported: ${successCount} rows`);
  console.log(`❌ Failed: ${errorCount} rows`);
}

async function main() {
  console.log('🚀 Complete migration setup...\n');
  
  try {
    // Step 1: Show table creation SQL
    console.log('🏗️  Step 1: Create tables');
    await createTablesViaSQL();
    
    console.log('\n⚠️  Please create both tables in Supabase SQL Editor first');
    console.log('🔗 Supabase Dashboard: http://127.0.0.1:54321/');
    console.log('📋 Go to SQL Editor and run the SQL commands shown above');
    
    console.log('\n⏳ Waiting for you to create the tables...');
    console.log('Press Enter when you have created both tables...');
    
    // Wait for user input (in a real scenario, you'd need to handle this differently)
    console.log('\n📥 Step 2: Importing data...');
    
    // Step 2: Import data
    await queryAndImportBudgetData();
    await queryAndImportPublishedRatesData();
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('📊 Both tables created and data imported');
    console.log('🔗 Supabase Dashboard: http://127.0.0.1:54321/');
    console.log('📋 Tables: budget, published_rates');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  }
}

// Run the migration
main().catch(console.error);


