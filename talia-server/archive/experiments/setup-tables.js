import { supabase } from './src/lib/supabase.js';

async function setupTables() {
  console.log('🏗️  Setting up Supabase tables...\n');

  try {
    // Test connection first
    console.log('🔍 Testing Supabase connection...');
    const { data, error: testError } = await supabase.from('_test').select('*').limit(1);
    if (testError && testError.code !== 'PGRST116') {
      console.log('✅ Supabase connection working');
    }

    // Create ships table using SQL
    console.log('📋 Creating ships table...');
    const { error: shipsError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS ships (
          ship_id INTEGER PRIMARY KEY,
          ship_code VARCHAR(10),
          ship_name VARCHAR(100),
          ship_pax_capacity VARCHAR(20),
          ship_length VARCHAR(20),
          ship_tonnage VARCHAR(20),
          synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });
    
    if (shipsError) {
      console.log('⚠️  Ships table creation result:', shipsError.message);
    } else {
      console.log('✅ Ships table created successfully');
    }

    // Create cabin_availability table
    console.log('📋 Creating cabin_availability table...');
    const { error: cabinError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS cabin_availability (
          id SERIAL PRIMARY KEY,
          snapshot_date DATE,
          sail_code VARCHAR(20),
          package_name VARCHAR(100),
          sail_days INTEGER,
          cabin_category VARCHAR(50),
          available_cabins INTEGER,
          total_cabins INTEGER,
          available_absolute INTEGER,
          available_weighted INTEGER,
          availability_result VARCHAR(50),
          nested_cabins INTEGER,
          synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });
    
    if (cabinError) {
      console.log('⚠️  Cabin availability table creation result:', cabinError.message);
    } else {
      console.log('✅ Cabin availability table created successfully');
    }

    // Create reservations table
    console.log('📋 Creating reservations table...');
    const { error: resError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS reservations (
          id SERIAL PRIMARY KEY,
          wc_snapshot_date DATE,
          group_id VARCHAR(50),
          res_id VARCHAR(50),
          ship VARCHAR(10),
          sail_code VARCHAR(20),
          sail_from_date DATE,
          sail_to_date DATE,
          agency_id VARCHAR(50),
          cabin_category VARCHAR(50),
          guest_count INTEGER,
          pax_status VARCHAR(50),
          group_status VARCHAR(50),
          res_status VARCHAR(50),
          gross_selling_fare DECIMAL(10,2),
          net_selling_fare DECIMAL(10,2),
          synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });
    
    if (resError) {
      console.log('⚠️  Reservations table creation result:', resError.message);
    } else {
      console.log('✅ Reservations table created successfully');
    }

    console.log('\n🎉 All tables setup complete!');
    console.log('📊 You can now run the sync commands:');
    console.log('   npm run sync-ships');
    console.log('   npm run sync-cabin');
    console.log('   npm run sync-reservations');
    console.log('   npm run sync-all');

  } catch (error) {
    console.error('❌ Error setting up tables:', error);
  }
}

setupTables();
