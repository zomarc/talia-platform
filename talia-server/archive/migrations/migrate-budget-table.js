#!/usr/bin/env node

/**
 * Migrate BUDGET table from Azure Synapse to Supabase
 */

import dotenv from 'dotenv';
import sql from 'mssql';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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

async function queryBudgetTable() {
  console.log('🔗 Connecting to Azure Synapse...');
  await sql.connect(azureConfig);
  console.log('✅ Connected to Azure Synapse');
  
  // Query the BUDGET table
  const query = `
    SELECT TOP 1000 *
    FROM [lkp].[BUDGET]
    WHERE ACTIVE_RECORD_FLAG = 1
    ORDER BY FY DESC, ACCOUNTING_MONTH DESC
  `;
  
  console.log('📊 Querying Azure table: [lkp].[BUDGET]');
  console.log('🔍 SQL:', query);
  
  const result = await sql.query(query);
  console.log(`✅ Retrieved ${result.recordset.length} rows from BUDGET table`);
  
  await sql.close();
  console.log('🔌 Disconnected from Azure Synapse');
  
  return result.recordset;
}

async function createBudgetTable() {
  console.log('🏗️  Creating budget table in Supabase...');
  
  const createTableSQL = `
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
  
  console.log('📋 Please create the budget table manually in Supabase SQL Editor:');
  console.log(createTableSQL);
  return true;
}

async function saveToCSV(data, filename) {
  console.log(`📁 Saving data to ${filename}...`);
  
  if (!data || data.length === 0) {
    console.log('⚠️  No data to save');
    return;
  }
  
  // Get headers from first row
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvRows = [];
  
  // Add header row
  csvRows.push(headers.join(','));
  
  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Escape commas and quotes in values
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  }
  
  const csvContent = csvRows.join('\n');
  fs.writeFileSync(filename, csvContent);
  
  console.log(`✅ Saved ${data.length} rows to ${filename}`);
  console.log(`📊 File size: ${(csvContent.length / 1024).toFixed(2)} KB`);
}

async function importToSupabase(data) {
  if (!data || data.length === 0) {
    console.log('⚠️  No data to import');
    return;
  }

  console.log(`📥 Importing ${data.length} rows into Supabase budget table...`);
  
  // Process the data to match Supabase schema
  const processedData = data.map(row => {
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

  // Insert data in batches
  const batchSize = 100;
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < processedData.length; i += batchSize) {
    const batch = processedData.slice(i, i + batchSize);
    console.log(`📥 Importing batch ${Math.floor(i / batchSize) + 1} (${batch.length} rows)`);
    
    const { error } = await supabase
      .from('budget')
      .insert(batch);
    
    if (error) {
      console.error(`❌ Error in batch ${Math.floor(i / batchSize) + 1}:`, error.message);
      errorCount += batch.length;
    } else {
      console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} imported successfully`);
      successCount += batch.length;
    }
  }
  
  console.log(`\n🎉 Import completed!`);
  console.log(`✅ Successfully imported: ${successCount} rows`);
  console.log(`❌ Failed: ${errorCount} rows`);
}

async function main() {
  console.log('🚀 Starting BUDGET table migration...\n');
  
  try {
    // Step 1: Query data from Azure
    const azureData = await queryBudgetTable();
    
    if (!azureData || azureData.length === 0) {
      console.log('⚠️  No data found in BUDGET table');
      return;
    }

    console.log(`📊 Found ${azureData.length} records in BUDGET table`);
    
    // Step 2: Save to CSV
    await saveToCSV(azureData, 'budget_data.csv');
    
    // Step 3: Create table in Supabase
    await createBudgetTable();
    
    console.log('\n⚠️  Please create the budget table manually in Supabase SQL Editor first');
    console.log('Then run this script again to import the data');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  }
}

// Run the migration
main().catch(console.error);