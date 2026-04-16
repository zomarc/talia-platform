#!/usr/bin/env node

// CLI for Talia Data Sync Service
// Provides easy command-line interface for syncing data from Synapse to Supabase

import { synapseSyncService, isSynapseSyncDisabled } from './src/services/synapse-sync.js';

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

/** First positional argv token that matches a configured dataset name (skips --flags). */
function resolveDatasetFromArgv(argv) {
  const datasetNames = new Set(synapseSyncService.listDatasets().map((d) => d.name));
  for (const token of argv.slice(4)) {
    if (token.startsWith('--')) continue;
    if (token.includes('=')) continue;
    if (datasetNames.has(token)) return token;
  }
  return resolveDataset(undefined);
}

function parseCliDateRange(argv) {
  let from;
  let to;
  for (const a of argv) {
    if (a.startsWith('--date-from=')) from = a.slice('--date-from='.length);
    if (a.startsWith('--date-to=')) to = a.slice('--date-to='.length);
  }
  if (from && to) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) {
      throw new Error('Invalid --date-from / --date-to (expected YYYY-MM-DD).');
    }
    if (from > to) {
      throw new Error('--date-from must be on or before --date-to.');
    }
    return { from, to };
  }
  if (from || to) {
    throw new Error('Provide both --date-from=YYYY-MM-DD and --date-to=YYYY-MM-DD, or neither.');
  }
  return null;
}

async function buildSyncTableOverrides(argv) {
  const forceFullSync = argv.includes('--force-full-sync');
  let dateRangeOverride = parseCliDateRange(argv);

  if (!dateRangeOverride && argv.includes('--use-active-date-range')) {
    const { configService } = await import('./src/services/config-service.js');
    const active = await configService.getActiveDateRange('synapse_default');
    if (active?.date_from && active?.date_to) {
      dateRangeOverride = { from: active.date_from, to: active.date_to };
      console.log(
        `📅 Using active integration date range (synapse_default): ${dateRangeOverride.from} → ${dateRangeOverride.to}`
      );
    } else {
      console.warn(
        '⚠️  --use-active-date-range set but no active integration_date_range found; using dataset / env defaults.'
      );
    }
  }

  return {
    forceFullSync,
    ...(dateRangeOverride ? { dateRangeOverride } : {})
  };
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
  node sync-cli.js sync-table publishedRates --use-active-date-range --force-full-sync
  node sync-cli.js sync-dataset sept-dec-2025
  node sync-cli.js status
  node sync-cli.js test-connection sept-dec-2025

  sync-table flags (after table / dataset):
    --force-full-sync           Ignore last_processed snapshot (full republish for derived tables)
    --use-active-date-range     Use integration_date_range synapse_default (same as GraphQL syncTable)
    --date-from=YYYY-MM-DD      Explicit window (requires --date-to=); overrides integration range
    --date-to=YYYY-MM-DD
    Dataset name is optional; if omitted, flags can follow the table name immediately.

  Env: SYNC_DATE_RANGE_FROM + SYNC_DATE_RANGE_TO still override everything if both are set.

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
        if (isSynapseSyncDisabled()) {
          console.error('❌ Synapse sync is disabled (TALIA_SYNAPSE_SYNC_DISABLED). Unset it or set to 0 to run sync.');
          process.exit(1);
        }
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
        if (isSynapseSyncDisabled()) {
          console.error('❌ Synapse sync is disabled (TALIA_SYNAPSE_SYNC_DISABLED). Unset it or set to 0 to run sync.');
          process.exit(1);
        }
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
        if (isSynapseSyncDisabled()) {
          console.error('❌ Synapse sync is disabled (TALIA_SYNAPSE_SYNC_DISABLED). Unset it or set to 0 to run sync.');
          process.exit(1);
        }
        if (!arg1) {
          console.error('❌ Please specify table name: node sync-cli.js sync-table ships');
          console.log('\nAvailable tables:');
          listTables();
          process.exit(1);
        }

        try {
          const dataset = resolveDatasetFromArgv(process.argv);
          const overrides = await buildSyncTableOverrides(process.argv);
          const parts = [`dataset: ${dataset}`];
          if (overrides.forceFullSync) parts.push('full sync');
          if (overrides.dateRangeOverride) {
            parts.push(`date ${overrides.dateRangeOverride.from} → ${overrides.dateRangeOverride.to}`);
          }
          console.log(`🔄 Syncing table: ${arg1} (${parts.join(', ')})`);

          // Note: Terminal scripts work independently - concurrency is handled by sync service
          const tableResult = await synapseSyncService.syncTable(arg1, dataset, overrides);

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
