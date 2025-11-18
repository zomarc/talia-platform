#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { createRequire } from 'module';

import { syncReservationChanges } from '../src/services/reservation-changes-sync.js';

const require = createRequire(import.meta.url);
const syncConfig = require('../sync.config.json');

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const AZURE_SYNAPSE_CONFIG = {
  server: process.env.AZURE_SYNAPSE_SERVER,
  port: parseInt(process.env.AZURE_SYNAPSE_PORT || '1433'),
  database: process.env.AZURE_SYNAPSE_DATABASE,
  user: process.env.AZURE_SYNAPSE_USERNAME,
  password: process.env.AZURE_SYNAPSE_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
    requestTimeout: 300000
  }
};

async function ensureTableExists() {
  const { error } = await supabaseClient.from('reservation_changes').select('id').limit(1);
  if (error && error.code === '42P01') {
    throw new Error('Supabase table reservation_changes does not exist. Apply migrations before running this script.');
  }
  if (error) {
    throw new Error(`Unable to query reservation_changes: ${error.message}`);
  }
}

function resolveDatasetConfig(datasetName) {
  const dataset = syncConfig.datasets?.[datasetName];
  if (!dataset) {
    throw new Error(`Unknown dataset "${datasetName}". Update sync.config.json or specify a valid dataset.`);
  }

  const tableBase = syncConfig.tables?.reservationChanges;
  if (!tableBase) {
    throw new Error('reservationChanges table is not defined in sync.config.json');
  }

  const tableOverrides = dataset.tables?.reservationChanges;
  if (!tableOverrides) {
    throw new Error(`Dataset "${datasetName}" does not define reservationChanges overrides.`);
  }

  const replace = tableOverrides.replace || {};
  const filters = tableOverrides.filters || [];

  const filterRange = filters.find(filter => filter.operator === 'between');
  const dateRange = {
    from: replace.from || filterRange?.from,
    to: replace.to || filterRange?.to
  };

  if (!dateRange.from || !dateRange.to) {
    throw new Error(`Dataset "${datasetName}" must supply from/to values for reservationChanges date range.`);
  }

  return {
    base: tableBase,
    overrides: tableOverrides,
    dateRange,
    supabaseDateColumn: replace.column || tableBase.supabaseDateColumn
  };
}

async function main() {
  const datasetName = process.argv[2] || syncConfig.defaultDataset;
  console.log(`🚀 Synchronising reservation_changes using dataset "${datasetName}"...`);

  try {
    await ensureTableExists();
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }

  let datasetConfig;
  try {
    datasetConfig = resolveDatasetConfig(datasetName);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }

  try {
    const result = await syncReservationChanges({
      synapseConfig: AZURE_SYNAPSE_CONFIG,
      supabaseClient,
      source: datasetConfig.base.source,
      columns: datasetConfig.base.columns,
      dateColumn: datasetConfig.base.dateColumn,
      supabaseDateColumn: datasetConfig.supabaseDateColumn,
      dateRange: datasetConfig.dateRange,
      targetTable: datasetConfig.base.target,
      rowNumberOrder: datasetConfig.base.rowNumberOrder
    });

    console.log(`\n🎉 Reservation change sync complete: ${result.message}`);
  } catch (error) {
    console.error(`❌ Reservation change sync failed: ${error.message}`);
    process.exit(1);
  }
}

main();
