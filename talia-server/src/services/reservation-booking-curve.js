/**
 * Reservation-only booking profile curve using original booked date.
 * MSE-aligned booked cabins / capacity from sail_by_cabin_occupancy (master sail).
 */

import { resolveVoyageScope } from './booking-profile-dimensional.js';
import { classifyPassengerType } from '../lib/paxType.js';

function clean(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function toDateKey(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromKey, toKey) {
  const a = new Date(`${fromKey}T00:00:00Z`);
  const b = new Date(`${toKey}T00:00:00Z`);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function normalizeMarketBreakdown(value) {
  return value === 'market' ? 'market' : 'market_group';
}

function normalizeSeriesMode(value) {
  if (value === 'pax_type' || value === 'channel') return value;
  return 'market';
}

const CHANNEL_ORDER = ['Agency', 'Direct', 'Tour Op', 'Other'];

function rollupAgencyTypeToChannel(agencyType) {
  const raw = String(agencyType || '').trim();
  if (!raw) return 'Other';
  const key = raw.toUpperCase();
  if (
    key.includes('TRAVEL AGENCY')
    || key.includes('HOSTED AGENT')
    || key.includes('ONLINE TRAVEL')
    || key === 'OTA'
    || key.includes('SUBAGENCY')
    || key.includes('MAIN AGENCY')
    || key.includes('CONSORTIUM')
  ) {
    return 'Agency';
  }
  if (key.includes('TOUR OPERATOR') || key === 'DMC' || key.includes('DMC')) {
    return 'Tour Op';
  }
  if (
    key.includes('CLST DIRECT')
    || key === 'DIRECT'
    || key === 'B2C'
    || key.includes('STAFF')
    || key.includes('COMPANY AGR')
  ) {
    return 'Direct';
  }
  return 'Other';
}

async function loadAgencyIndex(client) {
  const { data } = await client.from('agency').select('agency_id, market, agency_type');
  const index = new Map();
  (data || []).forEach((row) => {
    if (row.agency_id == null) return;
    index.set(String(row.agency_id), {
      market: clean(row.market) || 'UNKNOWN',
      agencyType: clean(row.agency_type),
      channel: rollupAgencyTypeToChannel(row.agency_type),
    });
  });
  return index;
}

async function loadMarketRollUpIndex(client) {
  const { data } = await client
    .from('market_roll_up')
    .select('agency_market, new_budget_roll_up, active_record_flag');
  const index = new Map();
  (data || []).forEach((row) => {
    if (row.active_record_flag != null && Number(row.active_record_flag) !== 1) return;
    const key = clean(row.agency_market)?.toUpperCase();
    if (!key || index.has(key)) return;
    index.set(key, clean(row.new_budget_roll_up) || key);
  });
  return index;
}

async function fetchScopedReservations(client, sailCodes) {
  if (!sailCodes?.length) return [];
  const all = [];
  for (let i = 0; i < sailCodes.length; i += 50) {
    const batch = sailCodes.slice(i, i + 50);
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await client
        .from('reservation')
        .select(
          'res_id, sail_code, agency_id, agency_market, guest_count, res_status, res_init_date, original_init_date, sail_from_date, sail_to_date, sail_duration, pax_type, net_ticket_revenue_eur, gross_ticket_revenue_eur, net_ticket_revenue, gross_ticket_revenue, net_selling_fare, gross_selling_fare, currency'
        )
        .in('sail_code', batch)
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (error) throw error;
      if (data?.length) {
        all.push(...data);
        hasMore = data.length === pageSize;
        page += 1;
      } else {
        hasMore = false;
      }
    }
  }
  return all;
}

async function loadGroupIdByResId(client, sailCodes) {
  const index = new Map();
  if (!sailCodes?.length) return index;
  for (let i = 0; i < sailCodes.length; i += 50) {
    const batch = sailCodes.slice(i, i + 50);
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await client
        .from('reservation_current_state')
        .select('res_id, group_id')
        .in('sail_code', batch)
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (error) {
        console.warn('[reservation-booking-curve] group_id:', error.message);
        return index;
      }
      if (data?.length) {
        data.forEach((row) => {
          if (row.res_id == null) return;
          const gid = clean(row.group_id);
          if (gid) index.set(String(row.res_id), gid);
        });
        hasMore = data.length === pageSize;
        page += 1;
      } else {
        hasMore = false;
      }
    }
  }
  return index;
}

/**
 * MSE formula: sum cabin categories per day on master sail_code only, then peak.
 */
async function loadMseCabinTotals(client, shipCode, masterSailCode) {
  if (!shipCode || !masterSailCode) {
    return { bookedCabins: null, totalCabins: null, source: null };
  }

  const { data, error } = await client
    .from('sail_by_cabin_occupancy')
    .select('occupied_cabins, total_cabins, sail_itinerary_date')
    .eq('ship_code', shipCode)
    .eq('sail_code', masterSailCode);

  if (error) {
    console.warn('[reservation-booking-curve] occupancy:', error.message);
    return { bookedCabins: null, totalCabins: null, source: null };
  }

  if (!data?.length) {
    return { bookedCabins: null, totalCabins: null, source: null };
  }

  const byDate = new Map();
  data.forEach((row) => {
    const dateKey = toDateKey(row.sail_itinerary_date) || '_';
    const cur = byDate.get(dateKey) || { occupied: 0, total: 0 };
    cur.occupied += Number(row.occupied_cabins) || 0;
    cur.total += Number(row.total_cabins) || 0;
    byDate.set(dateKey, cur);
  });

  let peakBooked = 0;
  let peakTotal = 0;
  byDate.forEach((day) => {
    peakBooked = Math.max(peakBooked, day.occupied);
    peakTotal = Math.max(peakTotal, day.total);
  });

  return {
    bookedCabins: Math.round(peakBooked),
    totalCabins: Math.round(peakTotal),
    source: 'sail_by_cabin_occupancy',
  };
}

function bookDateOf(res) {
  return toDateKey(res.original_init_date) || toDateKey(res.res_init_date);
}

function marketRawOf(res, agencyIndex) {
  const agency = agencyIndex.get(String(res.agency_id));
  return (
    clean(res.agency_market) ||
    agency?.market ||
    'UNKNOWN'
  );
}

function dimensionKeyOf(res, ctx) {
  const { seriesMode, marketBreakdown, agencyIndex, rollUpIndex, groupIdIndex } = ctx;
  if (seriesMode === 'pax_type') {
    return classifyPassengerType({
      pax_type: res.pax_type,
      group_id: groupIdIndex?.get(String(res.res_id)) || null,
    });
  }
  if (seriesMode === 'channel') {
    const agency = agencyIndex.get(String(res.agency_id));
    return agency?.channel || rollupAgencyTypeToChannel(null);
  }
  const market = marketRawOf(res, agencyIndex);
  if (marketBreakdown === 'market_group') {
    return rollUpIndex.get(market.toUpperCase()) || market;
  }
  return market;
}

/** Cap left edge so long-lead bookings do not create an unreadable axis. */
const MAX_WEEKS_AXIS = 52;

function buildAreaSeries(reservations, sailDateKey, dimCtx) {
  const byDimWeek = new Map();
  const dims = new Set();
  let maxWeeks = 0;
  let withBookDate = 0;

  reservations.forEach((res) => {
    const bookDate = bookDateOf(res);
    if (!bookDate || !sailDateKey) return;
    withBookDate += 1;
    const daysOut = daysBetween(bookDate, sailDateKey);
    const weeksUntil = Math.min(
      MAX_WEEKS_AXIS,
      Math.max(0, Math.ceil(daysOut / 7))
    );
    maxWeeks = Math.max(maxWeeks, weeksUntil);
    const key = dimensionKeyOf(res, dimCtx);
    dims.add(key);
    if (!byDimWeek.has(key)) byDimWeek.set(key, new Map());
    const weekMap = byDimWeek.get(key);
    const cell = weekMap.get(weeksUntil) || { bookings: 0, guests: 0 };
    cell.bookings += 1;
    cell.guests += Number(res.guest_count) || 0;
    weekMap.set(weeksUntil, cell);
  });

  const weekLabels = [];
  for (let w = maxWeeks; w >= 0; w -= 1) {
    weekLabels.push({
      weekLabel: w === 0 ? 'Sail' : `W-${w}`,
      weeksUntilSailing: w,
    });
  }

  if (!weekLabels.length || withBookDate === 0) {
    weekLabels.length = 0;
    weekLabels.push({ weekLabel: 'Sail', weeksUntilSailing: 0 });
    byDimWeek.clear();
    dims.clear();
    reservations.forEach((res) => {
      const key = dimensionKeyOf(res, dimCtx);
      dims.add(key);
      if (!byDimWeek.has(key)) byDimWeek.set(key, new Map());
      const weekMap = byDimWeek.get(key);
      const cell = weekMap.get(0) || { bookings: 0, guests: 0 };
      cell.bookings += 1;
      cell.guests += Number(res.guest_count) || 0;
      weekMap.set(0, cell);
    });
  }

  const sortKeys = (a, b) => {
    if (dimCtx.seriesMode === 'pax_type') {
      const order = { Group: 0, FIT: 1 };
      return (order[a] ?? 9) - (order[b] ?? 9) || a.localeCompare(b);
    }
    if (dimCtx.seriesMode === 'channel') {
      const ai = CHANNEL_ORDER.indexOf(a);
      const bi = CHANNEL_ORDER.indexOf(b);
      const ao = ai === -1 ? CHANNEL_ORDER.length : ai;
      const bo = bi === -1 ? CHANNEL_ORDER.length : bi;
      if (ao !== bo) return ao - bo;
      return a.localeCompare(b);
    }
    return a.localeCompare(b);
  };

  const series = [...dims].sort(sortKeys).map((key) => {
    const weekMap = byDimWeek.get(key) || new Map();
    const incremental = weekLabels.map(({ weeksUntilSailing }) => {
      const cell = weekMap.get(weeksUntilSailing) || { bookings: 0, guests: 0 };
      return { bookings: cell.bookings, guests: Math.round(cell.guests) };
    });
    const points = weekLabels.map((label, idx) => {
      let bookings = 0;
      let guests = 0;
      for (let j = 0; j <= idx; j += 1) {
        bookings += incremental[j].bookings;
        guests += incremental[j].guests;
      }
      return {
        weekLabel: label.weekLabel,
        weeksUntilSailing: label.weeksUntilSailing,
        bookings,
        guests,
      };
    });
    return { dimensionKey: key, points };
  });

  const totals = weekLabels.map((label, idx) => {
    let bookings = 0;
    let guests = 0;
    series.forEach((s) => {
      bookings += s.points[idx].bookings;
      guests += s.points[idx].guests;
    });
    return {
      weekLabel: label.weekLabel,
      weeksUntilSailing: label.weeksUntilSailing,
      bookings,
      guests,
    };
  });

  return { series, totals, maxWeeks, withBookDate };
}

function velocityWindows(reservations, asOfKey) {
  const windows = [
    { key: 'pastWeek', days: 7, label: '7d' },
    { key: 'pastTwoWeeks', days: 14, label: '14d' },
    { key: 'pastFourWeeks', days: 28, label: '28d' },
    { key: 'pastSixtyDays', days: 60, label: '60d' },
  ];
  const asOf = new Date(`${asOfKey}T00:00:00Z`);
  const result = {};
  windows.forEach(({ key, days, label }) => {
    const from = new Date(asOf);
    from.setUTCDate(from.getUTCDate() - days);
    const fromKey = from.toISOString().slice(0, 10);
    let bookings = 0;
    let guests = 0;
    reservations.forEach((res) => {
      const bookDate = bookDateOf(res);
      if (!bookDate) return;
      if (bookDate > asOfKey) return;
      if (bookDate >= fromKey && bookDate <= asOfKey) {
        bookings += 1;
        guests += Number(res.guest_count) || 0;
      }
    });
    result[key] = {
      label,
      days,
      bookings,
      guests: Math.round(guests),
      bookingsPerDay: round2(bookings / days),
      guestsPerDay: round2(guests / days),
    };
  });
  return result;
}

function buildRevenueSummary(reservations) {
  let totalNetEur = 0;
  let totalGrossEur = 0;
  let guestsWithRev = 0;
  let bookingsWithRev = 0;
  let totalGuests = 0;

  reservations.forEach((res) => {
    const guests = Number(res.guest_count) || 0;
    totalGuests += guests;
    const netEur = Number(res.net_ticket_revenue_eur);
    const grossEur = Number(res.gross_ticket_revenue_eur);
    const netLocal = Number(res.net_ticket_revenue);
    const grossLocal = Number(res.gross_ticket_revenue);
    const hasEur = Number.isFinite(netEur) && netEur !== 0;
    const hasGrossEur = Number.isFinite(grossEur) && grossEur !== 0;
    if (hasEur || hasGrossEur) {
      bookingsWithRev += 1;
      guestsWithRev += guests;
      if (hasEur) totalNetEur += netEur;
      if (hasGrossEur) totalGrossEur += grossEur;
    } else if (Number.isFinite(netLocal) && netLocal !== 0) {
      // Local currency fallback only counted in coverage note — not mixed into EUR totals
      bookingsWithRev += 1;
      guestsWithRev += guests;
    }
  });

  const revPerPaxEur =
    guestsWithRev > 0 && totalNetEur > 0
      ? round2(totalNetEur / guestsWithRev)
      : null;

  return {
    totalNetEur: round2(totalNetEur),
    totalGrossEur: round2(totalGrossEur),
    revPerPaxEur,
    bookingsWithRevenue: bookingsWithRev,
    guestsWithRevenue: Math.round(guestsWithRev),
    totalGuests: Math.round(totalGuests),
    coveragePct:
      reservations.length > 0
        ? round2((bookingsWithRev / reservations.length) * 100)
        : 0,
    currency: 'EUR',
    message:
      bookingsWithRev === 0
        ? 'No ticket revenue on reservations yet — enrich from dwh.Fact_Reservation (net_ticket_revenue_eur).'
        : null,
  };
}

async function loadOwnPublishedMinFare(client, sailCode, currency = 'EUR') {
  const { data, error } = await client
    .from('published_rates_current_state')
    .select('fare_per_person, currency_code, cabin_category')
    .eq('sail_code', sailCode)
    .eq('currency_code', currency)
    .limit(500);
  if (error || !data?.length) return null;
  let minFare = null;
  data.forEach((row) => {
    const fare = Number(row.fare_per_person);
    if (!Number.isFinite(fare) || fare <= 0) return;
    minFare = minFare == null ? fare : Math.min(minFare, fare);
  });
  return minFare == null ? null : round2(minFare);
}

async function loadCompetitorSummary(client, { sailDateKey, durationDays, currency = 'EUR' }) {
  if (!sailDateKey) return null;
  const sailDate = new Date(`${sailDateKey}T00:00:00Z`);
  const monthStart = new Date(Date.UTC(sailDate.getUTCFullYear(), sailDate.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(sailDate.getUTCFullYear(), sailDate.getUTCMonth() + 1, 0));
  const fromKey = monthStart.toISOString().slice(0, 10);
  const toKey = monthEnd.toISOString().slice(0, 10);

  let query = client
    .from('competitor_current_state')
    .select(
      'cruise_line, ship_name, departure_date, duration, currency, lowest_inside, lowest_outside, lowest_balcony, lowest_price'
    )
    .eq('currency', currency)
    .gte('departure_date', fromKey)
    .lte('departure_date', toKey)
    .limit(500);

  const { data, error } = await query;
  if (error) {
    console.warn('[reservation-booking-curve] competitor:', error.message);
    return null;
  }

  const duration = Number(durationDays) || null;
  const prices = [];
  (data || []).forEach((row) => {
    const line = String(row.cruise_line || '').toLowerCase();
    if (line.includes('celestyal')) return; // peers only
    const rowDur = Number(row.duration);
    if (duration && Number.isFinite(rowDur) && Math.abs(rowDur - duration) > 2) return;
    const price =
      Number(row.lowest_inside) ||
      Number(row.lowest_price) ||
      Number(row.lowest_outside) ||
      Number(row.lowest_balcony) ||
      0;
    if (price > 0) prices.push(price);
  });

  if (!prices.length) {
    return {
      currency,
      competitorCount: 0,
      competitorMedianPp: null,
      competitorMinPp: null,
      message: `No peer competitor prices in ${currency} for ${fromKey.slice(0, 7)}.`,
    };
  }

  prices.sort((a, b) => a - b);
  const mid = Math.floor(prices.length / 2);
  const median =
    prices.length % 2 === 0
      ? (prices[mid - 1] + prices[mid]) / 2
      : prices[mid];

  return {
    currency,
    competitorCount: prices.length,
    competitorMedianPp: round2(median),
    competitorMinPp: round2(prices[0]),
    departureMonth: fromKey.slice(0, 7),
    durationFilter: duration,
    message: null,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} sailCode
 * @param {{ marketBreakdown?: string, seriesMode?: string, includeCompetitor?: boolean }} [options]
 */
export async function getReservationBookingCurve(client, sailCode, options = {}) {
  const marketBreakdown = normalizeMarketBreakdown(options.marketBreakdown);
  const seriesMode = normalizeSeriesMode(options.seriesMode);
  const includeCompetitor = options.includeCompetitor === true;

  const scope = await resolveVoyageScope(client, sailCode);
  const sailDateKey = toDateKey(scope.sailDate);
  const masterSailCode = scope.referenceSailCode || scope.requestedSailCode;

  const [agencyIndex, rollUpIndex, reservations, mse, groupIdIndex] = await Promise.all([
    loadAgencyIndex(client),
    loadMarketRollUpIndex(client),
    fetchScopedReservations(client, scope.sailCodes),
    loadMseCabinTotals(client, scope.shipCode, masterSailCode),
    loadGroupIdByResId(client, scope.sailCodes),
  ]);

  const active = reservations.filter((r) => {
    const status = String(r.res_status || '').toUpperCase();
    return status !== 'CX' && status !== 'CANCELLED' && status !== 'CANCELED';
  });

  const dimCtx = {
    seriesMode,
    marketBreakdown,
    agencyIndex,
    rollUpIndex,
    groupIdIndex,
  };

  const { series, totals, maxWeeks, withBookDate } = buildAreaSeries(
    active,
    sailDateKey,
    dimCtx
  );

  const todayKey = toDateKey(new Date());
  const velocity = velocityWindows(active, todayKey);
  const revenue = buildRevenueSummary(active);

  const reservationBookings = active.length;
  const reservationGuests = Math.round(
    active.reduce((sum, r) => sum + (Number(r.guest_count) || 0), 0)
  );

  const bookedCabins = mse.bookedCabins;
  const totalCabins = mse.totalCabins;
  const loadFactorPct =
    bookedCabins != null && totalCabins > 0
      ? round2((bookedCabins / totalCabins) * 100)
      : null;

  const composition = [];
  const byDim = new Map();
  active.forEach((res) => {
    const key = dimensionKeyOf(res, dimCtx);
    const cur = byDim.get(key) || { dimensionKey: key, bookings: 0, guests: 0 };
    cur.bookings += 1;
    cur.guests += Number(res.guest_count) || 0;
    byDim.set(key, cur);
  });
  [...byDim.values()]
    .map((row) => ({ ...row, guests: Math.round(row.guests) }))
    .sort((a, b) => b.guests - a.guests)
    .forEach((row) => composition.push(row));

  const missingBookDates = active.length - withBookDate;

  let durationDays = null;
  const sample = active.find((r) => Number(r.sail_duration) > 0);
  if (sample) durationDays = Number(sample.sail_duration);
  else if (active[0]?.sail_from_date && active[0]?.sail_to_date) {
    durationDays = Math.max(
      0,
      daysBetween(toDateKey(active[0].sail_from_date), toDateKey(active[0].sail_to_date))
    );
  }

  let competitor = null;
  if (includeCompetitor) {
    const [ownMinFare, peer] = await Promise.all([
      loadOwnPublishedMinFare(client, masterSailCode, 'EUR'),
      loadCompetitorSummary(client, {
        sailDateKey,
        durationDays,
        currency: 'EUR',
      }),
    ]);
    const competitorMedianPp = peer?.competitorMedianPp ?? null;
    const gapPct =
      ownMinFare != null && competitorMedianPp != null && competitorMedianPp > 0
        ? round2(((ownMinFare - competitorMedianPp) / competitorMedianPp) * 100)
        : null;
    competitor = {
      currency: 'EUR',
      ourMinFarePp: ownMinFare,
      competitorMedianPp,
      competitorMinPp: peer?.competitorMinPp ?? null,
      competitorCount: peer?.competitorCount ?? 0,
      gapPct,
      departureMonth: peer?.departureMonth || (sailDateKey ? sailDateKey.slice(0, 7) : null),
      message: peer?.message || null,
    };
  }

  return {
    sailCode: scope.requestedSailCode,
    referenceSailCode: masterSailCode,
    sailCodes: scope.sailCodes,
    sailDate: sailDateKey,
    shipCode: scope.shipCode,
    shipName: scope.shipName,
    marketBreakdown,
    seriesMode,
    bookedCabins,
    totalCabins,
    loadFactorPct,
    capacitySource: mse.source,
    reservationBookings,
    reservationGuests,
    bookDateField: 'original_init_date|res_init_date',
    missingBookDates,
    velocity,
    revenue,
    competitor,
    series,
    totals,
    composition,
    maxWeeks,
    daysUntilSailing: sailDateKey
      ? Math.ceil(daysBetween(todayKey, sailDateKey))
      : null,
  };
}
