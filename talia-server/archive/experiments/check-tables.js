import { supabase } from './src/lib/supabase.js';

async function createTables() {
  console.log('🏗️  Creating tables in Supabase...\n');

  try {
    // Test connection
    console.log('🔍 Testing Supabase connection...');
    const { data, error: testError } = await supabase.from('_test').select('*').limit(1);
    console.log('✅ Supabase connection working');

    // Create ship table using direct SQL execution
    console.log('📋 Creating ship table...');
    
    // Try to insert a test record to see if table exists
    const { data: shipData, error: shipError } = await supabase
      .from('ship')
      .select('*')
      .limit(1);
    
    if (shipError) {
      console.log('❌ Ship table does not exist:', shipError.message);
      console.log('📝 Need to create tables manually in Supabase Studio');
      console.log('🌐 Open: http://127.0.0.1:54323');
      console.log('📋 Go to SQL Editor and run the migration file');
    } else {
      console.log('✅ Ship table exists');
    }

    // Check cabin_availability table
    console.log('📋 Checking cabin_availability table...');
    const { data: cabinData, error: cabinError } = await supabase
      .from('cabin_availability')
      .select('*')
      .limit(1);
    
    if (cabinError) {
      console.log('❌ Cabin availability table does not exist:', cabinError.message);
    } else {
      console.log('✅ Cabin availability table exists');
    }

    // Check reservation table
    console.log('📋 Checking reservation table...');
    const { data: resData, error: resError } = await supabase
      .from('reservation')
      .select('*')
      .limit(1);
    
    if (resError) {
      console.log('❌ Reservation table does not exist:', resError.message);
    } else {
      console.log('✅ Reservation table exists');
    }

    console.log('\n📝 To create tables manually:');
    console.log('1. Open Supabase Studio: http://127.0.0.1:54323');
    console.log('2. Go to SQL Editor');
    console.log('3. Run the migration file: supabase/migrations/20251023004146_create_business_tables.sql');

  } catch (error) {
    console.error('❌ Error checking tables:', error);
  }
}

createTables();
