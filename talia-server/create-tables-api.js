// Using built-in fetch (Node.js 18+)

async function createTablesViaAPI() {
  console.log('🏗️  Creating tables via Supabase REST API...\n');

  const apiUrl = 'http://127.0.0.1:54321';
  const serviceKey = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

  try {
    // Create ship table
    console.log('📋 Creating ship table...');
    const shipSQL = `CREATE TABLE IF NOT EXISTS ship (
      id SERIAL PRIMARY KEY,
      ship_id INTEGER,
      ship_code TEXT,
      ship_name TEXT,
      ship_pax_capacity TEXT,
      ship_length TEXT,
      ship_tonnage TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );`;

    const shipResponse = await fetch(`${apiUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey
      },
      body: JSON.stringify({ sql: shipSQL })
    });

    if (shipResponse.ok) {
      console.log('✅ Ship table created successfully');
    } else {
      const error = await shipResponse.text();
      console.log('⚠️  Ship table creation:', error.substring(0, 100));
    }

    // Create cabin_availability table
    console.log('📋 Creating cabin_availability table...');
    const cabinSQL = `CREATE TABLE IF NOT EXISTS cabin_availability (
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
    );`;

    const cabinResponse = await fetch(`${apiUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey
      },
      body: JSON.stringify({ sql: cabinSQL })
    });

    if (cabinResponse.ok) {
      console.log('✅ Cabin availability table created successfully');
    } else {
      const error = await cabinResponse.text();
      console.log('⚠️  Cabin availability table creation:', error.substring(0, 100));
    }

    // Create reservation table
    console.log('📋 Creating reservation table...');
    const reservationSQL = `CREATE TABLE IF NOT EXISTS reservation (
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
    );`;

    const reservationResponse = await fetch(`${apiUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey
      },
      body: JSON.stringify({ sql: reservationSQL })
    });

    if (reservationResponse.ok) {
      console.log('✅ Reservation table created successfully');
    } else {
      const error = await reservationResponse.text();
      console.log('⚠️  Reservation table creation:', error.substring(0, 100));
    }

    console.log('\n🎉 Table creation complete!');
    console.log('📊 You can now run the sync commands:');
    console.log('   npm run sync-ships');
    console.log('   npm run sync-cabin');
    console.log('   npm run sync-reservations');

  } catch (error) {
    console.error('❌ Error creating tables:', error);
    console.log('\n📝 Manual steps:');
    console.log('1. Open Supabase Studio: http://127.0.0.1:54323');
    console.log('2. Go to SQL Editor');
    console.log('3. Run the CREATE TABLE statements manually');
  }
}

createTablesViaAPI();
