/**
 * Durable ingest of warehouse synthetic group-OF rows from dwh.Fact_Reservation.
 *
 * RES_HEADER remains point-in-time truth for named bookings.
 * Fact_Reservation supplies dummy Res_ID = GroupID + AllocationID (source issue).
 * Local rows stamped source_origin = fact_group_alloc (never counted as Booked).
 */

import sql from 'mssql';

const SOURCE_ORIGIN = 'fact_group_alloc';
const PAGE_SIZE = 2000;
const UPSERT_BATCH = 50;

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

export function mapFactGroupOfRow(row) {
  const resId = toNumber(row.Res_ID);
  if (resId == null) return null;
  return {
    res_id: resId,
    res_status: row.Res_Status || 'OF',
    source_code: row.Source_Code || null,
    res_probability: toNumber(row.Res_Probability),
    group_probability: toNumber(row.Group_Probability),
    group_id: toNumber(row.Group_ID),
    source_origin: SOURCE_ORIGIN,
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

function isSyntheticId(row) {
  const gid = String(row.group_id || '');
  const rid = String(row.res_id || '');
  return Boolean(gid && rid.startsWith(gid) && rid.length >= gid.length + 4);
}

/**
 * Replace fact_group_alloc rows in sail window, then upsert from Synapse Fact_Reservation.
 *
 * @param {{ supabaseClient: any, synapseConfig: object, dateFrom: string, dateTo: string, logger?: any, pool?: any }} args
 */
export async function syncFactGroupOfReservations({
  supabaseClient,
  synapseConfig,
  dateFrom,
  dateTo,
  logger = null,
  pool: existingPool = null,
}) {
  if (!dateFrom || !dateTo) {
    throw new Error('syncFactGroupOfReservations requires dateFrom and dateTo');
  }

  const log = (...args) => (logger ? logger.info(...args) : console.log(...args));
  const ownPool = !existingPool;
  const pool = existingPool || await sql.connect(synapseConfig);

  try {
    const { error: delErr, count: deleted } = await supabaseClient
      .from('reservation')
      .delete({ count: 'exact' })
      .eq('source_origin', SOURCE_ORIGIN)
      .gte('sail_from_date', dateFrom)
      .lte('sail_from_date', dateTo);
    if (delErr) throw new Error(`Failed clearing fact_group_alloc: ${delErr.message}`);
    log(`Cleared fact_group_alloc in ${dateFrom}→${dateTo}: ${deleted ?? 0}`);

    let lastResId = 0;
    let inserted = 0;

    for (;;) {
      const result = await pool.request().query(`
        SELECT TOP (${PAGE_SIZE})
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
          AND Sail_From_Date >= '${dateFrom}'
          AND Sail_From_Date < DATEADD(day, 1, CAST('${dateTo}' AS date))
          AND TRY_CAST(Res_ID AS BIGINT) > ${lastResId}
          AND CAST(Res_ID AS VARCHAR(40)) LIKE CAST(Group_ID AS VARCHAR(20)) + '%'
          AND LEN(CAST(Res_ID AS VARCHAR(40))) >= LEN(CAST(Group_ID AS VARCHAR(20))) + 4
        ORDER BY TRY_CAST(Res_ID AS BIGINT)
      `);

      const raw = result.recordset || [];
      const rows = raw
        .map(mapFactGroupOfRow)
        .filter((row) => row && isSyntheticId(row));

      if (!rows.length) {
        if (!raw.length) break;
        lastResId = toNumber(raw[raw.length - 1]?.Res_ID) || lastResId;
        continue;
      }

      lastResId = toNumber(raw[raw.length - 1]?.Res_ID) || lastResId;

      for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
        const batch = rows.slice(i, i + UPSERT_BATCH);
        const { error } = await supabaseClient
          .from('reservation')
          .upsert(batch, { onConflict: 'res_id' });
        if (error) throw new Error(`fact_group_alloc upsert failed: ${error.message}`);
        inserted += batch.length;
      }

      log(`fact_group_alloc after Res_ID ${lastResId}: +${rows.length} (running ${inserted})`);
      if (raw.length < PAGE_SIZE) break;
    }

    log(`Upserted ${inserted} fact_group_alloc OF rows`);

    // Mirror into reservation_current_state so Reservation / Agency can inspect synthetic IDs.
    if (inserted > 0) {
      let mirrored = 0;
      let lastId = 0;
      for (;;) {
        const { data, error } = await supabaseClient
          .from('reservation')
          .select('res_id, sail_code, agency_id, group_id, guest_count, pax_type, sail_from_date, res_status, source_origin')
          .eq('source_origin', SOURCE_ORIGIN)
          .gte('sail_from_date', dateFrom)
          .lte('sail_from_date', dateTo)
          .gt('res_id', lastId)
          .order('res_id', { ascending: true })
          .limit(500);
        if (error) {
          log(`⚠️  Could not load fact_group_alloc for current_state mirror: ${error.message}`);
          break;
        }
        if (!data?.length) break;
        const snapshotDate = new Date().toISOString().slice(0, 10);
        const states = data.map((row) => ({
          res_id: row.res_id,
          snapshot_date: snapshotDate,
          sail_code: row.sail_code,
          agency_id: row.agency_id,
          group_id: row.group_id,
          guest_count: row.guest_count,
          pax_type: row.pax_type,
        }));
        const { error: upErr } = await supabaseClient
          .from('reservation_current_state')
          .upsert(states, { onConflict: 'res_id' });
        if (upErr) {
          log(`⚠️  current_state mirror failed: ${upErr.message}`);
          break;
        }
        mirrored += states.length;
        lastId = data[data.length - 1].res_id;
        if (data.length < 500) break;
      }
      log(`Mirrored ${mirrored} fact_group_alloc rows into reservation_current_state`);
    }

    return { inserted, deleted: deleted ?? 0 };
  } finally {
    if (ownPool && pool) {
      try {
        await pool.close();
      } catch {
        // ignore
      }
    }
  }
}

export const FACT_GROUP_ALLOC_ORIGIN = SOURCE_ORIGIN;
