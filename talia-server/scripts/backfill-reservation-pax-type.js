#!/usr/bin/env node
/**
 * Backfill reservation.pax_type / pax_status from dwh.Fact_Reservation.
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

async function loadLocalResIdsMissingPaxType() {
  const ids = [];
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('reservation')
      .select('res_id, pax_type')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      if (row.res_id == null) continue;
      if (row.pax_type == null || String(row.pax_type).trim() === '') {
        ids.push(Number(row.res_id));
      }
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return [...new Set(ids.filter(Number.isFinite))];
}

async function main() {
  if (!synapseConfig.server) throw new Error('AZURE_SYNAPSE_SERVER not configured');
  const ids = await loadLocalResIdsMissingPaxType();
  console.log(`Reservations missing pax_type: ${ids.length}`);
  if (!ids.length) {
    console.log('Nothing to backfill.');
    return;
  }
  const pool = await sql.connect(synapseConfig);
  let updated = 0;
  const chunkSize = 1500;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const result = await pool.request().query(`
      SELECT Res_ID, Pax_Type, Pax_Status
      FROM dwh.Fact_Reservation
      WHERE Res_ID IN (${chunk.join(',')})
    `);
    const rows = result.recordset || [];
    for (let j = 0; j < rows.length; j += 200) {
      const batch = rows.slice(j, j + 200);
      await Promise.all(
        batch.map(async (row) => {
          const paxType = row.Pax_Type != null ? String(row.Pax_Type).trim() : null;
          const paxStatus = row.Pax_Status != null ? String(row.Pax_Status).trim() : null;
          if (!paxType && !paxStatus) return;
          const payload = {};
          if (paxType) payload.pax_type = paxType;
          if (paxStatus) payload.pax_status = paxStatus;
          const { error } = await supabase
            .from('reservation')
            .update(payload)
            .eq('res_id', row.Res_ID);
          if (error) throw error;
          updated += 1;
        })
      );
    }
    console.log(
      `Chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(ids.length / chunkSize)}: `
      + `fetched ${rows.length}, updated ${updated}`
    );
  }
  await pool.close();
  console.log(`Done. Updated ${updated} reservations with pax_type/status.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
