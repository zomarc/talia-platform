#!/usr/bin/env node

/**
 * Fix Supabase API Keys
 * This script will help you get the correct keys from your local Supabase instance
 */

import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

async function checkSupabaseKeys() {
  console.log('🔍 Checking current Supabase configuration...\n');
  
  console.log('Current .env configuration:');
  console.log(`SUPABASE_URL: ${process.env.SUPABASE_URL}`);
  console.log(`SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? 'SET (length: ' + process.env.SUPABASE_ANON_KEY.length + ')' : 'NOT SET'}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET (length: ' + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ')' : 'NOT SET'}`);
  
  // Check if we're using demo keys
  const isDemoAnonKey = process.env.SUPABASE_ANON_KEY?.includes('eyJpc3MiOiJzdXBhYmFzZS1kZW1v');
  const isDemoServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.includes('eyJpc3MiOiJzdXBhYmFzZS1kZW1v');
  
  if (isDemoAnonKey || isDemoServiceKey) {
    console.log('\n❌ You are using DEMO keys! These won\'t work with your local Supabase instance.');
    console.log('🔑 You need to get the REAL keys from your local Supabase dashboard.');
  } else {
    console.log('\n✅ Keys appear to be custom (not demo keys)');
  }
}

async function testSupabaseConnection() {
  console.log('\n🔍 Testing Supabase connection...');
  
  try {
    const response = await fetch('http://127.0.0.1:54323/rest/v1/', {
      headers: {
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
      }
    });
    
    console.log(`Response status: ${response.status}`);
    
    if (response.status === 200) {
      console.log('✅ REST API is accessible');
      return true;
    } else if (response.status === 404) {
      console.log('❌ REST API not accessible (404)');
      console.log('This means the API keys are incorrect or the REST API is not enabled');
      return false;
    } else {
      console.log(`❌ Unexpected status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
    return false;
  }
}

async function getCorrectKeys() {
  console.log('\n🔑 To get the correct API keys:');
  console.log('1. Go to: http://127.0.0.1:54323/');
  console.log('2. Click "Settings" in the left sidebar');
  console.log('3. Click "API"');
  console.log('4. Look for "Project API keys" section');
  console.log('5. Copy the `anon` key and `service_role` key');
  console.log('6. Update your .env file with the correct keys');
  
  console.log('\n📝 Your current .env file location:');
  console.log('/Users/russell/Work/AA-Celestyal/Dev/talia/talia-server/.env');
  
  console.log('\n🛠️  Alternative: Try using the default local Supabase keys:');
  console.log('For local development, try these keys:');
  console.log('SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0');
  console.log('SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU');
}

async function createUpdatedEnvFile() {
  console.log('\n📝 Creating updated .env file...');
  
  const envContent = `# Supabase Configuration (Local Development)
SUPABASE_URL=http://127.0.0.1:54323
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# Azure Synapse Configuration (Production Data)
AZURE_SYNAPSE_SERVER=celestyaldataplatform-prd.sql.azuresynapse.net
AZURE_SYNAPSE_PORT=1433
AZURE_SYNAPSE_DATABASE=CDP_Dedicated_SQL_DWH
AZURE_SYNAPSE_USERNAME=RBryer
AZURE_SYNAPSE_PASSWORD=Cele5tyalrbUser!

# Data Source Priority (supabase | azure | both)
DATA_SOURCE_PRIORITY=supabase

# Environment
NODE_ENV=development
`;

  fs.writeFileSync('.env.updated', envContent);
  console.log('✅ Created .env.updated with default local Supabase keys');
  console.log('📋 You can copy this to replace your current .env file');
}

async function main() {
  console.log('🔧 Fixing Supabase API Keys\n');
  
  // Check current configuration
  await checkSupabaseKeys();
  
  // Test connection
  const isConnected = await testSupabaseConnection();
  
  if (!isConnected) {
    // Get correct keys
    await getCorrectKeys();
    
    // Create updated env file
    await createUpdatedEnvFile();
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Get the correct keys from your Supabase dashboard');
    console.log('2. Update your .env file with the correct keys');
    console.log('3. Or try the default keys in .env.updated');
    console.log('4. Run this script again to test the connection');
  } else {
    console.log('\n✅ Supabase connection is working!');
    console.log('You can now create tables and import data.');
  }
}

main().catch(console.error);


