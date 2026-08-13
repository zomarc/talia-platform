/**
 * Sync Monday snapshots from dwh.Fact_Reservation_History into sail_booking_monday.
 *
 * Densifies Booked / Contracted / Estimated guests per sail_code × WC_Snapshot_Date (Monday).
 * Does not use fou.Fact_Reservation_daily.
 */

import sql from 'mssql';

const BOOKED_STATUSES = new Set(['BK', 'BOOKED', 'BKD']);
const PAGE_SIZE = 5000;
const UPSERT_BATCH = 200;

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

function probabilityFactor(row) {
  const group = toNumber(row.Group_Probability ?? row.group_probability);
  const res = toNumber(row.Res_Probability ?? row.res_probability);
  const raw = group != null ? group : res;
  if (raw == null) return 1;
  if (raw > 1) return Math.max(0, Math.min(1, raw / 100));
  return Math.max(0, Math.min(1, raw));
}

function isSyntheticGroupOf(row) {
  const origin = String(row.source_origin || row.Source_Origin || '').trim();
  if (origin === 'fact_group_alloc') return true;
  const groupId = row.Group_ID ?? row.group_id;
  const resId = row.Res_ID ?? row.res_id;
  if (groupId == null || resId == null) return false;
  const gid = String(groupId).trim();
  const rid = String(resId).trim();
  if (!/^\d+$/.test(gid) || !/^\d+$/.test(rid)) return false;
  if (!rid.startsWith(gid) || rid.length < gid.length + 4) return false;
  const status = String(row.Res_Status || row.res_status || '').trim().toUpperCase();
  return status === 'OF' || status === 'OPTION' || status === 'QT' || status === 'QUOTE';
}

function isBooked(row) {
  const status = String(row.Res_Status || row.res_status || '').trim().toUpperCase();
  if (!BOOKED_STATUSES.has(status)) return false;
  return !isSyntheticGroupOf(row);
}

function isContractedDemand(row) {
  if (isSyntheticGroupOf(row)) return true;
  const status = String(row.Res_Status || row.res_status || '').trim().toUpperCase();
  const pax = String(row.Pax_Type || row.pax_type || '').trim().toUpperCase();
  if (pax.startsWith('G')) return true;
  if (['OF', 'OPTION', 'QT', 'QUOTE', 'WL', 'WAITLIST', 'WAIT'].includes(status)) return true;
  return false;
}

function classifyGuests(row) {
  const guests = toNumber(row.Guest_Count ?? row.guest_count) || 0;
  if (guests <= 0) return { booked: 0, contracted: 0, estimated: 0 };
  const booked = isBooked(row) ? guests : 0;
  if (!isContractedDemand(row)) {
    return { booked, contracted: 0, estimated: 0 };
  }
  const factor = probabilityFactor(row);
  return {
    booked,
    contracted: guests,
    estimated: guests * factor,
  };
}

/**
 * @param {{ synapseConfig: object, supabaseClient: any, dateFrom: string, dateTo: string, logger?: any, pool?: any }} args
 */
export async function syncFactReservationHistoryMondays({
  synapseConfig,
  supabaseClient,
  dateFrom,
  dateTo,
  logger = null,
  pool: existingPool = null,
}) {
  if (!dateFrom || !dateTo) {
    throw new Error('syncFactReservationHistoryMondays requires dateFrom and dateTo');
  }

  const log = (...args) => (logger ? logger.info(...args) : console.log(...args));
  const ownPool = !existingPool;
  const pool = existingPool || await sql.connect(synapseConfig);

  try {
    // Clear densified rows whose Monday falls in the sail window lookback
    // (snapshot Mondays that touch sailings in date range).
    const { error: delErr } = await supabaseClient
      .from('sail_booking_monday')
      .delete()
      .gte('snapshot_date', dateFrom)
      .lte('snapshot_date', dateTo);
    if (delErr) {
      throw new Error(`Failed clearing sail_booking_monday: ${delErr.message}`);
    }

    const aggregates = new Map(); // key sail|monday -> totals
    let lastMonday = '1900-01-01';
    let lastResId = 0;
    let fetched = 0;

    for (;;) {
      // Keyset on WC_Snapshot_Date + Res_ID within sail window.
      const result = await pool.request().query(`
        SELECT TOP (${PAGE_SIZE})
          frh.WC_Snapshot_Date,
          frh.Res_ID,
          frh.Res_Status,
          frh.Group_ID,
          frh.Sail_code,
          frh.Guest_Count,
          frh.Res_Probability,
          frh.Group_Probability,
          frh.Sail_From_Date
        FROM dwh.Fact_Reservation_History frh
        WHERE frh.Sail_From_Date >= '${dateFrom}'
          AND frh.Sail_From_Date < DATEADD(day, 1, CAST('${dateTo}' AS date))
          AND frh.WC_Snapshot_Date IS NOT NULL
          AND frh.Sail_code IS NOT NULL
          AND (
            CAST(frh.WC_Snapshot_Date AS date) > CAST('${lastMonday}' AS date)
            OR (
              CAST(frh.WC_Snapshot_Date AS date) = CAST('${lastMonday}' AS date)
              AND TRY_CAST(frh.Res_ID AS BIGINT) > ${lastResId}
            )
          )
        ORDER BY frh.WC_Snapshot_Date, TRY_CAST(frh.Res_ID AS BIGINT)
      `);

      const raw = result.recordset || [];
      if (!raw.length) break;
      fetched += raw.length;

      for (const row of raw) {
        const sailCode = String(row.Sail_code || '').trim();
        const monday = toDateOnly(row.WC_Snapshot_Date);
        if (!sailCode || !monday) continue;
        const parts = classifyGuests(row);
        const key = `${sailCode}|${monday}`;
        const cur = aggregates.get(key) || {
          sail_code: sailCode,
          snapshot_date: monday,
          booked_guests: 0,
          contracted_guests: 0,
          estimated_guests: 0,
        };
        cur.booked_guests += parts.booked;
        cur.contracted_guests += parts.contracted;
        cur.estimated_guests += parts.estimated;
        aggregates.set(key, cur);
      }

      const last = raw[raw.length - 1];
      lastMonday = toDateOnly(last.WC_Snapshot_Date) || lastMonday;
      lastResId = toNumber(last.Res_ID) || lastResId;
      log(`Fact_Reservation_History page: ${fetched.toLocaleString()} rows, ${aggregates.size} sail×Monday keys`);
      if (raw.length < PAGE_SIZE) break;
    }

    const rows = [...aggregates.values()].map((row) => ({
      sail_code: row.sail_code,
      snapshot_date: row.snapshot_date,
      booked_guests: Math.round(row.booked_guests * 100) / 100,
      contracted_guests: Math.round(row.contracted_guests * 100) / 100,
      estimated_guests: Math.round(row.estimated_guests * 100) / 100,
    }));

    let upserted = 0;
    for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
      const batch = rows.slice(i, i + UPSERT_BATCH);
      const { error } = await supabaseClient
        .from('sail_booking_monday')
        .upsert(batch, { onConflict: 'sail_code,snapshot_date' });
      if (error) throw new Error(`sail_booking_monday upsert failed: ${error.message}`);
      upserted += batch.length;
    }

    log(`Densified ${upserted} sail_booking_monday rows from Fact_Reservation_History`);
    return { fetched, upserted };
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

/**
 * Load Monday series for sail codes (already densified locally).
 */
export async function loadSailBookingMondaySeries(client, sailCodes = []) {
  if (!sailCodes?.length) return [];
  const all = [];
  for (let i = 0; i < sailCodes.length; i += 50) {
    const batch = sailCodes.slice(i, i + 50);
    const { data, error } = await client
      .from('sail_booking_monday')
      .select('sail_code, snapshot_date, booked_guests, contracted_guests, estimated_guests')
      .in('sail_code', batch)
      .order('snapshot_date', { ascending: true });
    if (error) {
      console.warn('[sail_booking_monday]', error.message);
      return all;
    }
    if (data?.length) all.push(...data);
  }
  return all;
}

export { classifyGuests as classifyFactHistoryGuests };
