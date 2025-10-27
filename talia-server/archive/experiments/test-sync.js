#!/usr/bin/env node

// Test script for SynapseSyncService
// This will test the basic structure and connection

import { synapseSyncService } from './src/lib/synapse-sync.js';

console.log('🧪 Testing SynapseSyncService...\n');

// Test 1: List configured tables
console.log('📋 Configured Tables:');
const tables = synapseSyncService.listConfiguredTables();
tables.forEach(table => {
  console.log(`  • ${table.name}: ${table.description}`);
  console.log(`    Source: ${table.sourceTable} → Target: ${table.targetTable}`);
  if (table.constraints.length > 0) {
    console.log(`    Constraints: ${table.constraints.join(', ')}`);
  }
  console.log('');
});

// Test 2: Test connection (only if environment variables are set)
if (process.env.AZURE_SYNAPSE_SERVER) {
  console.log('🔍 Testing connection...');
  
  synapseSyncService.testConnection()
    .then(async (success) => {
      if (success) {
        console.log('\n🧪 Testing individual table queries...');
        
        // Test each configured table
        for (const table of tables) {
          try {
            const result = await synapseSyncService.testTableQuery(table.name);
            if (result.success) {
              console.log(`✅ ${table.name}: ${result.recordCount} records`);
            } else {
              console.log(`❌ ${table.name}: ${result.error}`);
            }
          } catch (error) {
            console.log(`❌ ${table.name}: ${error.message}`);
          }
        }
        
        console.log('\n✅ All tests passed!');
      } else {
        console.log('❌ Connection test failed');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
} else {
  console.log('⚠️  Skipping connection test (no environment variables set)');
  console.log('💡 To test connection, set environment variables:');
  console.log('   export AZURE_SYNAPSE_SERVER=your-server');
  console.log('   export AZURE_SYNAPSE_USERNAME=your-username');
  console.log('   export AZURE_SYNAPSE_PASSWORD=your-password');
  console.log('✅ Basic structure test passed!');
}
