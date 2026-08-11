#!/usr/bin/env node
/**
 * Backfill reservation.res_init_date / original_init_date from stg.RES_HEADER
 * for res_ids already present in local Supabase.
 */
import dotenv from 'dotenv';
import sql from 'mssql';
import { createClient } from '@supabase/supabase-js';

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

function toDateOnly(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

async function loadLocalResIds() {
  const ids = [];
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('reservation')
      .select('res_id')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      if (row.res_id != null) ids.push(Number(row.res_id));
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return [...new Set(ids.filter(Number.isFinite))];
}

async function main() {
  if (!synapseConfig.server) {
    throw new Error('AZURE_SYNAPSE_SERVER not configured');
  }
  const ids = await loadLocalResIds();
  console.log(`Local reservations: ${ids.length}`);
  const pool = await sql.connect(synapseConfig);
  let updated = 0;
  const chunkSize = 1500;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const result = await pool.request().query(`
      SELECT RES_ID, RES_INIT_DATE, ORIGINAL_INIT_DATE
      FROM stg.RES_HEADER
      WHERE RES_ID IN (${chunk.join(',')})
    `);
    const rows = result.recordset || [];
    for (let j = 0; j < rows.length; j += 200) {
      const batch = rows.slice(j, j + 200);
      await Promise.all(
        batch.map(async (row) => {
          const payload = {
            res_init_date: toDateOnly(row.RES_INIT_DATE),
            original_init_date: toDateOnly(row.ORIGINAL_INIT_DATE),
          };
          if (!payload.res_init_date && !payload.original_init_date) return;
          const { error } = await supabase
            .from('reservation')
            .update(payload)
            .eq('res_id', row.RES_ID);
          if (error) throw error;
          updated += 1;
        })
      );
    }
    console.log(`Chunk ${Math.floor(i / chunkSize) + 1}: fetched ${rows.length}, updated running ${updated}`);
  }
  await pool.close();
  console.log(`Done. Updated ${updated} reservations with init dates.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
