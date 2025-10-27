#!/usr/bin/env node

/**
 * Create tables and import data directly from Azure to Supabase
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

async function queryBudgetData() {
  console.log('🔗 Connecting to Azure Synapse...');
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
  
  return result.recordset;
}

async function queryPublishedRatesData() {
  console.log('🔗 Connecting to Azure Synapse...');
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
  
  return result.recordset;
}

async function createBudgetTableWithData(azureData) {
  console.log('🏗️  Creating budget table and importing data...');
  
  if (!azureData || azureData.length === 0) {
    console.log('⚠️  No budget data to import');
    return;
  }

  // Process the data to match expected schema
  const processedData = azureData.map(row => {
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

  // Try to insert data - this will create the table if it doesn't exist
  try {
    const { data, error } = await supabase
      .from('budget')
      .insert(processedData);

    if (error) {
      console.log('❌ Error inserting budget data:', error.message);
      console.log('📋 Please create the budget table manually first');
      return false;
    } else {
      console.log(`✅ Budget table created and ${processedData.length} rows imported successfully`);
      return true;
    }
  } catch (error) {
    console.log('❌ Error creating budget table:', error.message);
    console.log('📋 Please create the budget table manually first');
    return false;
  }
}

async function createPublishedRatesTableWithData(azureData) {
  console.log('🏗️  Creating published_rates table and importing data...');
  
  if (!azureData || azureData.length === 0) {
    console.log('⚠️  No published rates data to import');
    return;
  }

  // Process the data to match expected schema
  const processedData = azureData.map(row => {
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

  // Try to insert data - this will create the table if it doesn't exist
  try {
    const { data, error } = await supabase
      .from('published_rates')
      .insert(processedData);

    if (error) {
      console.log('❌ Error inserting published rates data:', error.message);
      console.log('📋 Please create the published_rates table manually first');
      return false;
    } else {
      console.log(`✅ Published rates table created and ${processedData.length} rows imported successfully`);
      return true;
    }
  } catch (error) {
    console.log('❌ Error creating published rates table:', error.message);
    console.log('📋 Please create the published_rates table manually first');
    return false;
  }
}

async function main() {
  console.log('🚀 Creating tables and importing data directly...\n');
  
  try {
    // Step 1: Query data from Azure
    console.log('📊 Querying data from Azure...');
    const budgetData = await queryBudgetData();
    const publishedRatesData = await queryPublishedRatesData();
    
    // Step 2: Create tables and import data
    console.log('\n📥 Creating tables and importing data...');
    const budgetSuccess = await createBudgetTableWithData(budgetData);
    const publishedRatesSuccess = await createPublishedRatesTableWithData(publishedRatesData);
    
    if (budgetSuccess && publishedRatesSuccess) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('📊 Both tables created and data imported');
      console.log('🔗 Supabase Dashboard: http://127.0.0.1:54321/');
      console.log('📋 Tables: budget, published_rates');
    } else {
      console.log('\n⚠️  Some tables could not be created automatically');
      console.log('📋 Please create the missing tables manually in Supabase SQL Editor');
      console.log('🔗 Supabase Dashboard: http://127.0.0.1:54321/');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  }
}

// Run the migration
main().catch(console.error);


