#!/usr/bin/env node

/**
 * Create tables properly using direct database connection
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function createBudgetTable() {
  console.log('🏗️  Creating budget table...');
  
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

  try {
    // Use the Supabase client to execute SQL directly
    const { data, error } = await supabase.rpc('exec', { sql: budgetTableSQL });
    
    if (error) {
      console.log('❌ Error creating budget table:', error.message);
      return false;
    } else {
      console.log('✅ Budget table created successfully');
      return true;
    }
  } catch (error) {
    console.log('❌ Error creating budget table:', error.message);
    return false;
  }
}

async function createPublishedRatesTable() {
  console.log('🏗️  Creating published_rates table...');
  
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

  try {
    // Use the Supabase client to execute SQL directly
    const { data, error } = await supabase.rpc('exec', { sql: publishedRatesTableSQL });
    
    if (error) {
      console.log('❌ Error creating published rates table:', error.message);
      return false;
    } else {
      console.log('✅ Published rates table created successfully');
      return true;
    }
  } catch (error) {
    console.log('❌ Error creating published rates table:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Creating tables properly...\n');
  
  try {
    const budgetCreated = await createBudgetTable();
    const publishedRatesCreated = await createPublishedRatesTable();
    
    if (budgetCreated && publishedRatesCreated) {
      console.log('\n✅ Both tables created successfully!');
      console.log('📊 You can now run the data import script');
    } else {
      console.log('\n⚠️  Some tables could not be created');
      console.log('📋 Please check the error messages above');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

main().catch(console.error);


