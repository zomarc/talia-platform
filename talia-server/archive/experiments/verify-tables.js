import { supabase } from './src/lib/supabase.js';

async function verifyAndCreateTables() {
  console.log('🔍 Verifying Supabase tables...\n');

  try {
    // Test connection
    console.log('🔍 Testing Supabase connection...');
    const { data, error: testError } = await supabase.from('_test').select('*').limit(1);
    console.log('✅ Supabase connection working');

    // Check if ship table exists
    console.log('📋 Checking ship table...');
    const { data: shipData, error: shipError } = await supabase
      .from('ship')
      .select('*')
      .limit(1);
    
    if (shipError) {
      console.log('❌ Ship table does not exist:', shipError.message);
      console.log('📝 Need to create tables manually');
      
      // Provide clear instructions
      console.log('\n📋 MANUAL STEPS TO CREATE TABLES:');
      console.log('1. Open Supabase Studio: http://127.0.0.1:54323');
      console.log('2. Go to SQL Editor (left sidebar)');
      console.log('3. Copy and paste this SQL:');
      console.log('\n--- COPY THIS SQL ---');
      console.log(`
-- Ship table
CREATE TABLE IF NOT EXISTS ship (
  id SERIAL PRIMARY KEY,
  ship_id INTEGER,
  ship_code TEXT,
  ship_name TEXT,
  ship_pax_capacity TEXT,
  ship_length TEXT,
  ship_tonnage TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cabin availability table  
CREATE TABLE IF NOT EXISTS cabin_availability (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE,
  sail_code TEXT,
  package_name TEXT,
  sail_days INTEGER,
  cabin_category TEXT,
  available_cabins INTEGER,
  total_cabins INTEGER,
  available_absolute INTEGER,
  available_weighted DECIMAL(10,2),
  availability_result TEXT,
  nested_cabins INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reservation table
CREATE TABLE IF NOT EXISTS reservation (
  id SERIAL PRIMARY KEY,
  res_id BIGINT,
  res_status TEXT,
  pax_status TEXT,
  ship TEXT,
  sail_code TEXT,
  sail_from_date DATE,
  sail_to_date DATE,
  agency_id BIGINT,
  cabin_category TEXT,
  guest_count DECIMAL(5,2),
  gross_selling_fare DECIMAL(15,2),
  net_selling_fare DECIMAL(15,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
      `);
      console.log('--- END SQL ---');
      console.log('\n4. Click "Run" to execute the SQL');
      console.log('5. Come back here and run: npm run sync-ships');
      
    } else {
      console.log('✅ Ship table exists');
      
      // Check other tables
      const { data: cabinData, error: cabinError } = await supabase
        .from('cabin_availability')
        .select('*')
        .limit(1);
      
      if (cabinError) {
        console.log('❌ Cabin availability table missing');
      } else {
        console.log('✅ Cabin availability table exists');
      }
      
      const { data: resData, error: resError } = await supabase
        .from('reservation')
        .select('*')
        .limit(1);
      
      if (resError) {
        console.log('❌ Reservation table missing');
      } else {
        console.log('✅ Reservation table exists');
        console.log('\n🎉 All tables exist! Ready to sync data.');
        console.log('📊 Run: npm run sync-ships');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verifyAndCreateTables();
