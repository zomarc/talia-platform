#!/usr/bin/env node

/**
 * Complete setup for both BUDGET and GQL_PUBLISHED_RATES tables
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

async function createTables() {
  console.log('🏗️  Creating tables in Supabase...');
  
  // Create budget table
  const budgetTableSQL = `
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

  // Create published_rates table
  const publishedRatesTableSQL = `
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

  console.log('📋 Please run these SQL commands in your Supabase SQL Editor:');
  console.log('\n1. Budget table:');
  console.log(budgetTableSQL);
  console.log('\n2. Published rates table:');
  console.log(publishedRatesTableSQL);
  
  return true;
}

async function importBudgetData() {
  console.log('📥 Importing budget data...');
  
  if (!fs.existsSync('budget_data.csv')) {
    console.log('❌ budget_data.csv not found. Please run the migration script first.');
    return false;
  }

  const data = [];

  return new Promise((resolve) => {
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
        console.log(`📊 Processing ${data.length} budget rows...`);

        const batchSize = 100;
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < data.length; i += batchSize) {
          const batch = data.slice(i, i + batchSize);
          console.log(`📥 Importing budget batch ${Math.floor(i / batchSize) + 1} (${batch.length} rows)`);
          
          try {
            const { error } = await supabase
              .from('budget')
              .insert(batch);

            if (error) {
              console.error(`❌ Error in budget batch ${Math.floor(i / batchSize) + 1}:`, error.message);
              errorCount += batch.length;
            } else {
              console.log(`✅ Budget batch ${Math.floor(i / batchSize) + 1} imported successfully`);
              successCount += batch.length;
            }
          } catch (error) {
            console.error(`❌ Error in budget batch ${Math.floor(i / batchSize) + 1}:`, error.message);
            errorCount += batch.length;
          }
        }

        console.log(`\n🎉 Budget import completed!`);
        console.log(`✅ Successfully imported: ${successCount} rows`);
        console.log(`❌ Failed: ${errorCount} rows`);
        resolve(true);
      });
  });
}

async function importPublishedRatesData() {
  console.log('📥 Importing published rates data...');
  
  if (!fs.existsSync('published_rates_data.csv')) {
    console.log('❌ published_rates_data.csv not found. Please run the migration script first.');
    return false;
  }

  const data = [];

  return new Promise((resolve) => {
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
        console.log(`📊 Processing ${data.length} published rates rows...`);

        const batchSize = 100;
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < data.length; i += batchSize) {
          const batch = data.slice(i, i + batchSize);
          console.log(`📥 Importing published rates batch ${Math.floor(i / batchSize) + 1} (${batch.length} rows)`);
          
          try {
            const { error } = await supabase
              .from('published_rates')
              .insert(batch);

            if (error) {
              console.error(`❌ Error in published rates batch ${Math.floor(i / batchSize) + 1}:`, error.message);
              errorCount += batch.length;
            } else {
              console.log(`✅ Published rates batch ${Math.floor(i / batchSize) + 1} imported successfully`);
              successCount += batch.length;
            }
          } catch (error) {
            console.error(`❌ Error in published rates batch ${Math.floor(i / batchSize) + 1}:`, error.message);
            errorCount += batch.length;
          }
        }

        console.log(`\n🎉 Published rates import completed!`);
        console.log(`✅ Successfully imported: ${successCount} rows`);
        console.log(`❌ Failed: ${errorCount} rows`);
        resolve(true);
      });
  });
}

async function main() {
  console.log('🚀 Setting up both BUDGET and GQL_PUBLISHED_RATES tables...\n');
  
  try {
    // Step 1: Show table creation SQL
    await createTables();
    
    console.log('\n⚠️  Please create both tables in Supabase SQL Editor first');
    console.log('Then run this script again to import the data');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
  }
}

// Run the setup
main().catch(console.error);


