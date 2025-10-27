import { Client } from 'pg';

async function createEssentialTables() {
  console.log('🏗️  Creating essential tables...\n');

  const client = new Client({
    host: '127.0.0.1',
    port: 54322,
    database: 'postgres',
    user: 'postgres',
    password: 'postgres',
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');

    // Create ship table
    console.log('📋 Creating ship table...');
    await client.query(`
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
    `);
    console.log('✅ Ship table created');

    // Create cabin_availability table
    console.log('📋 Creating cabin_availability table...');
    await client.query(`
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
    `);
    console.log('✅ Cabin availability table created');

    // Create reservation table
    console.log('📋 Creating reservation table...');
    await client.query(`
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
    console.log('✅ Reservation table created');

    // Verify tables were created
    console.log('\n🔍 Verifying tables...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('ship', 'cabin_availability', 'reservation')
      ORDER BY table_name;
    `);
    
    console.log('📋 Created tables:');
    tablesResult.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name}`);
    });
    
    if (tablesResult.rows.length === 3) {
      console.log('\n🎉 All required tables created successfully!');
      console.log('📊 You can now run the sync commands:');
      console.log('   npm run sync-ships');
      console.log('   npm run sync-cabin');
      console.log('   npm run sync-reservations');
    } else {
      console.log(`\n⚠️  Only ${tablesResult.rows.length}/3 tables created`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

createEssentialTables();
