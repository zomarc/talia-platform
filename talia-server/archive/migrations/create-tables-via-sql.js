#!/usr/bin/env node

/**
 * Create all business tables using raw SQL execution
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Supabase configuration
const supabaseConfig = {
  url: process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
};

// Initialize Supabase client
const supabase = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey);

async function createTables() {
  console.log('🏗️  Creating all business tables...\n');
  
  try {
    // Read the SQL file
    const sqlContent = fs.readFileSync('create_corrected_business_tables.sql', 'utf8');
    
    // Split the SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📋 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`📝 Executing statement ${i + 1}/${statements.length}...`);
        
        try {
          // Use rpc to execute raw SQL
          const { data, error } = await supabase.rpc('exec_sql', { 
            sql: statement + ';' 
          });
          
          if (error) {
            console.log(`⚠️  Statement ${i + 1} result:`, error.message);
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`);
          }
        } catch (e) {
          console.log(`❌ Statement ${i + 1} error:`, e.message);
        }
      }
    }
    
    console.log('\n🎉 Table creation completed!');
    console.log('📊 All business tables should now exist');
    console.log('🔗 Supabase Dashboard: http://127.0.0.1:54321/');
    
  } catch (error) {
    console.error('❌ Error creating tables:', error);
  }
}

// Run the table creation
createTables().catch(console.error);


