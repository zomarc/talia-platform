#!/usr/bin/env node

/**
 * Migrate GQL_PUBLISHED_RATES table from Azure Synapse to Supabase
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

async function queryPublishedRatesTable() {
  console.log('🔗 Connecting to Azure Synapse...');
  await sql.connect(azureConfig);
  console.log('✅ Connected to Azure Synapse');
  
  // Query the GQL_PUBLISHED_RATES table
  const query = `
    SELECT TOP 1000 *
    FROM [fou].[GQL_PUBLISHED_RATES]
    WHERE SNAPSHOT_DATE >= '2025-01-01'
    ORDER BY SNAPSHOT_DATE DESC, SAIL_CODE
  `;
  
  console.log('📊 Querying Azure table: [fou].[GQL_PUBLISHED_RATES]');
  console.log('🔍 SQL:', query);
  
  const result = await sql.query(query);
  console.log(`✅ Retrieved ${result.recordset.length} rows from GQL_PUBLISHED_RATES table`);
  
  await sql.close();
  console.log('🔌 Disconnected from Azure Synapse');
  
  return result.recordset;
}

async function createPublishedRatesTable() {
  console.log('🏗️  Creating published_rates table in Supabase...');
  
  const createTableSQL = `
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
  
  console.log('📋 Please create the published_rates table manually in Supabase SQL Editor:');
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

  console.log(`📥 Importing ${data.length} rows into Supabase published_rates table...`);
  
  // Process the data to match Supabase schema
  const processedData = data.map(row => {
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

  // Insert data in batches
  const batchSize = 100;
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < processedData.length; i += batchSize) {
    const batch = processedData.slice(i, i + batchSize);
    console.log(`📥 Importing batch ${Math.floor(i / batchSize) + 1} (${batch.length} rows)`);
    
    const { error } = await supabase
      .from('published_rates')
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
  console.log('🚀 Starting GQL_PUBLISHED_RATES table migration...\n');
  
  try {
    // Step 1: Query data from Azure
    const azureData = await queryPublishedRatesTable();
    
    if (!azureData || azureData.length === 0) {
      console.log('⚠️  No data found in GQL_PUBLISHED_RATES table');
      return;
    }

    console.log(`📊 Found ${azureData.length} records in GQL_PUBLISHED_RATES table`);
    
    // Step 2: Save to CSV
    await saveToCSV(azureData, 'published_rates_data.csv');
    
    // Step 3: Create table in Supabase
    await createPublishedRatesTable();
    
    console.log('\n⚠️  Please create the published_rates table manually in Supabase SQL Editor first');
    console.log('Then run this script again to import the data');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  }
}

// Run the migration
main().catch(console.error);


