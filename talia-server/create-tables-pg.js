import { Client } from 'pg';
import fs from 'fs';

async function createTablesFromMigration() {
  console.log('🏗️  Creating tables from migration file...\n');

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

    // Read the migration file
    const migrationPath = './supabase/migrations/20251023004146_create_business_tables.sql';
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📖 Read migration file successfully');
    
    // Split into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📋 Found ${statements.length} SQL statements to execute`);
    
    let successCount = 0;
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`🔄 Executing statement ${i + 1}/${statements.length}...`);
          await client.query(statement);
          successCount++;
          console.log(`✅ Statement ${i + 1} executed successfully`);
        } catch (error) {
          console.log(`⚠️  Statement ${i + 1} error:`, error.message.substring(0, 100));
        }
      }
    }
    
    console.log(`\n🎉 Migration complete! ${successCount}/${statements.length} statements executed successfully`);
    
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

createTablesFromMigration();
