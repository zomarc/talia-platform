#!/usr/bin/env node

import { supabase } from '../src/services/supabase.js';

async function verifyInventoryStatus() {
  console.log('🔍 Verifying inventory_status_by_day table...\n');
  
  // Get total count
  const { data: allData, error: error1 } = await supabase
    .from('inventory_status_by_day')
    .select('*');
  
  if (error1) {
    console.error('❌ Error:', error1.message);
    return;
  }
  
  const total = allData?.length || 0;
  console.log(`📊 Total records: ${total.toLocaleString()}`);
  
  if (total === 0) {
    console.log('⚠️  No records found in inventory_status_by_day table');
    return;
  }
  
  // Get sample records
  const { data: samples } = await supabase
    .from('inventory_status_by_day')
    .select('*')
    .order('date', { ascending: true })
    .limit(10);
  
  if (samples && samples.length > 0) {
    console.log('\n✅ Sample records:');
    samples.forEach(r => {
      console.log(`   Date: ${r.date} | Ship: ${r.ship_code} | Sail: ${r.sail_code || 'N/A'}`);
      console.log(`      Capacity: ${r.capacity} | Sold: ${r.sold} | Available: ${r.available}`);
    });
  }
  
  // Get statistics
  const stats = {
    totalCapacity: 0,
    totalSold: 0,
    totalAvailable: 0,
    withSailCode: 0,
    withoutSailCode: 0
  };
  
  allData?.forEach(r => {
    stats.totalCapacity += r.capacity || 0;
    stats.totalSold += r.sold || 0;
    stats.totalAvailable += r.available || 0;
    if (r.sail_code) stats.withSailCode++;
    else stats.withoutSailCode++;
  });
  
  console.log('\n📈 Statistics:');
  console.log(`   Total Capacity: ${stats.totalCapacity.toLocaleString()}`);
  console.log(`   Total Sold: ${stats.totalSold.toLocaleString()}`);
  console.log(`   Total Available: ${stats.totalAvailable.toLocaleString()}`);
  console.log(`   Records with sail_code: ${stats.withSailCode} (${Math.round(stats.withSailCode/total*100)}%)`);
  console.log(`   Records without sail_code: ${stats.withoutSailCode} (${Math.round(stats.withoutSailCode/total*100)}%)`);
  
  // Get date range
  const dates = allData?.map(r => r.date).filter(Boolean).sort() || [];
  if (dates.length > 0) {
    console.log(`\n📅 Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
  }
  
  // Get unique ships
  const ships = [...new Set(allData?.map(r => r.ship_code).filter(Boolean) || [])];
  console.log(`🚢 Unique ships: ${ships.length} (${ships.slice(0, 5).join(', ')}${ships.length > 5 ? '...' : ''})`);
}

verifyInventoryStatus();

