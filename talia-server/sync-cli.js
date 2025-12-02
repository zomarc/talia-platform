#!/usr/bin/env node

// CLI for Talia Data Sync Service
// Provides easy command-line interface for syncing data from Synapse to Supabase

import { synapseSyncService } from './src/services/synapse-sync.js';

const command = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv[4];

function resolveDataset(explicitDataset) {
  const dataset = explicitDataset || synapseSyncService.getDefaultDataset();
  if (!dataset) {
    throw new Error('No dataset specified and no default dataset defined in sync.config.json');
  }
  return dataset;
}

// Helper function to display help
function showHelp() {
  console.log(`
🔄 Talia Data Sync CLI

USAGE:
  node sync-cli.js <command> [options]

COMMANDS:
  sync-all [dataset]           Sync every table defined for the dataset (defaults to config default)
  sync-dataset <dataset>       Sync the named dataset
  sync-table <name> [dataset]  Sync a specific table for the dataset
  status                       Check sync status for all tables
  test-connection [dataset]    Test connection to Azure Synapse (uses dataset filters)
  list-tables                  List configured tables
  list-datasets                List configured datasets
  help                         Show this help message

EXAMPLES:
  node sync-cli.js sync-all
  node sync-cli.js sync-all sept-dec-2025
  node sync-cli.js sync-table reservations sept-dec-2025
  node sync-cli.js sync-dataset sept-dec-2025
  node sync-cli.js status
  node sync-cli.js test-connection sept-dec-2025

🔒 SECURITY: ONE-WAY SYNC ONLY (Synapse → Supabase)
    `);
}

// Helper function to display table list
function listTables() {
  console.log('📋 Configured Tables:');
  const tables = synapseSyncService.listConfiguredTables();
  tables.forEach(table => {
    console.log(`  • ${table.name}: ${table.description}`);
    console.log(`    Source: ${table.sourceTable} → Target: ${table.targetTable}`);
    console.log(`    Type: ${table.type}`);
    console.log('');
  });
}

function listDatasets() {
  console.log('📚 Available Datasets:');
  const datasets = synapseSyncService.listDatasets();
  datasets.forEach(dataset => {
    const marker = dataset.isDefault ? ' (default)' : '';
    console.log(`  • ${dataset.name}${marker}`);
    console.log(`    ${dataset.description}`);
    console.log(`    Tables: ${dataset.tables.join(', ')}`);
    console.log('');
  });
}

// Main CLI logic
async function main() {
  console.log('🔄 Talia Data Sync CLI');
  console.log('=====================\n');

  try {
    switch (command) {
      case 'sync-all': {
        try {
          const dataset = resolveDataset(arg1);
          console.log(`🚀 Starting full data sync for dataset "${dataset}"...`);
          const result = await synapseSyncService.syncDataset(dataset);
          if (result.success) {
            console.log('\n🎉 Full dataset sync completed successfully!');
            process.exit(0);
          }
          console.log('\n⚠️  Sync completed with some failures. Check results above.');
          process.exit(1);
        } catch (error) {
          console.error(`❌ ${error.message}`);
          process.exit(1);
        }
        break;
      }

      case 'sync-dataset':
        if (!arg1) {
          console.error('❌ Please specify dataset name: node sync-cli.js sync-dataset sept-dec-2025');
          listDatasets();
          process.exit(1);
        }

        console.log(`🚀 Starting dataset sync for "${arg1}"...`);
        {
          const result = await synapseSyncService.syncDataset(arg1);
          if (result.success) {
            console.log('\n🎉 Dataset sync completed successfully!');
            process.exit(0);
          }

          console.log('\n⚠️  Dataset sync completed with some failures. Check results above.');
          process.exit(1);
        }
        break;

      case 'sync-table':
        if (!arg1) {
          console.error('❌ Please specify table name: node sync-cli.js sync-table ships');
          console.log('\nAvailable tables:');
          listTables();
          process.exit(1);
        }

        try {
          const dataset = resolveDataset(arg2);
          // Check for --force-full-sync flag
          const forceFullSync = process.argv.includes('--force-full-sync');
          
          console.log(`🔄 Syncing table: ${arg1} (dataset: ${dataset}${forceFullSync ? ', full sync' : ''})`);
          
          // Note: Terminal scripts work independently - concurrency is handled by sync service
          const tableResult = await synapseSyncService.syncTable(arg1, dataset, { forceFullSync });

          if (tableResult.success) {
            const changesMsg = tableResult.changesDetected !== undefined 
              ? `, detected ${tableResult.changesDetected} changes`
              : '';
            console.log(`\n✅ Table sync completed: ${tableResult.message}${changesMsg}`);
            process.exit(0);
          }

          console.log(`\n❌ Table sync failed: ${tableResult.error}`);
          if (tableResult.detailedLogs && tableResult.detailedLogs.length > 0) {
            console.log('\n📋 Detailed logs:');
            tableResult.detailedLogs.forEach(log => console.log(`   ${log}`));
          }
          process.exit(1);
        } catch (error) {
          console.error(`❌ ${error.message}`);
          if (error.stack) {
            console.error(`\nStack trace:\n${error.stack}`);
          }
          process.exit(1);
        }
        break;

      case 'status':
        console.log('📊 Checking sync status...\n');
        {
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
        }
        break;

      case 'test-connection':
        console.log('🔍 Testing Azure Synapse connection...\n');
        {
          const connected = await synapseSyncService.testConnection();

          if (connected) {
            console.log('\n✅ Connection test successful!');
            console.log('🧪 Testing individual table queries...\n');

            const dataset = resolveDataset(arg1);
            const tables = synapseSyncService.listConfiguredTables();
            for (const table of tables) {
              try {
                const result = await synapseSyncService.testTableQuery(table.name, dataset);
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
        }
        break;

      case 'list-tables':
        listTables();
        break;

      case 'list-datasets':
        listDatasets();
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
