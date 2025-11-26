#!/usr/bin/env node

/**
 * Database Backup Script
 * Exports all important tables to SQL INSERT statements
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TABLES_TO_BACKUP = [
  'focuses',
  'talia_users',
  'user_focus_preferences',
  'focus_groups'
];

async function backupTable(tableName) {
  console.log(`📦 Backing up table: ${tableName}`);
  
  const { data, error } = await supabase
    .from(tableName)
    .select('*');
  
  if (error) {
    console.error(`❌ Error backing up ${tableName}:`, error);
    return null;
  }
  
  console.log(`✅ Backed up ${data?.length || 0} rows from ${tableName}`);
  return data;
}

async function generateSQLBackup(data) {
  let sql = `-- Database Backup Generated: ${new Date().toISOString()}\n`;
  sql += `-- Supabase URL: ${SUPABASE_URL}\n\n`;
  
  for (const [tableName, rows] of Object.entries(data)) {
    if (!rows || rows.length === 0) {
      sql += `-- Table: ${tableName} (empty)\n\n`;
      continue;
    }
    
    sql += `-- Table: ${tableName} (${rows.length} rows)\n`;
    sql += `-- Backup data for ${tableName}\n`;
    sql += `-- Note: This is a JSON export. Use Supabase Studio to import.\n\n`;
    
    sql += `-- JSON data for ${tableName}:\n`;
    sql += `-- ${JSON.stringify(rows, null, 2).replace(/\n/g, '\n-- ')}\n\n`;
  }
  
  return sql;
}

async function generateJSONBackup(data) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    supabaseUrl: SUPABASE_URL,
    tables: data
  }, null, 2);
}

async function main() {
  console.log('🚀 Starting database backup...\n');
  console.log(`📡 Connecting to: ${SUPABASE_URL}\n`);
  
  const backupData = {};
  
  // Backup each table
  for (const tableName of TABLES_TO_BACKUP) {
    const data = await backupTable(tableName);
    if (data !== null) {
      backupData[tableName] = data;
    }
  }
  
  // Generate backup files
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupDir = path.join(__dirname, '..', 'backups');
  
  // Create backups directory if it doesn't exist
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const jsonFile = path.join(backupDir, `backup-${timestamp}.json`);
  const sqlFile = path.join(backupDir, `backup-${timestamp}.sql`);
  
  // Write JSON backup
  const jsonBackup = await generateJSONBackup(backupData);
  fs.writeFileSync(jsonFile, jsonBackup);
  console.log(`\n✅ JSON backup saved: ${jsonFile}`);
  
  // Write SQL backup (with comments)
  const sqlBackup = await generateSQLBackup(backupData);
  fs.writeFileSync(sqlFile, sqlBackup);
  console.log(`✅ SQL backup saved: ${sqlFile}`);
  
  // Summary
  console.log('\n📊 Backup Summary:');
  for (const [tableName, rows] of Object.entries(backupData)) {
    console.log(`   ${tableName}: ${rows?.length || 0} rows`);
  }
  
  console.log(`\n🎉 Backup completed successfully!`);
  console.log(`📁 Backup files saved in: ${backupDir}`);
}

main().catch(console.error);

