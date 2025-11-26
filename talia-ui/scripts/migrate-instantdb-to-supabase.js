/**
 * Migration Script: InstantDB → Supabase
 * 
 * Migrates data from InstantDB to Supabase:
 * 1. taliaUser → talia_users (user mappings)
 * 2. focus → focuses (focus definitions)
 * 3. userFocusPreference → user_focus_preferences (user preferences)
 * 
 * Usage:
 *   node scripts/migrate-instantdb-to-supabase.js
 * 
 * Prerequisites:
 *   - @instantdb/react package installed (npm install @instantdb/react)
 *   - InstantDB app accessible
 *   - Supabase running locally or accessible
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to import InstantDB (may not be installed)
let db = null;
let instantDbAvailable = false;
let instantConfig = null;

try {
  const { init } = await import('@instantdb/react');
  instantDbAvailable = true;
  
  // Load InstantDB config
  const instantConfigPath = join(__dirname, '../instant.config.json');
  instantConfig = JSON.parse(readFileSync(instantConfigPath, 'utf-8'));
  
  // Initialize InstantDB client
  db = init({
    appId: instantConfig.id
  });
  
  console.log('✅ InstantDB client initialized');
} catch (error) {
  console.log('⚠️  InstantDB not available:', error.message);
  console.log('   Install with: npm install @instantdb/react');
  console.log('   Or use manual migration method (see docs/INSTANTDB-MIGRATION-GUIDE.md)');
}

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

/**
 * Migrate taliaUser mappings to talia_users table
 */
async function migrateTaliaUsers() {
  console.log('\n📋 Migrating taliaUser mappings...');
  
  if (!instantDbAvailable || !db) {
    console.log('   ⚠️  InstantDB not available - skipping taliaUser migration');
    console.log('   ℹ️  Users will be auto-created on first Supabase sign-in');
    return;
  }
  
  try {
    // Check if adminAPI is available
    if (!db.adminAPI) {
      console.log('   ⚠️  adminAPI not available - InstantDB React client may not support backend queries');
      console.log('   ℹ️  Try exporting data manually from InstantDB dashboard or use InstantDB CLI');
      return;
    }
    
    // Query InstantDB for all taliaUser entities using admin API
    const result = await db.adminAPI.query({
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
        // Check if user already exists in Supabase by email or talia_user_id
        const { data: existingByEmail } = await supabase
          .from('talia_users')
          .select('*')
          .eq('talia_user_id', instantUser.taliaUserId)
          .single();
        
        if (existingByEmail) {
          console.log(`   ⏭️  Skipping taliaUserId ${instantUser.taliaUserId} (already exists)`);
          stats.taliaUsers.skipped++;
          continue;
        }
        
        // Note: We can't create a talia_users record without a Supabase auth.users.id
        // This migration assumes the user will need to sign in with Supabase auth first
        // We'll store the mapping information for manual reconciliation
        
        console.log(`   ⚠️  taliaUserId ${instantUser.taliaUserId} needs Supabase auth.users.id`);
        console.log(`      InstantDB auth ID: ${instantUser.instantAuthId}`);
        console.log(`      Talia User ID: ${instantUser.taliaUserId}`);
        
        // Store migration info for manual reconciliation
        // In a real scenario, you'd need to match emails between InstantDB auth and Supabase auth
        stats.taliaUsers.skipped++;
        
      } catch (error) {
        console.error(`   ❌ Error migrating taliaUser ${instantUser.taliaUserId}:`, error.message);
        stats.taliaUsers.errors++;
      }
    }
    
  } catch (error) {
    console.error('❌ Error querying InstantDB for taliaUser:', error);
    console.error('   This might mean InstantDB is not connected or has no data');
  }
}

/**
 * Migrate focus definitions to focuses table
 */
async function migrateFocuses() {
  console.log('\n📋 Migrating focus definitions...');
  
  if (!instantDbAvailable || !db) {
    console.log('   ⚠️  InstantDB not available - skipping focus migration');
    console.log('   ℹ️  Focuses can be created manually or via GraphQL');
    return;
  }
  
  try {
    // Check if adminAPI is available
    if (!db.adminAPI) {
      console.log('   ⚠️  adminAPI not available - InstantDB React client may not support backend queries');
      console.log('   ℹ️  Try exporting data manually from InstantDB dashboard or use InstantDB CLI');
      return;
    }
    
    // Query InstantDB for all focus entities using admin API
    const result = await db.adminAPI.query({
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
        // Check if focus already exists by name
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
        
        // Map InstantDB focus to Supabase format
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
          created_by: null, // Will need to map taliaUserId to Supabase user UUID
          layout_data: instantFocus.layoutData || {},
          created_at: instantFocus.createdAt ? new Date(instantFocus.createdAt).toISOString() : new Date().toISOString(),
          updated_at: instantFocus.updatedAt ? new Date(instantFocus.updatedAt).toISOString() : new Date().toISOString()
        };
        
        // Insert into Supabase
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
        
        // Store mapping for user preferences migration
        instantFocus._supabaseId = inserted.id;
        
      } catch (error) {
        console.error(`   ❌ Error migrating focus "${instantFocus.name}":`, error.message);
        stats.focuses.errors++;
      }
    }
    
  } catch (error) {
    console.error('❌ Error querying InstantDB for focus:', error);
    console.error('   This might mean InstantDB is not connected or has no data');
  }
}

/**
 * Migrate user focus preferences to user_focus_preferences table
 */
async function migrateUserFocusPreferences() {
  console.log('\n📋 Migrating user focus preferences...');
  
  if (!instantDbAvailable || !db) {
    console.log('   ⚠️  InstantDB not available - skipping preferences migration');
    console.log('   ℹ️  Preferences will be recreated as users interact with focuses');
    return;
  }
  
  try {
    // Check if adminAPI is available
    if (!db.adminAPI) {
      console.log('   ⚠️  adminAPI not available - InstantDB React client may not support backend queries');
      console.log('   ℹ️  Try exporting data manually from InstantDB dashboard or use InstantDB CLI');
      return;
    }
    
    // Query InstantDB for all userFocusPreference entities using admin API
    const result = await db.adminAPI.query({
      userFocusPreference: {}
    });
    
    const instantPreferences = result?.data?.userFocusPreference || [];
    stats.userFocusPreferences.found = instantPreferences.length;
    
    if (instantPreferences.length === 0) {
      console.log('   ℹ️  No user focus preferences found in InstantDB');
      return;
    }
    
    console.log(`   Found ${instantPreferences.length} user focus preferences`);
    
    for (const instantPref of instantPreferences) {
      try {
        // Find Supabase user by talia_user_id
        const { data: taliaUser } = await supabase
          .from('talia_users')
          .select('id')
          .eq('talia_user_id', instantPref.taliaUserId)
          .single();
        
        if (!taliaUser) {
          console.log(`   ⚠️  Skipping preference: taliaUserId ${instantPref.taliaUserId} not found in Supabase`);
          stats.userFocusPreferences.skipped++;
          continue;
        }
        
        // Find Supabase focus by name (since we migrated focuses above)
        // Note: This assumes focus names are unique
        const { data: focus } = await supabase
          .from('focuses')
          .select('id')
          .eq('name', instantPref.focusId) // Assuming focusId in InstantDB is the focus name
          .single();
        
        if (!focus) {
          console.log(`   ⚠️  Skipping preference: focus "${instantPref.focusId}" not found in Supabase`);
          stats.userFocusPreferences.skipped++;
          continue;
        }
        
        // Check if preference already exists
        const { data: existing } = await supabase
          .from('user_focus_preferences')
          .select('*')
          .eq('user_id', taliaUser.id)
          .eq('focus_id', focus.id)
          .single();
        
        if (existing) {
          console.log(`   ⏭️  Skipping preference (already exists)`);
          stats.userFocusPreferences.skipped++;
          continue;
        }
        
        // Insert preference
        const { data: inserted, error } = await supabase
          .from('user_focus_preferences')
          .insert({
            user_id: taliaUser.id,
            focus_id: focus.id,
            is_favorite: instantPref.isFavorite || false,
            last_used: instantPref.lastUsed ? new Date(instantPref.lastUsed).toISOString() : null,
            custom_layout: instantPref.customLayout || null
          })
          .select()
          .single();
        
        if (error) {
          throw error;
        }
        
        console.log(`   ✅ Migrated preference for user ${instantPref.taliaUserId}`);
        stats.userFocusPreferences.migrated++;
        
      } catch (error) {
        console.error(`   ❌ Error migrating preference:`, error.message);
        stats.userFocusPreferences.errors++;
      }
    }
    
  } catch (error) {
    console.error('❌ Error querying InstantDB for userFocusPreference:', error);
    console.error('   This might mean InstantDB is not connected or has no data');
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
  
  if (instantDbAvailable && instantConfig) {
    console.log(`InstantDB App ID: ${instantConfig.id}`);
  } else {
    console.log('InstantDB: Not available (see docs/INSTANTDB-MIGRATION-GUIDE.md for manual migration)');
  }
  
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log('='.repeat(60));
  
  try {
    // Migrate in order: users first, then focuses, then preferences
    await migrateTaliaUsers();
    await migrateFocuses();
    await migrateUserFocusPreferences();
    
    printSummary();
    
    console.log('\n✅ Migration complete!');
    console.log('\n⚠️  Note: taliaUser mappings require Supabase auth.users.id');
    console.log('   Users will need to sign in with Supabase auth to complete migration');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate().catch(console.error);

