#!/usr/bin/env node

/**
 * Clear All InstantDB Data Script
 * This script clears all userMappings data for a fresh start
 */

import { init } from '@instantdb/react';

// Initialize InstantDB
const db = init({ 
  appId: '1c2b040a-7bb2-4eb5-8490-ce5832e19dd0' 
});

async function clearAllData() {
  try {
    console.log('🗑️ Clearing all userMappings data...');
    
    // Get all userMappings
    const result = await db.queryOnce({
      userMappings: {}
    });
    
    const mappings = result.data?.userMappings || [];
    
    if (mappings.length === 0) {
      console.log('✅ No data to clear');
      return;
    }
    
    console.log(`Found ${mappings.length} user mappings to delete`);
    
    // Delete all userMappings
    const deleteOps = mappings.map(mapping => 
      db.tx.userMappings[mapping.id].delete()
    );
    
    await db.transact(deleteOps);
    console.log('✅ All userMappings cleared successfully');
    
  } catch (error) {
    console.error('❌ Error clearing data:', error);
  }
}

// Run the script
clearAllData()
  .then(() => {
    console.log('🎉 Data clearing complete - ready for fresh sign-ins!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
