import { supabase } from './src/lib/supabase.js';

async function createEssentialTables() {
  console.log('🏗️  Creating essential tables for sync service...\n');

  try {
    // Create ship table
    console.log('📋 Creating ship table...');
    const shipSQL = `
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
    `;
    
    // Create cabin_availability table
    console.log('📋 Creating cabin_availability table...');
    const cabinSQL = `
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
    `;
    
    // Create reservation table
    console.log('📋 Creating reservation table...');
    const reservationSQL = `
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
    `;

    console.log('📝 Note: Tables need to be created manually in Supabase Studio');
    console.log('🌐 Open: http://127.0.0.1:54323');
    console.log('📋 Go to SQL Editor and run these CREATE TABLE statements:');
    console.log('\n--- SHIP TABLE ---');
    console.log(shipSQL);
    console.log('\n--- CABIN_AVAILABILITY TABLE ---');
    console.log(cabinSQL);
    console.log('\n--- RESERVATION TABLE ---');
    console.log(reservationSQL);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createEssentialTables();
