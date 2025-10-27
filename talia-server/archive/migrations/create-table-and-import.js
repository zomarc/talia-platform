#!/usr/bin/env node

/**
 * Create cabin_availability table and import data from CSV
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

async function createCabinAvailabilityTable() {
  console.log('🏗️  Creating cabin_availability table...');
  
  // SQL to create the table
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS cabin_availability (
      id SERIAL PRIMARY KEY,
      Snapshot_Date DATE,
      Sail_Code TEXT,
      Package_Name TEXT,
      Sail_Days INTEGER,
      Cabin_Category TEXT,
      Available_Cabins INTEGER,
      Total_Cabins INTEGER,
      Available_Absolute INTEGER,
      Available_Weighted DECIMAL(10,2),
      Availability_Result TEXT,
      Nested_Cabins INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
  
  try {
    // Try to create table using RPC (if available)
    const { error: rpcError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    
    if (rpcError) {
      console.log('⚠️  RPC method not available, trying direct SQL...');
      
      // Try direct SQL execution
      const { error: sqlError } = await supabase
        .from('information_schema.tables')
        .select('*')
        .eq('table_name', 'cabin_availability');
      
      if (sqlError) {
        console.log('❌ Cannot create table via API');
        console.log('📋 Please create the table manually in Supabase dashboard:');
        console.log(createTableSQL);
        return false;
      }
    }
    
    console.log('✅ Table creation attempted');
    return true;
  } catch (error) {
    console.log('⚠️  Could not create table via API:', error.message);
    console.log('📋 Please create the table manually in Supabase dashboard:');
    console.log(createTableSQL);
    return false;
  }
}

async function importCSVData(csvFilePath) {
  return new Promise((resolve, reject) => {
    const data = [];
    
    console.log(`📊 Reading CSV file: ${csvFilePath}`);
    
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row) => {
        // Process the row data
        const processedRow = {
          Snapshot_Date: row.Snapshot_Date ? new Date(row.Snapshot_Date).toISOString().split('T')[0] : null,
          Sail_Code: row.Sail_Code,
          Package_Name: row.Package_Name,
          Sail_Days: row.Sail_Days ? parseInt(row.Sail_Days) : null,
          Cabin_Category: row.Cabin_Category,
          Available_Cabins: row.Available_Cabins ? parseInt(row.Available_Cabins) : null,
          Total_Cabins: row.Total_Cabins ? parseInt(row.Total_Cabins) : null,
          Available_Absolute: row.Available_Absolute ? parseInt(row.Available_Absolute) : null,
          Available_Weighted: row.Available_Weighted ? parseFloat(row.Available_Weighted) : null,
          Availability_Result: row.Availability_Result,
          Nested_Cabins: row.Nested_Cabins ? parseInt(row.Nested_Cabins) : null
        };
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
          // Insert data in batches
          const batchSize = 100;
          for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            console.log(`📥 Inserting batch ${Math.floor(i / batchSize) + 1} (${batch.length} rows)`);
            
            const { error } = await supabase
              .from('cabin_availability')
              .insert(batch);

            if (error) {
              console.error(`❌ Error inserting batch:`, error);
              throw error;
            }
          }
          
          console.log(`✅ Successfully imported ${data.length} rows into cabin_availability`);
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

async function main() {
  console.log('🚀 Creating table and importing data...\n');
  
  const csvFilePath = 'cabin_availability_2025.csv';
  
  if (!fs.existsSync(csvFilePath)) {
    console.log(`❌ CSV file not found: ${csvFilePath}`);
    console.log('Please run the Azure export script first:');
    console.log('node scripts/save-azure-data-to-csv.js');
    return;
  }
  
  try {
    // Step 1: Create table
    const tableCreated = await createCabinAvailabilityTable();
    
    if (!tableCreated) {
      console.log('\n⚠️  Please create the table manually in Supabase dashboard first');
      console.log('Then run this script again to import the data');
      return;
    }
    
    // Step 2: Import data
    await importCSVData(csvFilePath);
    
    console.log('\n🎉 Table creation and data import completed successfully!');
    console.log('📊 You can now query your local Supabase database');
    console.log('🔗 Supabase Dashboard: http://127.0.0.1:54323/');
    console.log('📋 Table: cabin_availability');
    
  } catch (error) {
    console.error('\n❌ Process failed:', error);
  }
}

// Run the process
main().catch(console.error);


