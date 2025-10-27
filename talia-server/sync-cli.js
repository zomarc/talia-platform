#!/usr/bin/env node

// CLI for Talia Data Sync Service
// Provides easy command-line interface for syncing data from Synapse to Supabase

import { synapseSyncService } from './src/services/synapse-sync.js';

const command = process.argv[2];
const tableName = process.argv[3];

// Helper function to display help
function showHelp() {
  console.log(`
🔄 Talia Data Sync CLI

USAGE:
  node sync-cli.js <command> [table-name]

COMMANDS:
  sync-all              Sync all configured tables (2025-2026 only)
  sync-table <name>     Sync specific table only
  status               Check sync status for all tables
  test-connection      Test connection to Azure Synapse
  list-tables          List all configured tables
  help                 Show this help message

EXAMPLES:
  node sync-cli.js sync-all
  node sync-cli.js sync-table ships
  node sync-cli.js sync-table cabinAvailability
  node sync-cli.js status
  node sync-cli.js test-connection

CONFIGURED TABLES:
  • ships (no date constraints)
  • cabinAvailability (2025-2026 only)
  • reservations (2025-2026 only)

🔒 SECURITY: ONE-WAY SYNC ONLY (Synapse → Supabase)
📊 DATA VOLUME: ~6.1M records total
⏱️  ESTIMATED TIME: 10-30 minutes for full sync
    `);
}

// Helper function to display table list
function listTables() {
  console.log('📋 Configured Tables:');
  const tables = synapseSyncService.listConfiguredTables();
  tables.forEach(table => {
    console.log(`  • ${table.name}: ${table.description}`);
    console.log(`    Source: ${table.sourceTable} → Target: ${table.targetTable}`);
    if (table.constraints.length > 0) {
      console.log(`    Constraints: ${table.constraints.join(', ')}`);
    }
    console.log('');
  });
}

// Main CLI logic
async function main() {
  console.log('🔄 Talia Data Sync CLI');
  console.log('=====================\n');

  try {
    switch (command) {
      case 'sync-all':
        console.log('🚀 Starting full data sync...');
        console.log('⚠️  This will sync ALL configured tables and may take 10-30 minutes');
        console.log('📊 Estimated data volume: ~6.1M records\n');
        
        const result = await synapseSyncService.syncAllTables();
        
        if (result.success) {
          console.log('\n🎉 Full sync completed successfully!');
          process.exit(0);
        } else {
          console.log('\n⚠️  Sync completed with some failures. Check results above.');
          process.exit(1);
        }
        break;

      case 'sync-table':
        if (!tableName) {
          console.error('❌ Please specify table name: node sync-cli.js sync-table ships');
          console.log('\nAvailable tables:');
          listTables();
          process.exit(1);
        }

        console.log(`🔄 Starting sync for table: ${tableName}`);
        const tableResult = await synapseSyncService.syncTable(tableName);
        
        if (tableResult.success) {
          console.log(`\n✅ Table sync completed: ${tableResult.message}`);
          process.exit(0);
        } else {
          console.log(`\n❌ Table sync failed: ${tableResult.error}`);
          process.exit(1);
        }
        break;

      case 'status':
        console.log('📊 Checking sync status...\n');
        const status = await synapseSyncService.getSyncStatus();
        
        console.log('📋 Sync Status:');
        Object.entries(status).forEach(([tableName, info]) => {
          const statusIcon = info.success ? '✅' : '❌';
          console.log(`  ${statusIcon} ${tableName}:`);
          console.log(`    Last Sync: ${info.lastSync}`);
          console.log(`    Records: ${info.recordCount?.toLocaleString() || 'Unknown'}`);
          if (info.error) {
            console.log(`    Error: ${info.error}`);
          }
          console.log('');
        });
        break;

      case 'test-connection':
        console.log('🔍 Testing Azure Synapse connection...\n');
        const connected = await synapseSyncService.testConnection();
        
        if (connected) {
          console.log('\n✅ Connection test successful!');
          console.log('🧪 Testing individual table queries...\n');
          
          const tables = synapseSyncService.listConfiguredTables();
          for (const table of tables) {
            try {
              const result = await synapseSyncService.testTableQuery(table.name);
              if (result.success) {
                console.log(`✅ ${table.name}: ${result.recordCount?.toLocaleString()} records`);
              } else {
                console.log(`❌ ${table.name}: ${result.error}`);
              }
            } catch (error) {
              console.log(`❌ ${table.name}: ${error.message}`);
            }
          }
        } else {
          console.log('\n❌ Connection test failed!');
          process.exit(1);
        }
        break;

      case 'list-tables':
        listTables();
        break;

      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;

      default:
        console.error(`❌ Unknown command: ${command || 'none'}`);
        console.log('\nUse "node sync-cli.js help" for available commands');
        process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ CLI Error:', error.message);
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Sync interrupted by user');
  console.log('💡 You can resume by running the same command again');
  process.exit(0);
});

// Run the CLI
main();
