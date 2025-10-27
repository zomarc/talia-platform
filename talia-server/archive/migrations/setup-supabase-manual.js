#!/usr/bin/env node

/**
 * Manual Supabase Setup
 * Since REST API is not working, we'll use manual approach
 */

import fs from 'fs';

async function createManualSetup() {
  console.log('🔧 Manual Supabase Setup\n');
  
  console.log('❌ REST API is not enabled on your Supabase instance');
  console.log('📋 We need to use the manual approach:\n');
  
  console.log('🎯 Step 1: Create the Table');
  console.log('1. Go to: http://127.0.0.1:54323/');
  console.log('2. Click "SQL Editor" in the left sidebar');
  console.log('3. Copy and paste this SQL:');
  console.log('');
  
  const sqlContent = `-- Create cabin_availability table
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cabin_availability_snapshot_date ON cabin_availability(Snapshot_Date);
CREATE INDEX IF NOT EXISTS idx_cabin_availability_sail_code ON cabin_availability(Sail_Code);
CREATE INDEX IF NOT EXISTS idx_cabin_availability_cabin_category ON cabin_availability(Cabin_Category);`;
  
  console.log(sqlContent);
  console.log('');
  console.log('4. Click "Run" to create the table');
  
  console.log('\n🎯 Step 2: Import Data');
  console.log('Once the table is created, you have several options:');
  console.log('');
  console.log('Option A: Manual CSV Import');
  console.log('1. Go to "Table Editor" in Supabase');
  console.log('2. Select "cabin_availability" table');
  console.log('3. Click "Import" and upload cabin_availability_2025.csv');
  console.log('');
  console.log('Option B: Use the import script (if REST API gets fixed)');
  console.log('Run: node import-data.js');
  console.log('');
  console.log('Option C: Insert data manually');
  console.log('Use the SQL Editor to insert data row by row');
  
  console.log('\n📁 Files available:');
  console.log('- create_cabin_availability_table.sql (SQL to create table)');
  console.log('- cabin_availability_2025.csv (Your data from Azure)');
  console.log('- import-data.js (Import script for when REST API works)');
  
  console.log('\n🔧 To fix the REST API issue:');
  console.log('1. Check your Supabase configuration');
  console.log('2. Restart Supabase with proper API configuration');
  console.log('3. Or use a different Supabase setup method');
  
  // Save the SQL to a file for easy copying
  fs.writeFileSync('manual_setup.sql', sqlContent);
  console.log('\n✅ Created manual_setup.sql for easy copying');
}

createManualSetup().catch(console.error);


