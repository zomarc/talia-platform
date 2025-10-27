#!/usr/bin/env node

/**
 * Import published rates data from CSV to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import csv from 'csv-parser';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function importPublishedRatesData() {
  console.log('📥 Importing published rates data from CSV to Supabase...');
  
  const data = [];

  fs.createReadStream('published_rates_data.csv')
    .pipe(csv())
    .on('data', (row) => {
      data.push({
        snapshot_date: row.SNAPSHOT_DATE ? new Date(row.SNAPSHOT_DATE).toISOString().split('T')[0] : null,
        sail_code: row.SAIL_CODE,
        ship_code: row.SHIP_CODE,
        package_name: row.PACKAGE_NAME,
        region: row.REGION,
        rate_type: row.RATE_TYPE,
        sail_days: row.SAIL_DAYS ? parseFloat(row.SAIL_DAYS) : null,
        departure_date: row.DEPARTURE_DATE ? new Date(row.DEPARTURE_DATE).toISOString().split('T')[0] : null,
        cabin_category: row.CABIN_CATEGORY,
        promo_name: row.PROMO_NAME,
        promo_type: row.PROMO_TYPE,
        currency_code: row.CURRENCY_CODE,
        fare_per_person: row.FARE_PER_PERSON ? parseFloat(row.FARE_PER_PERSON) : null,
        port_taxes_services: row.PORT_TAXES_SERVICES ? parseFloat(row.PORT_TAXES_SERVICES) : null,
        extra_adult: row.EXTRA_ADULT ? parseFloat(row.EXTRA_ADULT) : null,
        extra_child: row.EXTRA_CHILD ? parseFloat(row.EXTRA_CHILD) : null,
        discount: row.DISCOUNT ? parseFloat(row.DISCOUNT) : null
      });
    })
    .on('end', async () => {
      console.log(`📊 Processing ${data.length} rows...`);

      const batchSize = 100;
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        console.log(`📥 Importing batch ${Math.floor(i / batchSize) + 1} (${batch.length} rows)`);
        
        try {
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
        } catch (error) {
          console.error(`❌ Error in batch ${Math.floor(i / batchSize) + 1}:`, error.message);
          errorCount += batch.length;
        }
      }

      console.log(`\n🎉 Published rates import completed!`);
      console.log(`✅ Successfully imported: ${successCount} rows`);
      console.log(`❌ Failed: ${errorCount} rows`);
    });
}

importPublishedRatesData();


