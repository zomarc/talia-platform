#!/usr/bin/env node

/**
 * Import budget data from CSV to Supabase
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

async function importBudgetData() {
  console.log('📥 Importing budget data from CSV to Supabase...');
  
  const data = [];

  fs.createReadStream('budget_data.csv')
    .pipe(csv())
    .on('data', (row) => {
      data.push({
        passenger_type: row.PASSENGER_TYPE,
        length: row.LENGTH ? parseInt(row.LENGTH) : null,
        itinerary_type: row.ITINERARY_TYPE,
        cabin: row.CABIN,
        market: row.MARKET,
        channel: row.CHANNEL,
        new_market_roll_up: row.NEW_MARKET_ROLL_UP,
        old_old_market_roll_up: row.OLD_OLD_MARKET_ROLL_UP,
        accounting_month: row.ACCOUNTING_MONTH ? new Date(row.ACCOUNTING_MONTH).toISOString().split('T')[0] : null,
        master_voyage: row.MASTER_VOYAGE,
        master_departure_date: row.MASTER_DEPARTURE_DATE,
        passengers: row.PASSENGERS ? parseFloat(row.PASSENGERS) : null,
        passenger_nights: row.PASSENGER_NIGHTS ? parseFloat(row.PASSENGER_NIGHTS) : null,
        currency: row.CURRENCY,
        fx_1: row['FX.1'] ? parseFloat(row['FX.1']) : null,
        pppd: row.PPPD ? parseFloat(row.PPPD) : null,
        pppd_eur: row.PPPD_EUR ? parseFloat(row.PPPD_EUR) : null,
        gross_ticket_revenue_local: row.GROSS_TICKET_REVENUE_LOCAL ? parseFloat(row.GROSS_TICKET_REVENUE_LOCAL) : null,
        gross_ticket_revenue_eur: row.GROSS_TICKET_REVENUE_EUR ? parseFloat(row.GROSS_TICKET_REVENUE_EUR) : null,
        pre_emb_pppd: row['PRE-EMB_PPPD'] ? parseFloat(row['PRE-EMB_PPPD']) : null,
        pre_emb_revenue_eur: row.PRE_EMB_REVENUE_EUR ? parseFloat(row.PRE_EMB_REVENUE_EUR) : null,
        fy: row.FY ? parseFloat(row.FY) : null,
        budget_name: row.BUDGET_NAME,
        version: row.VERSION,
        unique_id: row.UNIQUE_ID,
        actuals_code: row.ACTUALS_CODE,
        effective_from: row.EFFECTIVE_FROM ? new Date(row.EFFECTIVE_FROM).toISOString() : null,
        effective_to: row.EFFECTIVE_TO ? new Date(row.EFFECTIVE_TO).toISOString() : null,
        active_record_flag: row.ACTIVE_RECORD_FLAG ? parseInt(row.ACTIVE_RECORD_FLAG) : null
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
            .from('budget')
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

      console.log(`\n🎉 Budget import completed!`);
      console.log(`✅ Successfully imported: ${successCount} rows`);
      console.log(`❌ Failed: ${errorCount} rows`);
    });
}

importBudgetData();


