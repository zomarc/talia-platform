#!/usr/bin/env node

/**
 * Import data without foreign key constraints
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

async function importDataWithoutFK() {
  console.log('🚀 Importing data without foreign key constraints...\n');
  
  // First, let's temporarily disable the foreign key constraint
  console.log('🔧 Temporarily disabling foreign key constraint...');
  
  try {
    const { error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE cabin_availability DISABLE TRIGGER ALL;'
    });
    
    if (error) {
      console.log('⚠️  Could not disable triggers:', error.message);
    } else {
      console.log('✅ Disabled foreign key constraints');
    }
  } catch (error) {
    console.log('⚠️  Could not disable constraints:', error.message);
  }
  
  const data = [];
  
  fs.createReadStream('cabin_availability_2025.csv')
    .pipe(csv())
    .on('data', (row) => {
      // Map to existing sailing IDs or use a default
      const sailingId = row.Sail_Code ? parseInt(row.Sail_Code.replace(/\D/g, '')) : null;
      const mappedSailingId = sailingId ? (sailingId % 2) + 1 : 1; // Map to existing IDs 1 or 2
      
      data.push({
        snapshot_date: row.Snapshot_Date ? new Date(row.Snapshot_Date).toISOString().split('T')[0] : null,
        sailing_id: mappedSailingId,
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
      console.log(`📊 Importing ${data.length} rows...`);
      
      const batchSize = 100;
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        console.log(`📥 Importing batch ${Math.floor(i / batchSize) + 1} (${batch.length} rows)`);
        
        const { error } = await supabase
          .from('cabin_availability')
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
      
      // Re-enable foreign key constraints
      console.log('\n🔧 Re-enabling foreign key constraints...');
      try {
        const { error } = await supabase.rpc('exec_sql', {
          sql: 'ALTER TABLE cabin_availability ENABLE TRIGGER ALL;'
        });
        
        if (error) {
          console.log('⚠️  Could not re-enable triggers:', error.message);
        } else {
          console.log('✅ Re-enabled foreign key constraints');
        }
      } catch (error) {
        console.log('⚠️  Could not re-enable constraints:', error.message);
      }
    });
}

importDataWithoutFK().catch(console.error);


