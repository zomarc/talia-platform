/**
 * Migration Script: InstantDB → Supabase (with Authentication)
 * 
 * This script attempts to authenticate with InstantDB and then query data.
 * Run this script and follow the authentication prompts.
 */

import { init } from '@instantdb/react';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load InstantDB config
const instantConfigPath = join(__dirname, '../instant.config.json');
const instantConfig = JSON.parse(readFileSync(instantConfigPath, 'utf-8'));

// Initialize InstantDB client
const db = init({ appId: instantConfig.id });

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Migration statistics
const stats = {
  taliaUsers: { found: 0, migrated: 0, skipped: 0, errors: 0 },
  focuses: { found: 0, migrated: 0, skipped: 0, errors: 0 },
  userFocusPreferences: { found: 0, migrated: 0, skipped: 0, errors: 0 }
};

// Helper to get user input
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

/**
 * Try to query InstantDB without authentication first
 */
async function testInstantDBAccess() {
  console.log('\n🔍 Testing InstantDB access...');
  try {
    // Try a simple query to see if we can access data
    const result = await db.queryOnce({
      focus: {}
    });
    console.log('✅ InstantDB accessible without authentication');
    return true;
  } catch (error) {
    if (error.message.includes('auth') || error.message.includes('permission') || error.message.includes('queryOnce')) {
      console.log('⚠️  InstantDB requires authentication or backend API');
      return false;
    }
    // Other errors might mean no data or connection issue
    console.log('⚠️  InstantDB query failed:', error.message);
    return false;
  }
}

/**
 * Authenticate with InstantDB
 */
async function authenticateInstantDB() {
  console.log('\n🔐 InstantDB Authentication Required');
  console.log('='.repeat(60));
  console.log('To access InstantDB data, you need to authenticate.');
  console.log('Options:');
  console.log('1. Magic code (email)');
  console.log('2. Skip authentication (may fail if data requires auth)');
  
  const choice = await askQuestion('\nEnter choice (1 or 2): ');
  
  if (choice === '1') {
    const email = await askQuestion('Enter your email: ');
    console.log(`\n📧 Sending magic code to ${email}...`);
    
    try {
      await db.auth.sendMagicCode({ email });
      const code = await askQuestion('Enter the magic code you received: ');
      
      console.log('🔑 Signing in...');
      await db.auth.signInWithMagicCode({ email, code });
      console.log('✅ Authenticated successfully!\n');
      return true;
    } catch (error) {
      console.error('❌ Authentication failed:', error.message);
      return false;
    }
  }
  
  return false;
}

/**
 * Migrate taliaUser mappings
 */
async function migrateTaliaUsers() {
  console.log('\n📋 Migrating taliaUser mappings...');
  
  try {
    const result = await db.queryOnce({
      taliaUser: {}
    });
    
    const instantUsers = result?.data?.taliaUser || [];
    stats.taliaUsers.found = instantUsers.length;
    
    if (instantUsers.length === 0) {
      console.log('   ℹ️  No taliaUser mappings found in InstantDB');
      return;
    }
    
    console.log(`   Found ${instantUsers.length} taliaUser mappings`);
    
    for (const instantUser of instantUsers) {
      try {
        const { data: existing } = await supabase
          .from('talia_users')
          .select('*')
          .eq('talia_user_id', instantUser.taliaUserId)
          .single();
        
        if (existing) {
          console.log(`   ⏭️  Skipping taliaUserId ${instantUser.taliaUserId} (already exists)`);
          stats.taliaUsers.skipped++;
          continue;
        }
        
        console.log(`   ⚠️  taliaUserId ${instantUser.taliaUserId} needs Supabase auth.users.id`);
        console.log(`      InstantDB auth ID: ${instantUser.instantAuthId}`);
        stats.taliaUsers.skipped++;
        
      } catch (error) {
        console.error(`   ❌ Error migrating taliaUser ${instantUser.taliaUserId}:`, error.message);
        stats.taliaUsers.errors++;
      }
    }
    
  } catch (error) {
    console.error('❌ Error querying InstantDB for taliaUser:', error.message);
    if (error.message.includes('auth') || error.message.includes('permission')) {
      console.error('   ⚠️  This might require authentication. Try running with authentication.');
    }
  }
}

/**
 * Migrate focus definitions
 */
async function migrateFocuses() {
  console.log('\n📋 Migrating focus definitions...');
  
  try {
    const result = await db.queryOnce({
      focus: {}
    });
    
    const instantFocuses = result?.data?.focus || [];
    stats.focuses.found = instantFocuses.length;
    
    if (instantFocuses.length === 0) {
      console.log('   ℹ️  No focus definitions found in InstantDB');
      return;
    }
    
    console.log(`   Found ${instantFocuses.length} focus definitions`);
    
    for (const instantFocus of instantFocuses) {
      try {
        const { data: existing } = await supabase
          .from('focuses')
          .select('*')
          .eq('name', instantFocus.name)
          .single();
        
        if (existing) {
          console.log(`   ⏭️  Skipping focus "${instantFocus.name}" (already exists)`);
          stats.focuses.skipped++;
          continue;
        }
        
        const supabaseFocus = {
          name: instantFocus.name,
          description: instantFocus.description || null,
          type: instantFocus.type || 'user',
          is_standard: instantFocus.isStandard || false,
          assigned_roles: Array.isArray(instantFocus.assignedRoles) 
            ? instantFocus.assignedRoles 
            : (instantFocus.assignedRoles ? [instantFocus.assignedRoles] : []),
          is_default: instantFocus.isDefault || false,
          is_active: instantFocus.isActive !== undefined ? instantFocus.isActive : true,
          created_by: null,
          layout_data: instantFocus.layoutData || {},
          created_at: instantFocus.createdAt ? new Date(instantFocus.createdAt).toISOString() : new Date().toISOString(),
          updated_at: instantFocus.updatedAt ? new Date(instantFocus.updatedAt).toISOString() : new Date().toISOString()
        };
        
        const { data: inserted, error } = await supabase
          .from('focuses')
          .insert(supabaseFocus)
          .select()
          .single();
        
        if (error) {
          throw error;
        }
        
        console.log(`   ✅ Migrated focus "${instantFocus.name}" (ID: ${inserted.id})`);
        stats.focuses.migrated++;
        
        instantFocus._supabaseId = inserted.id;
        
      } catch (error) {
        console.error(`   ❌ Error migrating focus "${instantFocus.name}":`, error.message);
        stats.focuses.errors++;
      }
    }
    
  } catch (error) {
    console.error('❌ Error querying InstantDB for focus:', error.message);
    if (error.message.includes('auth') || error.message.includes('permission')) {
      console.error('   ⚠️  This might require authentication. Try running with authentication.');
    }
  }
}

/**
 * Migrate user focus preferences
 */
async function migrateUserFocusPreferences() {
  console.log('\n📋 Migrating user focus preferences...');
  
  try {
    const result = await db.queryOnce({
      userFocusPreference: {}
    });
    
    const instantPreferences = result?.data?.userFocusPreference || [];
    stats.userFocusPreferences.found = instantPreferences.length;
    
    if (instantPreferences.length === 0) {
      console.log('   ℹ️  No user focus preferences found in InstantDB');
      return;
    }
    
    console.log(`   Found ${instantPreferences.length} user focus preferences`);
    console.log('   ⚠️  Preferences require user and focus UUIDs - will need manual mapping');
    
  } catch (error) {
    console.error('❌ Error querying InstantDB for userFocusPreference:', error.message);
    if (error.message.includes('auth') || error.message.includes('permission')) {
      console.error('   ⚠️  This might require authentication. Try running with authentication.');
    }
  }
}

/**
 * Print migration summary
 */
function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary');
  console.log('='.repeat(60));
  
  console.log('\n📋 taliaUser Mappings:');
  console.log(`   Found: ${stats.taliaUsers.found}`);
  console.log(`   Migrated: ${stats.taliaUsers.migrated}`);
  console.log(`   Skipped: ${stats.taliaUsers.skipped}`);
  console.log(`   Errors: ${stats.taliaUsers.errors}`);
  
  console.log('\n🎯 Focus Definitions:');
  console.log(`   Found: ${stats.focuses.found}`);
  console.log(`   Migrated: ${stats.focuses.migrated}`);
  console.log(`   Skipped: ${stats.focuses.skipped}`);
  console.log(`   Errors: ${stats.focuses.errors}`);
  
  console.log('\n⭐ User Focus Preferences:');
  console.log(`   Found: ${stats.userFocusPreferences.found}`);
  console.log(`   Migrated: ${stats.userFocusPreferences.migrated}`);
  console.log(`   Skipped: ${stats.userFocusPreferences.skipped}`);
  console.log(`   Errors: ${stats.userFocusPreferences.errors}`);
  
  const totalFound = stats.taliaUsers.found + stats.focuses.found + stats.userFocusPreferences.found;
  const totalMigrated = stats.taliaUsers.migrated + stats.focuses.migrated + stats.userFocusPreferences.migrated;
  
  console.log('\n' + '-'.repeat(60));
  console.log(`Total Found: ${totalFound}`);
  console.log(`Total Migrated: ${totalMigrated}`);
  console.log('='.repeat(60));
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('🚀 Starting InstantDB → Supabase Migration');
  console.log('='.repeat(60));
  console.log(`InstantDB App ID: ${instantConfig.id}`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log('='.repeat(60));
  
  // Test access first
  const canAccess = await testInstantDBAccess();
  
  if (!canAccess) {
    // Try authentication if needed
    const authenticated = await authenticateInstantDB();
    if (!authenticated) {
      console.log('\n⚠️  Proceeding without authentication (may fail if data requires auth)');
    }
  }
  
  try {
    await migrateTaliaUsers();
    await migrateFocuses();
    await migrateUserFocusPreferences();
    
    printSummary();
    
    console.log('\n✅ Migration complete!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate().catch(console.error);

