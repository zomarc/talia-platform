#!/usr/bin/env node

/**
 * Test Data Connection Script
 * 
 * This script tests the connection to both Supabase and Azure Synapse
 * to verify that data integration is working correctly.
 */

import dotenv from 'dotenv';
import { supabaseDataService } from '../src/lib/supabase-simple.js';
import { azureSynapseService } from '../src/lib/azure-synapse.js';

// Load environment variables
dotenv.config();

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connection...');
  
  try {
    const ships = await supabaseDataService.getShips();
    console.log('✅ Supabase connection successful');
    console.log(`📊 Found ${ships.length} ships in Supabase`);
    
    if (ships.length > 0) {
      console.log('📋 Sample ship data:');
      console.log(JSON.stringify(ships[0], null, 2));
    }
    
    return true;
  } catch (error) {
    console.error('❌ Supabase connection failed:', error.message);
    return false;
  }
}

async function testAzureSynapseConnection() {
  console.log('🔍 Testing Azure Synapse connection...');
  
  try {
    await azureSynapseService.connect();
    console.log('✅ Azure Synapse connection successful');
    
    const ships = await azureSynapseService.getShips();
    console.log(`📊 Found ${ships.length} ships in Azure Synapse`);
    
    if (ships.length > 0) {
      console.log('📋 Sample ship data:');
      console.log(JSON.stringify(ships[0], null, 2));
    }
    
    await azureSynapseService.disconnect();
    return true;
  } catch (error) {
    console.error('❌ Azure Synapse connection failed:', error.message);
    return false;
  }
}

async function testDataIntegration() {
  console.log('🚀 Testing Talia Data Integration...\n');
  
  const supabaseSuccess = await testSupabaseConnection();
  console.log('');
  
  const azureSuccess = await testAzureSynapseConnection();
  console.log('');
  
  console.log('📊 Test Results:');
  console.log(`   Supabase: ${supabaseSuccess ? '✅ Connected' : '❌ Failed'}`);
  console.log(`   Azure Synapse: ${azureSuccess ? '✅ Connected' : '❌ Failed'}`);
  
  if (supabaseSuccess || azureSuccess) {
    console.log('\n🎉 Data integration is working!');
    console.log('🔗 You can now start your GraphQL server:');
    console.log('   cd talia-server && npm start');
    console.log('🌐 GraphQL Playground: http://localhost:4000/graphql');
  } else {
    console.log('\n⚠️  No data sources are available.');
    console.log('📋 Please check your configuration and try again.');
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testDataIntegration().catch(console.error);
}

export { testSupabaseConnection, testAzureSynapseConnection, testDataIntegration };
