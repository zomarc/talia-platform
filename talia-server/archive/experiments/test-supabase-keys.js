#!/usr/bin/env node

/**
 * Test Supabase API keys
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

async function testSupabaseKeys() {
  console.log('🔍 Testing Supabase API keys...');
  
  // Test with anon key
  console.log('\n1. Testing with ANON key...');
  const supabaseAnon = createClient(
    process.env.SUPABASE_URL || 'http://127.0.0.1:54323',
    process.env.SUPABASE_ANON_KEY || 'your-anon-key-here'
  );
  
  try {
    const { data, error } = await supabaseAnon
      .from('cabin_availability')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ ANON key failed:', error.message);
    } else {
      console.log('✅ ANON key works!');
      console.log('Data:', data);
    }
  } catch (error) {
    console.log('❌ ANON key failed:', error.message);
  }
  
  // Test with service role key
  console.log('\n2. Testing with SERVICE_ROLE key...');
  const supabaseService = createClient(
    process.env.SUPABASE_URL || 'http://127.0.0.1:54323',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key-here'
  );
  
  try {
    const { data, error } = await supabaseService
      .from('cabin_availability')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ SERVICE_ROLE key failed:', error.message);
    } else {
      console.log('✅ SERVICE_ROLE key works!');
      console.log('Data:', data);
    }
  } catch (error) {
    console.log('❌ SERVICE_ROLE key failed:', error.message);
  }
  
  // Test basic connection
  console.log('\n3. Testing basic connection...');
  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      console.log('✅ REST API is accessible');
    } else {
      console.log('❌ REST API not accessible');
      const text = await response.text();
      console.log('Response:', text.substring(0, 200));
    }
  } catch (error) {
    console.log('❌ REST API test failed:', error.message);
  }
}

// Run test
testSupabaseKeys().catch(console.error);


