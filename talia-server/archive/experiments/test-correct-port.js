#!/usr/bin/env node

/**
 * Test Supabase on the correct port (54321)
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

async function testCorrectPort() {
  console.log('🔍 Testing Supabase on correct port (54321)...\n');
  
  // Default local Supabase keys
  const supabaseConfig = {
    url: 'http://127.0.0.1:54321',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
    serviceRoleKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
  };
  
  console.log('Testing with anon key...');
  const supabaseAnon = createClient(supabaseConfig.url, supabaseConfig.anonKey);
  
  try {
    const { data, error } = await supabaseAnon
      .from('cabin_availability')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ Anon key failed:', error.message);
    } else {
      console.log('✅ Anon key works!');
      console.log('Data:', data);
    }
  } catch (error) {
    console.log('❌ Anon key failed:', error.message);
  }
  
  console.log('\nTesting with service role key...');
  const supabaseService = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey);
  
  try {
    const { data, error } = await supabaseService
      .from('cabin_availability')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ Service role key failed:', error.message);
    } else {
      console.log('✅ Service role key works!');
      console.log('Data:', data);
    }
  } catch (error) {
    console.log('❌ Service role key failed:', error.message);
  }
  
  console.log('\n🎯 Update your .env file:');
  console.log('SUPABASE_URL=http://127.0.0.1:54321');
  console.log('SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0');
  console.log('SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU');
}

testCorrectPort().catch(console.error);


