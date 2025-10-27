import { supabase } from './src/lib/supabase.js';
import fs from 'fs';

async function createTablesFromMigration() {
  console.log('🏗️  Creating tables from migration file...\n');

  try {
    // Read the migration file
    const migrationPath = './supabase/migrations/20251023004146_create_business_tables.sql';
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📖 Read migration file successfully');
    console.log('📊 Migration file size:', migrationSQL.length, 'characters');
    
    // Split into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📋 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`🔄 Executing statement ${i + 1}/${statements.length}...`);
        
        try {
          // Use the REST API to execute SQL
          const response = await fetch('http://127.0.0.1:54321/rest/v1/rpc/exec', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz`,
              'apikey': 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'
            },
            body: JSON.stringify({ sql: statement })
          });
          
          if (response.ok) {
            console.log(`✅ Statement ${i + 1} executed successfully`);
          } else {
            const errorText = await response.text();
            console.log(`⚠️  Statement ${i + 1} result:`, errorText.substring(0, 100));
          }
        } catch (error) {
          console.log(`⚠️  Statement ${i + 1} error:`, error.message);
        }
      }
    }
    
    console.log('\n🎉 Migration execution complete!');
    console.log('📊 You can now run the sync commands:');
    console.log('   npm run sync-ships');
    console.log('   npm run sync-cabin');
    console.log('   npm run sync-reservations');

  } catch (error) {
    console.error('❌ Error executing migration:', error);
    console.log('\n📝 Manual steps:');
    console.log('1. Open Supabase Studio: http://127.0.0.1:54323');
    console.log('2. Go to SQL Editor');
    console.log('3. Copy and paste the migration SQL');
    console.log('4. Execute the SQL');
  }
}

createTablesFromMigration();
