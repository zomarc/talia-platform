#!/usr/bin/env node

/**
 * Supabase Administration Script
 * Create tables and manage local Supabase instance
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

async function testConnection() {
  console.log('🔍 Testing Supabase connection...');
  
  try {
    // Try to access the database directly
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .limit(1);
    
    if (error) {
      console.log('❌ Connection failed:', error.message);
      return false;
    } else {
      console.log('✅ Connection successful');
      return true;
    }
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
    return false;
  }
}

async function createCabinAvailabilityTable() {
  console.log('🏗️  Creating cabin_availability table...');
  
  try {
    // Method 1: Try using RPC to execute SQL
    const { data: rpcData, error: rpcError } = await supabase.rpc('exec_sql', {
      sql: `
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
      `
    });
    
    if (rpcError) {
      console.log('⚠️  RPC method failed:', rpcError.message);
      
      // Method 2: Try direct SQL execution via REST API
      const { data: sqlData, error: sqlError } = await supabase
        .from('pg_tables')
        .select('tablename')
        .eq('tablename', 'cabin_availability');
      
      if (sqlError) {
        console.log('⚠️  Direct SQL method failed:', sqlError.message);
        
        // Method 3: Try using the SQL editor endpoint
        const response = await fetch(`${supabaseConfig.url}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'apikey': supabaseConfig.serviceRoleKey,
            'Authorization': `Bearer ${supabaseConfig.serviceRoleKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sql: `
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
            `
          })
        });
        
        if (response.ok) {
          console.log('✅ Table created via REST API');
          return true;
        } else {
          console.log('❌ REST API method failed:', response.status, response.statusText);
          return false;
        }
      } else {
        console.log('✅ Table already exists or created successfully');
        return true;
      }
    } else {
      console.log('✅ Table created via RPC');
      return true;
    }
  } catch (error) {
    console.log('❌ All methods failed:', error.message);
    return false;
  }
}

async function listTables() {
  console.log('📋 Listing existing tables...');
  
  try {
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (error) {
      console.log('❌ Could not list tables:', error.message);
    } else {
      console.log('📊 Existing tables:');
      data.forEach(table => {
        console.log(`  - ${table.table_name}`);
      });
    }
  } catch (error) {
    console.log('❌ Error listing tables:', error.message);
  }
}

async function checkTableExists() {
  console.log('🔍 Checking if cabin_availability table exists...');
  
  try {
    const { data, error } = await supabase
      .from('cabin_availability')
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.message.includes('relation "cabin_availability" does not exist')) {
        console.log('❌ Table does not exist');
        return false;
      } else {
        console.log('⚠️  Table exists but error:', error.message);
        return true;
      }
    } else {
      console.log('✅ Table exists');
      return true;
    }
  } catch (error) {
    console.log('❌ Error checking table:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Supabase Administration Script\n');
  
  // Test connection
  const connected = await testConnection();
  if (!connected) {
    console.log('\n❌ Cannot connect to Supabase. Please check:');
    console.log('1. Supabase is running at http://127.0.0.1:54323/');
    console.log('2. Your .env file has correct SUPABASE_SERVICE_ROLE_KEY');
    return;
  }
  
  // List existing tables
  await listTables();
  
  // Check if table exists
  const tableExists = await checkTableExists();
  
  if (!tableExists) {
    // Create table
    const tableCreated = await createCabinAvailabilityTable();
    
    if (tableCreated) {
      console.log('\n✅ Table creation completed!');
      console.log('📊 You can now import data using:');
      console.log('node scripts/import-csv-simple.js');
    } else {
      console.log('\n❌ Could not create table automatically');
      console.log('📋 Please create the table manually in Supabase dashboard');
    }
  } else {
    console.log('\n✅ Table already exists!');
    console.log('📊 You can now import data using:');
    console.log('node scripts/import-csv-simple.js');
  }
}

// Run administration
main().catch(console.error);


