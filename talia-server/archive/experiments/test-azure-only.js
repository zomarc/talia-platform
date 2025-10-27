#!/usr/bin/env node

/**
 * Test Azure Synapse Connection Only
 */

import dotenv from 'dotenv';
import { azureSynapseService } from '../src/lib/azure-synapse.js';

// Load environment variables
dotenv.config();

async function testAzureConnection() {
  console.log('🔍 Testing Azure Synapse connection...');
  console.log('Server:', process.env.AZURE_SYNAPSE_SERVER);
  console.log('Username:', process.env.AZURE_SYNAPSE_USERNAME);
  
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

// Run test
testAzureConnection().catch(console.error);

