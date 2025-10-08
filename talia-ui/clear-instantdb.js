#!/usr/bin/env node

/**
 * Clear InstantDB Data Script
 * This script clears all userMappings data from InstantDB
 */

import { init } from '@instantdb/react';

// Initialize InstantDB
const db = init({ 
  appId: '1c2b040a-7bb2-4eb5-8490-ce5832e19dd0' 
});

async function clearInstantDBData() {
  try {
    console.log('🗑️ Clearing all InstantDB data...');
    
    // Use the admin API to query data
    const result = await db.adminAPI.query({ userMappings: {} });
    const mappings = result.data?.userMappings || [];
    
    if (mappings.length === 0) {
      console.log('✅ No data to clear');
      return;
    }
    
    console.log(`Found ${mappings.length} user mappings to delete`);
    
    // Delete all userMappings using admin API
    const deleteOps = mappings.map(mapping => 
      db.adminAPI.tx.userMappings[mapping.id].delete()
    );
    
    await db.adminAPI.transact(deleteOps);
    console.log('✅ All userMappings cleared successfully');
    
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    console.error('Error details:', error.message);
  }
}

// Run the script
clearInstantDBData()
  .then(() => {
    console.log('🎉 Data clearing complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
