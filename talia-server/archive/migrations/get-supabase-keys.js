#!/usr/bin/env node

/**
 * Get Supabase API keys from local instance
 */

import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

async function getSupabaseKeys() {
  console.log('🔑 Getting Supabase API keys from local instance...\n');
  
  try {
    // Try to get keys from the Supabase API
    const response = await fetch('http://127.0.0.1:54323/rest/v1/', {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.text();
      console.log('Response data:', data);
    } else {
      console.log('❌ API not accessible');
    }
    
    // Try to get keys from the dashboard
    console.log('\n📋 To get the correct API keys:');
    console.log('1. Go to: http://127.0.0.1:54323/');
    console.log('2. Click on "Settings" in the left sidebar');
    console.log('3. Click on "API"');
    console.log('4. Look for "Project API keys" section');
    console.log('5. Copy the `anon` key and `service_role` key');
    console.log('6. Update your .env file with the correct keys');
    
    // Check if we can access the database directly
    console.log('\n🔍 Trying to access database directly...');
    
    // Try different common ports for PostgreSQL
    const commonPorts = [5432, 5433, 5434, 5435];
    
    for (const port of commonPorts) {
      try {
        const dbResponse = await fetch(`http://127.0.0.1:${port}/`, {
          method: 'GET',
          timeout: 1000
        });
        console.log(`Port ${port}: ${dbResponse.status}`);
      } catch (error) {
        // Port not accessible, continue
      }
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// Run the key retrieval
getSupabaseKeys().catch(console.error);


