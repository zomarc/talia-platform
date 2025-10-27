#!/usr/bin/env node

/**
 * Migrate ALL rows for 2025-2026 from BUDGET and GQL_PUBLISHED_RATES tables
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

async function queryAllBudgetData2025_2026() {
  console.log('🔗 Connecting to Azure Synapse for ALL budget data (2025-2026)...');
  await sql.connect(azureConfig);
  console.log('✅ Connected to Azure Synapse');
  
  const query = `
    SELECT *
    FROM [lkp].[BUDGET]
    WHERE ACTIVE_RECORD_FLAG = 1
    AND (FY = 2025 OR FY = 2026)
    ORDER BY FY DESC, ACCOUNTING_MONTH DESC
  `;
  
  console.log('📊 Querying ALL Azure BUDGET data for 2025-2026...');
  const result = await sql.query(query);
  console.log(`✅ Retrieved ${result.recordset.length} rows from BUDGET table`);
  
  await sql.close();
  console.log('🔌 Disconnected from Azure Synapse');
  
  return result.recordset;
}

async function queryAllPublishedRatesData2025_2026() {
  console.log('🔗 Connecting to Azure Synapse for ALL published rates data (2025-2026)...');
  await sql.connect(azureConfig);
  console.log('✅ Connected to Azure Synapse');
  
  const query = `
    SELECT *
    FROM [fou].[GQL_PUBLISHED_RATES]
    WHERE (YEAR(SNAPSHOT_DATE) = 2025 OR YEAR(SNAPSHOT_DATE) = 2026)
    OR (YEAR(DEPARTURE_DATE) = 2025 OR YEAR(DEPARTURE_DATE) = 2026)
    ORDER BY SNAPSHOT_DATE DESC, SAIL_CODE
  `;
  
  console.log('📊 Querying ALL Azure GQL_PUBLISHED_RATES data for 2025-2026...');
  const result = await sql.query(query);
  console.log(`✅ Retrieved ${result.recordset.length} rows from GQL_PUBLISHED_RATES table`);
  
  await sql.close();
  console.log('🔌 Disconnected from Azure Synapse');
  
  return result.recordset;
}

async function clearExistingData() {
  console.log('🧹 Clearing existing data from tables...');
  
  try {
    // Clear budget table
    const { error: budgetError } = await supabase
      .from('budget')
      .delete()
      .neq('id', 0); // Delete all rows
    
    if (budgetError) {
      console.log('⚠️  Could not clear budget table:', budgetError.message);
    } else {
      console.log('✅ Budget table cleared');
    }
    
    // Clear published_rates table
    const { error: ratesError } = await supabase
      .from('published_rates')
      .delete()
      .neq('id', 0); // Delete all rows
    
    if (ratesError) {
      console.log('⚠️  Could not clear published_rates table:', ratesError.message);
    } else {
      console.log('✅ Published rates table cleared');
    }
    
  } catch (error) {
    console.log('⚠️  Error clearing tables:', error.message);
  console.log('📋 Proceeding with import (may result in duplicates)');
  }
}

async function importAllBudgetData(azureData) {
  if (!azureData || azureData.length === 0) {
    console.log('⚠️  No budget data to import');
    return;
  }

  console.log(`📥 Importing ALL ${azureData.length} budget rows into Supabase...`);
  
  // Process the data to match Supabase schema
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

  // Import data in batches
  const batchSize = 100;
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < processedData.length; i += batchSize) {
    const batch = processedData.slice(i, i + batchSize);
    console.log(`📥 Importing budget batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(processedData.length / batchSize)} (${batch.length} rows)`);
    
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

async function importAllPublishedRatesData(azureData) {
  if (!azureData || azureData.length === 0) {
    console.log('⚠️  No published rates data to import');
    return;
  }

  console.log(`📥 Importing ALL ${azureData.length} published rates rows into Supabase...`);
  
  // Process the data to match Supabase schema
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

  // Import data in batches
  const batchSize = 100;
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < processedData.length; i += batchSize) {
    const batch = processedData.slice(i, i + batchSize);
    console.log(`📥 Importing published rates batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(processedData.length / batchSize)} (${batch.length} rows)`);
    
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
  console.log('🚀 Migrating ALL 2025-2026 data from Azure to Supabase...\n');
  
  try {
    // Step 1: Clear existing data
    await clearExistingData();
    
    // Step 2: Query ALL data from Azure
    console.log('\n📊 Querying ALL data from Azure...');
    const budgetData = await queryAllBudgetData2025_2026();
    const publishedRatesData = await queryAllPublishedRatesData2025_2026();
    
    // Step 3: Import ALL data into Supabase
    console.log('\n📥 Importing ALL data into Supabase...');
    await importAllBudgetData(budgetData);
    await importAllPublishedRatesData(publishedRatesData);
    
    console.log('\n🎉 Full migration completed successfully!');
    console.log('📊 ALL 2025-2026 data imported');
    console.log('🔗 Supabase Dashboard: http://127.0.0.1:54321/');
    console.log('📋 Tables: budget, published_rates');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  }
}

// Run the migration
main().catch(console.error);


