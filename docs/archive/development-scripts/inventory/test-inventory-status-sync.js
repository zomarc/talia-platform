#!/usr/bin/env node

/**
 * Test script for inventory status sync
 * Populates inventory_status_by_day table from cabin_availability and reservation tables
 */

import { syncInventoryStatusByDay } from '../src/services/inventory-status-sync.js';

async function main() {
  console.log('🧪 Testing Inventory Status Sync\n');
  console.log('='.repeat(60));
  
  const dateFrom = '2025-09-01';
  const dateTo = '2025-12-31';
  
  console.log(`📅 Date range: ${dateFrom} to ${dateTo}\n`);
  
  try {
    const result = await syncInventoryStatusByDay({
      dateFrom,
      dateTo,
      logger: {
        info: (...args) => console.log('   ', ...args),
        error: (...args) => console.error('   ❌', ...args),
        warn: (...args) => console.warn('   ⚠️ ', ...args)
      }
    });
    
    if (result.success) {
      console.log('\n' + '='.repeat(60));
      console.log('✅ Inventory status sync completed successfully!');
      console.log(`📊 Records processed: ${result.recordsProcessed.toLocaleString()}`);
      console.log(`⏱️  Duration: ${(result.duration / 1000).toFixed(2)}s`);
    } else {
      console.log('\n' + '='.repeat(60));
      console.log('❌ Inventory status sync failed');
      console.log(`Error: ${result.error}`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

