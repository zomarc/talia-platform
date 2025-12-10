#!/usr/bin/env node

import { supabase } from '../src/services/supabase.js';

async function checkReservationCurrentState() {
  console.log('🔍 Checking reservation_current_state table...\n');
  
  // Get sample records with sail_code
  const { data: withSailCode, error: error1 } = await supabase
    .from('reservation_current_state')
    .select('res_id, sail_code, snapshot_date, guest_count, agency_id')
    .not('sail_code', 'is', null)
    .limit(10);
  
  if (error1) {
    console.error('❌ Error:', error1.message);
    return;
  }
  
  // Get total counts
  const { data: allData, error: error2 } = await supabase
    .from('reservation_current_state')
    .select('res_id, sail_code');
  
  if (error2) {
    console.error('❌ Error:', error2.message);
    return;
  }
  
  const total = allData?.length || 0;
  const withSailCodeCount = allData?.filter(d => d.sail_code).length || 0;
  const percentage = total > 0 ? Math.round(withSailCodeCount / total * 100) : 0;
  
  console.log(`📊 Total records: ${total.toLocaleString()}`);
  console.log(`✅ With sail_code: ${withSailCodeCount.toLocaleString()} (${percentage}%)`);
  console.log(`⚠️  Without sail_code: ${total - withSailCodeCount.toLocaleString()}`);
  
  if (withSailCode && withSailCode.length > 0) {
    console.log('\n✅ Sample records WITH sail_code:');
    withSailCode.slice(0, 5).forEach(d => {
      console.log(`   RES_ID: ${d.res_id} | sail_code: ${d.sail_code} | date: ${d.snapshot_date} | guests: ${d.guest_count}`);
    });
  } else {
    console.log('\n⚠️  No records with sail_code found');
    console.log('   This means the sync may not have loaded sail_code from reservation table');
  }
  
  // Get sample without sail_code
  const { data: withoutSailCode } = await supabase
    .from('reservation_current_state')
    .select('res_id, sail_code, snapshot_date')
    .is('sail_code', null)
    .limit(5);
  
  if (withoutSailCode && withoutSailCode.length > 0) {
    console.log('\n⚠️  Sample records WITHOUT sail_code:');
    withoutSailCode.slice(0, 3).forEach(d => {
      console.log(`   RES_ID: ${d.res_id} | date: ${d.snapshot_date}`);
      
      // Check if reservation table has sail_code for this res_id
      supabase
        .from('reservation')
        .select('sail_code')
        .eq('res_id', d.res_id)
        .single()
        .then(({ data: resData }) => {
          if (resData?.sail_code) {
            console.log(`      → Reservation table HAS sail_code: ${resData.sail_code} (but current_state doesn't)`);
          } else {
            console.log(`      → Reservation table also doesn't have sail_code`);
          }
        });
    });
  }
}

checkReservationCurrentState();

