#!/usr/bin/env node

/**
 * Create inventory_status_by_day table via Supabase client
 */

import { supabase } from '../src/services/supabase.js';

async function createInventoryTable() {
  console.log('🔄 Creating inventory_status_by_day table...\n');
  
  // Since Supabase JS client doesn't support CREATE TABLE directly,
  // we'll provide the SQL and instructions
  const createTableSQL = `
CREATE TABLE IF NOT EXISTS inventory_status_by_day (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  ship_code TEXT NOT NULL,
  sail_code TEXT,
  capacity INTEGER DEFAULT 0,
  sold INTEGER DEFAULT 0,
  available INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date, ship_code, sail_code)
);

CREATE INDEX IF NOT EXISTS idx_inventory_status_by_day_date ON inventory_status_by_day(date);
CREATE INDEX IF NOT EXISTS idx_inventory_status_by_day_ship_code ON inventory_status_by_day(ship_code);
CREATE INDEX IF NOT EXISTS idx_inventory_status_by_day_sail_code ON inventory_status_by_day(sail_code);
CREATE INDEX IF NOT EXISTS idx_inventory_status_by_day_date_ship ON inventory_status_by_day(date, ship_code);
  `.trim();
  
  console.log('📝 Please run this SQL in Supabase Studio:');
  console.log('   1. Open: http://127.0.0.1:54323');
  console.log('   2. Go to SQL Editor');
  console.log('   3. Paste and run the following SQL:\n');
  console.log(createTableSQL);
  console.log('\n   Or use the migration file:');
  console.log('   supabase/migrations/20251210182349_create_inventory_status_by_day.sql\n');
  
  // Try to verify if table exists by attempting a query
  const { error: checkError } = await supabase
    .from('inventory_status_by_day')
    .select('id')
    .limit(1);
  
  if (checkError && checkError.code === 'PGRST116') {
    console.log('⚠️  Table does not exist yet - please create it using the SQL above');
    return false;
  } else if (checkError) {
    console.log(`⚠️  Error checking table: ${checkError.message}`);
    return false;
  } else {
    console.log('✅ Table already exists!');
    return true;
  }
}

createInventoryTable().then(success => {
  if (success) {
    console.log('\n✅ Ready to proceed with testing!');
  } else {
    console.log('\n📝 After creating the table, run: node scripts/verify-and-test-reservation-fix.js');
  }
  process.exit(success ? 0 : 1);
});

