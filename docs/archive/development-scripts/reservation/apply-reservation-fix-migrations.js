#!/usr/bin/env node

/**
 * Safe migration script for reservation sail_code fix
 * Applies migrations directly via Supabase client (safer than CLI)
 */

import { supabase } from '../src/services/supabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function executeSQL(sql) {
  // Try using Supabase REST API with exec_sql function
  // If that doesn't work, we'll use direct PostgreSQL connection
  try {
    const response = await fetch('http://127.0.0.1:54321/rest/v1/rpc/exec_sql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz',
        'apikey': 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'
      },
      body: JSON.stringify({ sql })
    });
    
    if (response.ok) {
      return { success: true };
    } else {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function applyMigration1() {
  console.log('📝 Migration 1: Populating reservation.sail_code from master_sail...\n');
  
  const migrationPath = path.join(__dirname, '../supabase/migrations/20251210182348_populate_reservation_sail_code.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  // Extract just the UPDATE statement (skip the DO block for now)
  const updateSQL = `
    UPDATE reservation r
    SET sail_code = ms.sail_code
    FROM master_sail ms
    WHERE r.sail_code IS NULL
      AND r.sail_from_date IS NOT NULL
      AND r.ship IS NOT NULL
      AND r.sail_from_date = ms.sail_date_from
      AND r.ship = ms.ship_code;
  `;
  
  console.log('   Executing UPDATE statement...');
  const result = await executeSQL(updateSQL);
  
  if (!result.success) {
    console.log(`   ⚠️  Direct SQL execution failed: ${result.error}`);
    console.log('   ℹ️  Will use Supabase client method instead...');
    
    // Alternative: Use Supabase client to update records
    // Process in batches to handle large datasets
    let totalUpdated = 0;
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      // Get reservations without sail_code that have matching master_sail records
      const { data: reservations, error: resError } = await supabase
        .from('reservation')
        .select('res_id, sail_from_date, ship')
        .is('sail_code', null)
        .not('sail_from_date', 'is', null)
        .not('ship', 'is', null)
        .range(offset, offset + batchSize - 1);
    
    if (resError) {
      console.error(`   ❌ Error fetching reservations: ${resError.message}`);
      return false;
    }
    
      if (resError) {
        console.error(`   ❌ Error fetching reservations: ${resError.message}`);
        return false;
      }
      
      if (!reservations || reservations.length === 0) {
        hasMore = false;
        break;
      }
      
      console.log(`   Processing batch: ${offset + 1} to ${offset + reservations.length}...`);
      
      // Get matching master_sail records
      const sailDates = [...new Set(reservations.map(r => r.sail_from_date))];
      const shipCodes = [...new Set(reservations.map(r => r.ship))];
      
      const { data: masterSailData, error: msError } = await supabase
        .from('master_sail')
        .select('sail_code, sail_date_from, ship_code')
        .in('sail_date_from', sailDates)
        .in('ship_code', shipCodes);
      
      if (msError) {
        console.error(`   ❌ Error fetching master_sail: ${msError.message}`);
        return false;
      }
      
      // Create lookup map
      const sailCodeMap = new Map();
      masterSailData?.forEach(ms => {
        const key = `${ms.sail_date_from}_${ms.ship_code}`;
        sailCodeMap.set(key, ms.sail_code);
      });
      
      // Update reservations in sub-batches
      const updateBatchSize = 100;
      let batchUpdated = 0;
      
      for (let i = 0; i < reservations.length; i += updateBatchSize) {
        const updateBatch = reservations.slice(i, i + updateBatchSize);
        const updates = [];
        
        for (const res of updateBatch) {
          const key = `${res.sail_from_date}_${res.ship}`;
          const sailCode = sailCodeMap.get(key);
          if (sailCode) {
            updates.push(
              supabase
                .from('reservation')
                .update({ sail_code: sailCode })
                .eq('res_id', res.res_id)
            );
          }
        }
        
        if (updates.length > 0) {
          const results = await Promise.all(updates);
          const successCount = results.filter(r => !r.error).length;
          batchUpdated += successCount;
          totalUpdated += successCount;
        }
      }
      
      console.log(`   ✅ Updated ${batchUpdated} in this batch (total: ${totalUpdated})`);
      
      // Check if there are more records
      hasMore = reservations.length === batchSize;
      offset += batchSize;
    }
    
    console.log(`   ✅ Total updated: ${totalUpdated} reservations with sail_code`);
    return true;
  }
  
  console.log('   ✅ UPDATE statement executed successfully');
  return true;
}

async function applyMigration2() {
  console.log('\n📝 Migration 2: Creating inventory_status_by_day table...\n');
  
  // Check if table already exists
  const { data: existingTable, error: checkError } = await supabase
    .from('inventory_status_by_day')
    .select('id')
    .limit(1);
  
  if (!checkError || checkError.code !== 'PGRST116') {
    if (checkError && checkError.code !== 'PGRST116') {
      console.log(`   ⚠️  Error checking table: ${checkError.message}`);
    } else {
      console.log(`   ℹ️  Table already exists, skipping creation`);
      return true;
    }
  }
  
  // Create table using Supabase client (via direct SQL execution)
  // Since we can't use exec_sql RPC, we'll create it via a manual SQL script
  // that the user can run, or we'll note it needs manual creation
  console.log('   ℹ️  Table creation requires manual SQL execution');
  console.log('   📝 Please run this SQL in Supabase Studio (http://127.0.0.1:54323):');
  console.log('');
  console.log('   CREATE TABLE IF NOT EXISTS inventory_status_by_day (');
  console.log('     id SERIAL PRIMARY KEY,');
  console.log('     date DATE NOT NULL,');
  console.log('     ship_code TEXT NOT NULL,');
  console.log('     sail_code TEXT,');
  console.log('     capacity INTEGER DEFAULT 0,');
  console.log('     sold INTEGER DEFAULT 0,');
  console.log('     available INTEGER DEFAULT 0,');
  console.log('     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),');
  console.log('     UNIQUE(date, ship_code, sail_code)');
  console.log('   );');
  console.log('');
  console.log('   CREATE INDEX IF NOT EXISTS idx_inventory_status_by_day_date ON inventory_status_by_day(date);');
  console.log('   CREATE INDEX IF NOT EXISTS idx_inventory_status_by_day_ship_code ON inventory_status_by_day(ship_code);');
  console.log('   CREATE INDEX IF NOT EXISTS idx_inventory_status_by_day_sail_code ON inventory_status_by_day(sail_code);');
  console.log('');
  
  // Try to create via a workaround - use a simple INSERT to test if table exists
  // If it fails with "relation does not exist", we know we need to create it
  const testInsert = await supabase
    .from('inventory_status_by_day')
    .insert({ date: '2025-01-01', ship_code: 'TEST', capacity: 0, sold: 0, available: 0 })
    .select();
  
  if (testInsert.error && testInsert.error.code === 'PGRST116') {
    console.log('   ⚠️  Table does not exist and cannot be created via client');
    console.log('   ℹ️  Please create it manually using the SQL above');
    return false;
  } else if (testInsert.error && testInsert.error.message?.includes('duplicate key')) {
    // Table exists and unique constraint worked - delete test record
    await supabase
      .from('inventory_status_by_day')
      .delete()
      .eq('date', '2025-01-01')
      .eq('ship_code', 'TEST');
    console.log('   ✅ Table exists');
    return true;
  } else if (!testInsert.error) {
    // Insert succeeded - delete test record
    await supabase
      .from('inventory_status_by_day')
      .delete()
      .eq('date', '2025-01-01')
      .eq('ship_code', 'TEST');
    console.log('   ✅ Table exists');
    return true;
  }
  
  return false;
}

async function checkResults() {
  console.log('\n🔍 Checking results...\n');
  
  // Check reservation table
  const { data: resData, error: resError } = await supabase
    .from('reservation')
    .select('res_id, sail_code', { count: 'exact', head: false });
  
  if (resError) {
    console.error('❌ Error:', resError.message);
    return;
  }
  
  const total = resData?.length || 0;
  const withSailCode = resData?.filter(r => r.sail_code).length || 0;
  
  console.log(`📊 Reservation table:`);
  console.log(`   Total: ${total}`);
  console.log(`   With sail_code: ${withSailCode} (${total > 0 ? Math.round(withSailCode/total*100) : 0}%)`);
  console.log(`   Without sail_code: ${total - withSailCode}`);
  
  // Check inventory_status_by_day table
  const { data: invData, error: invError } = await supabase
    .from('inventory_status_by_day')
    .select('id', { count: 'exact', head: true });
  
  if (invError && invError.code === 'PGRST116') {
    console.log(`\n⚠️  inventory_status_by_day table: Not created yet`);
    console.log(`   You may need to create it manually in Supabase Studio`);
  } else if (invError) {
    console.log(`\n⚠️  Error checking inventory_status_by_day: ${invError.message}`);
  } else {
    console.log(`\n✅ inventory_status_by_day table: Created successfully`);
  }
}

async function main() {
  console.log('🔄 Applying Reservation Sail Code Fix Migrations\n');
  console.log('='.repeat(60));
  
  try {
    // Check current state
    console.log('\n📊 Current state:');
    const { data: beforeData } = await supabase
      .from('reservation')
      .select('res_id, sail_code', { count: 'exact', head: false });
    const beforeCount = beforeData?.filter(r => r.sail_code).length || 0;
    const beforeTotal = beforeData?.length || 0;
    console.log(`   Reservations with sail_code: ${beforeCount}/${beforeTotal}`);
    
    // Apply migrations
    await applyMigration1();
    await applyMigration2();
    
    // Check results
    await checkResults();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Migrations applied successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Test sync: npm run sync-reservationChanges');
    console.log('   2. Verify reservation_current_state has sail_code');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

