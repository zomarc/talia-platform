#!/usr/bin/env node

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
        snapshot_date: row.Snapshot_Date ? new Date(row.Snapshot_Date).toISOString().split('T')[0] : null,
        sailing_id: row.Sail_Code ? parseInt(row.Sail_Code.replace(/\D/g, '')) : null,
        package_name: row.Package_Name,
        sail_days: row.Sail_Days ? parseInt(row.Sail_Days) : null,
        cabin_category: row.Cabin_Category,
        available_cabins: row.Available_Cabins ? parseInt(row.Available_Cabins) : null,
        total_cabins: row.Total_Cabins ? parseInt(row.Total_Cabins) : null,
        available_absolute: row.Available_Absolute ? parseInt(row.Available_Absolute) : null,
        available_weighted: row.Available_Weighted ? parseFloat(row.Available_Weighted) : null,
        availability_result: row.Availability_Result,
        nested_cabins: row.Nested_Cabins ? parseInt(row.Nested_Cabins) : null
      });
    })
    .on('end', async () => {
      console.log(`Importing ${data.length} rows...`);
      
      const batchSize = 100;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const { error } = await supabase
          .from('cabin_availability')
          .insert(batch);
        
        if (error) {
          console.error('Error:', error);
        } else {
          console.log(`Imported batch ${Math.floor(i / batchSize) + 1}`);
        }
      }
      
      console.log('Import completed!');
    });
}

importData().catch(console.error);
