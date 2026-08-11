#!/usr/bin/env node
/**
 * Backfill reservation res_probability + group_probability from dwh.Fact_Reservation.
 * RES_HEADER PROBABILITY is often stuck at 100; Fact has real OF/Group probabilities.
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

function toNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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
  let below100 = 0;
  const chunkSize = 1500;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const result = await pool.request().query(`
      SELECT Res_ID, Res_Probability, Group_Probability
      FROM dwh.Fact_Reservation
      WHERE Res_ID IN (${chunk.join(',')})
    `);

    const updates = [];
    for (const row of result.recordset || []) {
      const resId = Number(row.Res_ID);
      if (!Number.isFinite(resId)) continue;
      const resProb = toNumber(row.Res_Probability);
      const groupProb = toNumber(row.Group_Probability);
      if (resProb == null && groupProb == null) continue;
      if ((resProb != null && resProb < 100) || (groupProb != null && groupProb < 100)) {
        below100 += 1;
      }
      updates.push({
        res_id: resId,
        res_probability: resProb,
        group_probability: groupProb,
      });
    }

    // Parallel row updates in small batches (PostgREST has no bulk patch by key).
    const parallel = 40;
    for (let j = 0; j < updates.length; j += parallel) {
      const slice = updates.slice(j, j + parallel);
      await Promise.all(slice.map(async (patch) => {
        const body = {};
        if (patch.res_probability != null) body.res_probability = patch.res_probability;
        if (patch.group_probability != null) body.group_probability = patch.group_probability;
        const { error } = await supabase.from('reservation').update(body).eq('res_id', patch.res_id);
        if (error) throw error;
      }));
      updated += slice.length;
    }

    console.log(
      `Chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(ids.length / chunkSize)}: `
      + `updated ${updated}, below100 ${below100}`
    );
  }
  await pool.close();
  console.log(`Done. Updated ${updated} rows; ${below100} with probability < 100.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
