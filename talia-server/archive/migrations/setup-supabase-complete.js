#!/usr/bin/env node

/**
 * Complete Supabase Setup Script
 * This script will help you set up Supabase properly
 */

import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

async function checkSupabaseStatus() {
  console.log('🔍 Checking Supabase status...\n');
  
  // Check if Supabase is running
  try {
    const response = await fetch('http://127.0.0.1:54323/');
    if (response.ok) {
      console.log('✅ Supabase is running at http://127.0.0.1:54323/');
    } else {
      console.log('❌ Supabase is not responding properly');
      return false;
    }
  } catch (error) {
    console.log('❌ Supabase is not running');
    console.log('Please start Supabase first');
    return false;
  }
  
  return true;
}

async function createTableSQL() {
  console.log('📝 Creating SQL script for table creation...\n');
  
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

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_cabin_availability_snapshot_date ON cabin_availability(Snapshot_Date);
CREATE INDEX IF NOT EXISTS idx_cabin_availability_sail_code ON cabin_availability(Sail_Code);
CREATE INDEX IF NOT EXISTS idx_cabin_availability_cabin_category ON cabin_availability(Cabin_Category);
`;

  // Save SQL to file
  fs.writeFileSync('create_cabin_availability_table.sql', sqlContent);
  console.log('✅ Created create_cabin_availability_table.sql');
  
  return sqlContent;
}

async function createImportScript() {
  console.log('📝 Creating import script...\n');
  
  const importScript = `#!/usr/bin/env node

/**
 * Import CSV data to Supabase
 * Run this after creating the table
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import csv from 'csv-parser';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function importData() {
  const data = [];
  
  fs.createReadStream('cabin_availability_2025.csv')
    .pipe(csv())
    .on('data', (row) => {
      data.push({
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
      });
    })
    .on('end', async () => {
      console.log(\`Importing \${data.length} rows...\`);
      
      const batchSize = 100;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const { error } = await supabase
          .from('cabin_availability')
          .insert(batch);
        
        if (error) {
          console.error('Error:', error);
        } else {
          console.log(\`Imported batch \${Math.floor(i / batchSize) + 1}\`);
        }
      }
      
      console.log('Import completed!');
    });
}

importData().catch(console.error);
`;

  fs.writeFileSync('import-data.js', importScript);
  console.log('✅ Created import-data.js');
}

async function main() {
  console.log('🚀 Complete Supabase Setup\n');
  
  // Check Supabase status
  const isRunning = await checkSupabaseStatus();
  if (!isRunning) {
    return;
  }
  
  // Create SQL script
  await createTableSQL();
  
  // Create import script
  await createImportScript();
  
  console.log('\n🎯 Next Steps:');
  console.log('1. Go to http://127.0.0.1:54323/');
  console.log('2. Click "SQL Editor" in the left sidebar');
  console.log('3. Copy and paste the contents of create_cabin_availability_table.sql');
  console.log('4. Click "Run" to create the table');
  console.log('5. Run: node import-data.js');
  
  console.log('\n📁 Files created:');
  console.log('- create_cabin_availability_table.sql (SQL to create table)');
  console.log('- import-data.js (Script to import CSV data)');
  console.log('- cabin_availability_2025.csv (Your data from Azure)');
}

main().catch(console.error);


