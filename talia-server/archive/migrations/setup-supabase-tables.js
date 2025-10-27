#!/usr/bin/env node

/**
 * Setup Supabase tables for data migration
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

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
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS cabin_availability (
      id SERIAL PRIMARY KEY,
      Snapshot_Date DATE,
      Sailing_Id INTEGER,
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
    const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    if (error) {
      console.log('⚠️  Could not create table via RPC:', error.message);
      console.log('📋 Please create the table manually in Supabase dashboard:');
      console.log(createTableSQL);
    } else {
      console.log('✅ Created cabin_availability table');
    }
  } catch (error) {
    console.log('⚠️  Could not create table:', error.message);
    console.log('📋 Please create the table manually in Supabase dashboard:');
    console.log(createTableSQL);
  }
}

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connection...');
  
  try {
    const { data, error } = await supabase
      .from('cabin_availability')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ Supabase connection failed:', error.message);
      return false;
    } else {
      console.log('✅ Supabase connection successful');
      return true;
    }
  } catch (error) {
    console.log('❌ Supabase connection failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Setting up Supabase tables...\n');
  
  // Test connection first
  const connected = await testSupabaseConnection();
  
  if (!connected) {
    console.log('\n❌ Cannot connect to Supabase. Please check:');
    console.log('1. Supabase is running at http://127.0.0.1:54323/');
    console.log('2. Your .env file has correct SUPABASE_SERVICE_ROLE_KEY');
    console.log('3. The service role key is valid');
    return;
  }
  
  // Create tables
  await createCabinAvailabilityTable();
  
  console.log('\n🎉 Table setup completed!');
  console.log('📊 You can now run the migration script');
  console.log('🔗 Supabase Dashboard: http://127.0.0.1:54323/');
}

// Run setup
main().catch(console.error);


