#!/usr/bin/env node
/**
 * Upsert Fact_Reservation group-OF explode rows into local reservation.
 *
 * Warehouse pattern: GROUP_ID in OF → join allocation → dummy Res_ID
 * (GroupID+AllocationID) → stamp Group_Probability on each cabin row.
 *
 * source_origin = fact_group_alloc (never counted as current BK).
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

const DATE_FROM = process.env.FACT_OF_DATE_FROM || '2025-09-01';
const DATE_TO = process.env.FACT_OF_DATE_TO || '2026-12-31';

function toNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toDateOnly(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function mapFactRow(row) {
  const resId = toNumber(row.Res_ID);
  if (resId == null) return null;
  return {
    res_id: resId,
    res_status: row.Res_Status || 'OF',
    source_code: row.Source_Code || null,
    res_probability: toNumber(row.Res_Probability),
    group_probability: toNumber(row.Group_Probability),
    group_id: toNumber(row.Group_ID),
    source_origin: 'fact_group_alloc',
    pax_type: row.Pax_Type || 'G',
    pax_status: row.Pax_Status || null,
    ship: row.Ship || null,
    sail_code: row.Sail_code || null,
    sail_duration: toNumber(row.Sail_Duration),
    sail_from_date: toDateOnly(row.Sail_From_Date),
    sail_to_date: toDateOnly(row.Sail_To_Date),
    agency_id: toNumber(row.Agency_ID),
    sec_agency_id: toNumber(row.Sec_Agency_ID),
    agency_channel: row.Agency_Channel || null,
    agency_country_code: row.Agency_Country_Code || null,
    agency_market: row.Agency_Market || null,
    cabin_type: row.Cabin_Type || null,
    cabin_category: row.Cabin_Category || null,
    guest_count: toNumber(row.Guest_Count),
    foc_guest_count: toNumber(row.FOC_Guest_Count),
    currency: row.Currency || null,
    currency_rate: toNumber(row.Currency_Rate),
    gross_ticket_revenue: toNumber(row.GrossTicketRevenue),
    net_ticket_revenue: toNumber(row.NetTicketRevenue),
    net_invoice_revenue: toNumber(row.NetInvoiceRevenue),
    gross_ticket_revenue_eur: toNumber(row.GrossTicketRevenueEUR),
    net_ticket_revenue_eur: toNumber(row.NetTicketRevenueEUR),
    net_invoice_revenue_eur: toNumber(row.NetInvoiceRevenueEUR),
    total_discounts_eur: toNumber(row.TotalDiscountsEUR),
    res_init_date: toDateOnly(row.Res_Init_Date),
  };
}

async function main() {
  if (!synapseConfig.server) throw new Error('AZURE_SYNAPSE_SERVER not configured');

  console.log(`Fact group-OF upsert ${DATE_FROM} → ${DATE_TO}`);
  const pool = await sql.connect(synapseConfig);

  // Delete prior fact_group_alloc in window so re-runs stay idempotent.
  const { error: delErr, count: deleted } = await supabase
    .from('reservation')
    .delete({ count: 'exact' })
    .eq('source_origin', 'fact_group_alloc')
    .gte('sail_from_date', DATE_FROM)
    .lte('sail_from_date', DATE_TO);
  if (delErr) throw delErr;
  console.log(`Cleared existing fact_group_alloc in window: ${deleted ?? 0}`);

  let lastResId = 0;
  const pageSize = 2000;
  let inserted = 0;
  for (;;) {
    const result = await pool.request().query(`
      SELECT TOP (${pageSize})
        Res_ID, Res_Status, Source_Code, Res_Probability, Group_Probability, Group_ID,
        Pax_Type, Pax_Status, Ship, Sail_code, Sail_Duration, Sail_From_Date, Sail_To_Date,
        Agency_ID, Sec_Agency_ID, Agency_Channel, Agency_Country_Code, Agency_Market,
        Cabin_Type, Cabin_Category, Guest_Count, FOC_Guest_Count, Currency, Currency_Rate,
        GrossTicketRevenue, NetTicketRevenue, NetInvoiceRevenue,
        GrossTicketRevenueEUR, NetTicketRevenueEUR, NetInvoiceRevenueEUR, TotalDiscountsEUR,
        Res_Init_Date
      FROM dwh.Fact_Reservation
      WHERE Res_Status = 'OF'
        AND Group_ID IS NOT NULL
        AND Sail_From_Date >= '${DATE_FROM}'
        AND Sail_From_Date < DATEADD(day, 1, CAST('${DATE_TO}' AS date))
        AND TRY_CAST(Res_ID AS BIGINT) > ${lastResId}
        -- Dummy Res_ID = GroupID + AllocationID (allocation suffix at least 4 digits)
        AND CAST(Res_ID AS VARCHAR(40)) LIKE CAST(Group_ID AS VARCHAR(20)) + '%'
        AND LEN(CAST(Res_ID AS VARCHAR(40))) >= LEN(CAST(Group_ID AS VARCHAR(20))) + 4
      ORDER BY TRY_CAST(Res_ID AS BIGINT)
    `);
    const raw = result.recordset || [];
    const rows = raw
      .map(mapFactRow)
      .filter((row) => {
        if (!row) return false;
        const gid = String(row.group_id || '');
        const rid = String(row.res_id || '');
        return gid && rid.startsWith(gid) && rid.length >= gid.length + 4;
      });
    if (!rows.length) {
      if (!raw.length) break;
      lastResId = toNumber(raw[raw.length - 1]?.Res_ID) || lastResId;
      continue;
    }
    lastResId = toNumber(raw[raw.length - 1]?.Res_Id ?? raw[raw.length - 1]?.Res_ID) || lastResId;

    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const { error } = await supabase.from('reservation').upsert(batch, { onConflict: 'res_id' });
      if (error) {
        console.error('Upsert error at batch', i, error);
        throw error;
      }
      inserted += batch.length;
    }

    console.log(`After Res_ID ${lastResId}: fetched ${rows.length}, upserted running ${inserted}`);
    if (raw.length < pageSize) break;
  }

  await pool.close();
  console.log(`Done. Upserted ${inserted} fact_group_alloc OF rows.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
