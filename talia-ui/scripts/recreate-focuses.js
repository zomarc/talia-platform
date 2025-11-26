/**
 * Script to recreate focus definitions in Supabase
 * 
 * This creates standard focus definitions that were likely in InstantDB
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Standard focus definitions to create
const standardFocuses = [
  {
    name: 'Dashboard',
    description: 'Main dashboard with key metrics and overview',
    type: 'standard',
    is_standard: true,
    assigned_roles: ['ADMIN', 'MANAGER', 'USER'],
    is_default: true,
    is_active: true,
    layout_data: {
      components: [],
      grid: { columns: 12, rows: 8 }
    }
  },
  {
    name: 'Performance',
    description: 'Performance metrics and KPIs',
    type: 'standard',
    is_standard: true,
    assigned_roles: ['ADMIN', 'MANAGER'],
    is_default: false,
    is_active: true,
    layout_data: {
      components: [],
      grid: { columns: 12, rows: 8 }
    }
  },
  {
    name: 'Sailings',
    description: 'Sailing overview and management',
    type: 'standard',
    is_standard: true,
    assigned_roles: ['ADMIN', 'MANAGER', 'USER'],
    is_default: false,
    is_active: true,
    layout_data: {
      components: [],
      grid: { columns: 12, rows: 8 }
    }
  },
  {
    name: 'Reservations',
    description: 'Reservation tracking and analysis',
    type: 'standard',
    is_standard: true,
    assigned_roles: ['ADMIN', 'MANAGER'],
    is_default: false,
    is_active: true,
    layout_data: {
      components: [],
      grid: { columns: 12, rows: 8 }
    }
  },
  {
    name: 'Analytics',
    description: 'Advanced analytics and reporting',
    type: 'standard',
    is_standard: true,
    assigned_roles: ['ADMIN'],
    is_default: false,
    is_active: true,
    layout_data: {
      components: [],
      grid: { columns: 12, rows: 8 }
    }
  }
];

async function recreateFocuses() {
  console.log('🚀 Recreating Focus Definitions in Supabase');
  console.log('='.repeat(60));
  
  const stats = {
    created: 0,
    skipped: 0,
    errors: 0
  };
  
  for (const focus of standardFocuses) {
    try {
      // Check if focus already exists
      const { data: existing } = await supabase
        .from('focuses')
        .select('*')
        .eq('name', focus.name)
        .single();
      
      if (existing) {
        console.log(`⏭️  Skipping "${focus.name}" (already exists)`);
        stats.skipped++;
        continue;
      }
      
      // Insert focus
      const { data: inserted, error } = await supabase
        .from('focuses')
        .insert({
          ...focus,
          created_by: null, // Will be set when user creates focuses
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      console.log(`✅ Created focus "${focus.name}" (ID: ${inserted.id})`);
      console.log(`   Type: ${focus.type}, Roles: ${focus.assigned_roles.join(', ')}`);
      stats.created++;
      
    } catch (error) {
      console.error(`❌ Error creating focus "${focus.name}":`, error.message);
      stats.errors++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary');
  console.log('='.repeat(60));
  console.log(`Created: ${stats.created}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
  console.log('='.repeat(60));
  
  // Show all focuses
  console.log('\n📋 All Focuses in Supabase:');
  const { data: allFocuses } = await supabase
    .from('focuses')
    .select('id, name, type, is_standard, assigned_roles, is_default, is_active')
    .order('name');
  
  if (allFocuses) {
    allFocuses.forEach(focus => {
      console.log(`  - ${focus.name} (${focus.type}) - Roles: ${focus.assigned_roles?.join(', ') || 'none'}`);
    });
  }
  
  console.log('\n✅ Focus recreation complete!');
}

// Run the script
recreateFocuses().catch(console.error);

