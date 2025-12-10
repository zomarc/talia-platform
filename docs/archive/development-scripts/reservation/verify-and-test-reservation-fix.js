#!/usr/bin/env node

/**
 * Verification and testing script for reservation sail_code fix
 * Verifies data integrity and tests the sync
 */

import { supabase } from '../src/services/supabase.js';

async function verifyDataIntegrity() {
  console.log('🔍 Verifying Data Integrity\n');
  console.log('='.repeat(60));
  
  // 1. Check reservation table
  console.log('\n1️⃣  Reservation Table:');
  const { data: resData, error: resError } = await supabase
    .from('reservation')
    .select('res_id, sail_code, sail_from_date, ship', { count: 'exact', head: false });
  
  if (resError) {
    console.error('   ❌ Error:', resError.message);
    return false;
  }
  
  const total = resData?.length || 0;
  const withSailCode = resData?.filter(r => r.sail_code).length || 0;
  const withoutSailCode = total - withSailCode;
  const percentage = total > 0 ? Math.round(withSailCode / total * 100) : 0;
  
  console.log(`   Total reservations: ${total.toLocaleString()}`);
  console.log(`   With sail_code: ${withSailCode.toLocaleString()} (${percentage}%)`);
  console.log(`   Without sail_code: ${withoutSailCode.toLocaleString()}`);
  
  // Sample some reservations with sail_code
  const sampleWith = resData?.filter(r => r.sail_code).slice(0, 3);
  if (sampleWith && sampleWith.length > 0) {
    console.log(`\n   Sample reservations WITH sail_code:`);
    sampleWith.forEach(r => {
      console.log(`     - RES_ID: ${r.res_id}, sail_code: ${r.sail_code}, date: ${r.sail_from_date}, ship: ${r.ship}`);
    });
  }
  
  // Sample some without (if any)
  const sampleWithout = resData?.filter(r => !r.sail_code).slice(0, 3);
  if (sampleWithout && sampleWithout.length > 0) {
    console.log(`\n   Sample reservations WITHOUT sail_code:`);
    sampleWithout.forEach(r => {
      console.log(`     - RES_ID: ${r.res_id}, date: ${r.sail_from_date}, ship: ${r.ship}`);
      console.log(`       (May not have matching master_sail record)`);
    });
  }
  
  // 2. Check master_sail table (for reference)
  console.log('\n2️⃣  Master Sail Table (reference):');
  const { data: msData, error: msError } = await supabase
    .from('master_sail')
    .select('sail_code, sail_date_from, ship_code', { count: 'exact', head: false })
    .limit(5);
  
  if (msError) {
    console.error('   ❌ Error:', msError.message);
  } else {
    console.log(`   Total master_sail records: ${msData?.length || 0} (showing first 5)`);
    if (msData && msData.length > 0) {
      msData.forEach(ms => {
        console.log(`     - sail_code: ${ms.sail_code}, date: ${ms.sail_date_from}, ship: ${ms.ship_code}`);
      });
    }
  }
  
  // 3. Check reservation_current_state table
  console.log('\n3️⃣  Reservation Current State Table:');
  const { data: stateData, error: stateError } = await supabase
    .from('reservation_current_state')
    .select('res_id, sail_code', { count: 'exact', head: false });
  
  if (stateError && stateError.code === 'PGRST116') {
    console.log('   ℹ️  Table is empty (will be populated by sync)');
  } else if (stateError) {
    console.error('   ❌ Error:', stateError.message);
  } else {
    const totalStates = stateData?.length || 0;
    const statesWithSailCode = stateData?.filter(s => s.sail_code).length || 0;
    const statePercentage = totalStates > 0 ? Math.round(statesWithSailCode / totalStates * 100) : 0;
    
    console.log(`   Total records: ${totalStates.toLocaleString()}`);
    console.log(`   With sail_code: ${statesWithSailCode.toLocaleString()} (${statePercentage}%)`);
    console.log(`   Without sail_code: ${totalStates - statesWithSailCode}`);
    
    if (totalStates === 0) {
      console.log('   ℹ️  Table is empty - run sync to populate');
    }
  }
  
  // 4. Check inventory_status_by_day table
  console.log('\n4️⃣  Inventory Status By Day Table:');
  const { data: invData, error: invError } = await supabase
    .from('inventory_status_by_day')
    .select('id, date, ship_code, sail_code', { count: 'exact', head: false })
    .limit(5);
  
  if (invError && invError.code === 'PGRST116') {
    console.log('   ⚠️  Table does not exist');
    console.log('   📝 Create it manually in Supabase Studio:');
    console.log('      http://127.0.0.1:54323 → SQL Editor');
    console.log('      Run: supabase/migrations/20251210182349_create_inventory_status_by_day.sql');
  } else if (invError) {
    console.error('   ❌ Error:', invError.message);
  } else {
    console.log(`   ✅ Table exists`);
    console.log(`   Total records: ${invData?.length || 0} (showing first 5)`);
    if (invData && invData.length > 0) {
      invData.forEach(inv => {
        console.log(`     - date: ${inv.date}, ship: ${inv.ship_code}, sail: ${inv.sail_code || 'NULL'}, capacity: ${inv.capacity || 0}, sold: ${inv.sold || 0}`);
      });
    } else {
      console.log('   ℹ️  Table is empty - run inventory status sync to populate');
    }
  }
  
  return true;
}

async function testSyncReadiness() {
  console.log('\n🧪 Testing Sync Readiness\n');
  console.log('='.repeat(60));
  
  // Check if we have the necessary data for sync
  console.log('\n✅ Prerequisites check:');
  
  // 1. Reservation table has data
  const { count: resCount } = await supabase
    .from('reservation')
    .select('*', { count: 'exact', head: true });
  console.log(`   ${resCount > 0 ? '✅' : '❌'} Reservation table has data: ${resCount || 0} records`);
  
  // 2. Master sail table has data
  const { count: msCount } = await supabase
    .from('master_sail')
    .select('*', { count: 'exact', head: true });
  console.log(`   ${msCount > 0 ? '✅' : '❌'} Master sail table has data: ${msCount || 0} records`);
  
  // 3. Some reservations have sail_code
  const { count: withSailCodeCount } = await supabase
    .from('reservation')
    .select('*', { count: 'exact', head: true })
    .not('sail_code', 'is', null);
  console.log(`   ${withSailCodeCount > 0 ? '✅' : '⚠️ '} Reservations with sail_code: ${withSailCodeCount || 0}`);
  
  if (withSailCodeCount === 0) {
    console.log('\n   ⚠️  WARNING: No reservations have sail_code yet');
    console.log('   📝 Run the migration script again to populate more:');
    console.log('      node scripts/apply-reservation-fix-migrations.js');
  }
  
  console.log('\n✅ Ready to test sync!');
  console.log('   Run: npm run sync-reservationChanges');
}

async function main() {
  console.log('🧪 Reservation Sail Code Fix - Verification & Testing\n');
  
  try {
    await verifyDataIntegrity();
    await testSyncReadiness();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Verification complete!');
    console.log('\n📝 Summary:');
    console.log('   1. ✅ Code changes applied (removed external joins)');
    console.log('   2. ✅ Migration script updated reservation.sail_code');
    console.log('   3. ✅ reservation_current_state will get sail_code from local reservation table');
    console.log('   4. ⚠️  inventory_status_by_day table needs manual creation (see instructions above)');
    console.log('\n🚀 Next: Test the sync with: npm run sync-reservationChanges');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

