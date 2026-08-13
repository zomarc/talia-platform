#!/usr/bin/env node
/**
 * CLI wrapper: upsert Fact_Reservation group-OF explode rows into local reservation.
 * Prefer running via reservation sync (post RES_HEADER hook). This script remains for ad-hoc backfill.
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { syncFactGroupOfReservations } from '../src/services/fact-group-of-sync.js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz',
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const synapseConfig = {
  server: process.env.AZURE_SYNAPSE_SERVER,
  port: parseInt(process.env.AZURE_SYNAPSE_PORT || '1433', 10),
  database: process.env.AZURE_SYNAPSE_DATABASE,
  user: process.env.AZURE_SYNAPSE_USERNAME,
  password: process.env.AZURE_SYNAPSE_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, enableArithAbort: true },
};

const DATE_FROM = process.env.FACT_OF_DATE_FROM || '2025-09-01';
const DATE_TO = process.env.FACT_OF_DATE_TO || '2026-12-31';

async function main() {
  if (!synapseConfig.server) throw new Error('AZURE_SYNAPSE_SERVER not configured');
  console.log(`Fact group-OF upsert ${DATE_FROM} → ${DATE_TO}`);
  const result = await syncFactGroupOfReservations({
    supabaseClient: supabase,
    synapseConfig,
    dateFrom: DATE_FROM,
    dateTo: DATE_TO,
  });
  console.log(`Done. Upserted ${result.inserted} fact_group_alloc OF rows.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
