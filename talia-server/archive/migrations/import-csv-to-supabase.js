#!/usr/bin/env node

/**
 * Import CSV data into Supabase
 * 
 * This script reads a CSV file and imports it into Supabase
 * Use this when you export data from Azure Synapse as CSV
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import csv from 'csv-parser';

// Load environment variables
dotenv.config();

// Supabase configuration
const supabaseConfig = {
  url: process.env.SUPABASE_URL || 'http://127.0.0.1:54323',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key-here'
};

// Initialize Supabase client
const supabase = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey);

async function clearSupabaseTable(tableName) {
  try {
    console.log(`🗑️  Clearing Supabase table: ${tableName}`);
    const { error } = await supabase
      .from(tableName)
      .delete()
      .neq('id', 0); // Delete all rows
    
    if (error) {
      console.log(`⚠️  Could not clear table ${tableName} (might not exist yet):`, error.message);
    } else {
      console.log(`✅ Cleared table ${tableName}`);
    }
  } catch (error) {
    console.log(`⚠️  Could not clear table ${tableName}:`, error.message);
  }
}

async function importCSVToSupabase(csvFilePath, tableName) {
  return new Promise((resolve, reject) => {
    const data = [];
    
    console.log(`📊 Reading CSV file: ${csvFilePath}`);
    
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row) => {
        // Process the row data
        const processedRow = {};
        for (const [key, value] of Object.entries(row)) {
          // Convert column names to match Supabase schema
          const supabaseKey = convertColumnName(key);
          processedRow[supabaseKey] = value;
        }
        data.push(processedRow);
      })
      .on('end', async () => {
        console.log(`📊 Read ${data.length} rows from CSV`);
        
        if (data.length === 0) {
          console.log('⚠️  No data found in CSV file');
          resolve();
          return;
        }

        try {
          // Clear the table first
          await clearSupabaseTable(tableName);
          
          // Insert data in batches
          const batchSize = 100;
          for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            console.log(`📥 Inserting batch ${Math.floor(i / batchSize) + 1} (${batch.length} rows)`);
            
            const { error } = await supabase
              .from(tableName)
              .insert(batch);

            if (error) {
              console.error(`❌ Error inserting batch:`, error);
              throw error;
            }
          }
          
          console.log(`✅ Successfully imported ${data.length} rows into ${tableName}`);
          resolve();
        } catch (error) {
          console.error(`❌ Failed to import data:`, error);
          reject(error);
        }
      })
      .on('error', (error) => {
        console.error(`❌ Error reading CSV file:`, error);
        reject(error);
      });
  });
}

function convertColumnName(azureColumnName) {
  // Convert Azure column names to Supabase format
  const columnMappings = {
    'Snapshot_Date': 'Snapshot_Date',
    'Sailing_Id': 'Sailing_Id',
    'Package_Name': 'Package_Name',
    'Sail_Days': 'Sail_Days',
    'Cabin_Category': 'Cabin_Category',
    'Available_Cabins': 'Available_Cabins',
    'Total_Cabins': 'Total_Cabins',
    'Available_Absolute': 'Available_Absolute',
    'Available_Weighted': 'Available_Weighted',
    'Availability_Result': 'Availability_Result',
    'Nested_Cabins': 'Nested_Cabins'
  };

  return columnMappings[azureColumnName] || azureColumnName;
}

async function main() {
  const csvFilePath = process.argv[2];
  const tableName = process.argv[3] || 'cabin_availability';
  
  if (!csvFilePath) {
    console.log('❌ Please provide a CSV file path');
    console.log('Usage: node import-csv-to-supabase.js <csv-file-path> [table-name]');
    console.log('Example: node import-csv-to-supabase.js cabin_availability_2025.csv cabin_availability');
    process.exit(1);
  }
  
  if (!fs.existsSync(csvFilePath)) {
    console.log(`❌ CSV file not found: ${csvFilePath}`);
    process.exit(1);
  }
  
  console.log('🚀 Starting CSV import to Supabase...\n');
  
  try {
    await importCSVToSupabase(csvFilePath, tableName);
    console.log('\n🎉 CSV import completed successfully!');
    console.log('📊 You can now query your local Supabase database');
    console.log('🔗 Supabase Dashboard: http://127.0.0.1:54323/');
  } catch (error) {
    console.error('\n❌ Import failed:', error);
  }
}

// Run the import
main().catch(console.error);


