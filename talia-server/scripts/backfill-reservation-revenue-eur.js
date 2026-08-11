#!/usr/bin/env node
/**
 * Backfill reservation ticket revenue (EUR) from dwh.Fact_Reservation.
 *
 * Source of truth:
 *   - Current: dwh.Fact_Reservation
 *   - Weekly Monday history: dwh.Fact_Reservation_History (WC_Snapshot_Date)
 *   - Not used: fou.Fact_Reservation_daily (unreliable)
 *
 * RES_HEADER sync does not carry revenue; this fills local reservation columns
 * used by booking-curve Rev / pax (net_ticket_revenue_eur).
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
  let withEur = 0;
  const chunkSize = 1500;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const result = await pool.request().query(`
      SELECT
        Res_ID,
        Sail_code,
        Sail_Duration,
        GrossTicketRevenue,
        NetTicketRevenue,
        NetInvoiceRevenue,
        GrossTicketRevenueEUR,
        NetTicketRevenueEUR,
        NetInvoiceRevenueEUR,
        TotalDiscountsEUR
      FROM dwh.Fact_Reservation
      WHERE Res_ID IN (${chunk.join(',')})
    `);
    const rows = result.recordset || [];
    for (let j = 0; j < rows.length; j += 200) {
      const batch = rows.slice(j, j + 200);
      await Promise.all(
        batch.map(async (row) => {
          const netEur = toNumber(row.NetTicketRevenueEUR);
          const payload = {
            sail_code: row.Sail_code || undefined,
            sail_duration: toNumber(row.Sail_Duration) ?? undefined,
            gross_ticket_revenue: toNumber(row.GrossTicketRevenue),
            net_ticket_revenue: toNumber(row.NetTicketRevenue),
            net_invoice_revenue: toNumber(row.NetInvoiceRevenue),
            gross_ticket_revenue_eur: toNumber(row.GrossTicketRevenueEUR),
            net_ticket_revenue_eur: netEur,
            net_invoice_revenue_eur: toNumber(row.NetInvoiceRevenueEUR),
            total_discounts_eur: toNumber(row.TotalDiscountsEUR),
          };
          // Drop undefined so we don't wipe sail_code when missing on Fact side
          Object.keys(payload).forEach((key) => {
            if (payload[key] === undefined) delete payload[key];
          });
          if (!Object.keys(payload).length) return;
          const { error } = await supabase
            .from('reservation')
            .update(payload)
            .eq('res_id', row.Res_ID);
          if (error) throw error;
          updated += 1;
          if (netEur != null && netEur !== 0) withEur += 1;
        })
      );
    }
    console.log(
      `Chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(ids.length / chunkSize)}: `
      + `fetched ${rows.length}, updated ${updated}, with EUR ${withEur}`
    );
  }
  await pool.close();
  console.log(`Done. Updated ${updated} reservations (${withEur} with non-zero net_ticket_revenue_eur).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
