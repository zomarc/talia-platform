#!/usr/bin/env node

/**
 * Diagnose Supabase Local Instance
 */

import dotenv from 'dotenv';

dotenv.config();

async function diagnoseSupabase() {
  console.log('🔍 Diagnosing Supabase Local Instance\n');
  
  // Check if Supabase is running
  console.log('1. Checking if Supabase is running...');
  try {
    const response = await fetch('http://127.0.0.1:54323/');
    if (response.ok) {
      console.log('✅ Supabase is running');
    } else {
      console.log('❌ Supabase is not responding');
      return;
    }
  } catch (error) {
    console.log('❌ Cannot connect to Supabase:', error.message);
    return;
  }
  
  // Check different endpoints
  console.log('\n2. Testing different endpoints...');
  
  const endpoints = [
    '/rest/v1/',
    '/rest/v1',
    '/api/rest/v1/',
    '/api/rest/v1',
    '/rest/v1/tables',
    '/rest/v1/information_schema.tables'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`http://127.0.0.1:54323${endpoint}`, {
        headers: {
          'apikey': process.env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
        }
      });
      
      console.log(`${endpoint}: ${response.status} ${response.statusText}`);
      
      if (response.status === 200) {
        console.log(`✅ ${endpoint} is accessible!`);
        const data = await response.text();
        console.log(`Response: ${data.substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`${endpoint}: Error - ${error.message}`);
    }
  }
  
  // Check if we can access the database directly
  console.log('\n3. Testing database access...');
  
  try {
    const response = await fetch('http://127.0.0.1:54323/rest/v1/information_schema.tables', {
      headers: {
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Database is accessible!');
      console.log('Tables:', data.map(t => t.table_name).join(', '));
    } else {
      console.log(`Database access failed: ${response.status}`);
    }
  } catch (error) {
    console.log('❌ Database access failed:', error.message);
  }
  
  // Check if we can create a table
  console.log('\n4. Testing table creation...');
  
  try {
    const response = await fetch('http://127.0.0.1:54323/rest/v1/rpc/exec_sql', {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sql: 'SELECT 1 as test'
      })
    });
    
    if (response.ok) {
      console.log('✅ RPC exec_sql is accessible!');
      const data = await response.json();
      console.log('Response:', data);
    } else {
      console.log(`❌ RPC exec_sql failed: ${response.status}`);
      const errorText = await response.text();
      console.log('Error:', errorText.substring(0, 200));
    }
  } catch (error) {
    console.log('❌ RPC exec_sql failed:', error.message);
  }
  
  console.log('\n🎯 Recommendations:');
  console.log('1. Check if your Supabase instance has the REST API enabled');
  console.log('2. Verify the API keys are correct for your local instance');
  console.log('3. Try restarting your Supabase instance');
  console.log('4. Check the Supabase logs for any errors');
}

diagnoseSupabase().catch(console.error);


