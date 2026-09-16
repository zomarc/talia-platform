/**
 * Inventory-scoped booking profile with dimensional breakdowns
 * (market / market_group / currency) and absolute | load-factor metrics.
 */

const WEEK_INTERVALS = [12, 10, 8, 6, 4, 2, 0];
const BREAKDOWNS = new Set(['none', 'market', 'market_group', 'currency']);

function clean(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function weekLabel(weeks) {
  return weeks === 0 ? 'Sail' : `W-${weeks}`;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function pctChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return round2(((current - previous) / Math.abs(previous)) * 100);
}

/**
 * Resolve inventory voyage scope from a sail code.
 * Returns master reference, all selling sail_codes, ship, and capacity.
 */
export async function resolveVoyageScope(client, sailCode) {
  const code = clean(sailCode);
  if (!code) throw new Error('Sail code is required');

  const { data: items, error: itemError } = await client
    .from('inventory_item')
    .select('id, sail_code, ship_code, ship_name, reference_sail_code, sailing_role, parent_inventory_item_id, is_operational')
    .or(`sail_code.eq.${code},reference_sail_code.eq.${code}`);

  if (itemError) {
    console.warn('[booking-profile-dimensional] inventory_item lookup:', itemError.message);
  }

  let referenceSailCode = code;
  let inventoryItemId = null;
  let shipCode = null;
  let shipName = null;
  let sailCodes = [code];
  let roles = [];

  if (items?.length) {
    const bySail = items.find((i) => clean(i.sail_code) === code) || items[0];
    referenceSailCode = clean(bySail.reference_sail_code) || clean(bySail.sail_code) || code;
    inventoryItemId = bySail.id;
    shipCode = clean(bySail.ship_code);
    shipName = clean(bySail.ship_name);

    const { data: siblings } = await client
      .from('inventory_item')
      .select('id, sail_code, ship_code, ship_name, reference_sail_code, sailing_role, is_operational')
      .eq('reference_sail_code', referenceSailCode);

    // Selling profile scope: all sail_codes under the reference (segments may be
    // non-operational physically but still carry reservations).
    const pool = siblings?.length ? siblings : items;
    sailCodes = [...new Set(pool.map((i) => clean(i.sail_code)).filter(Boolean))];
    roles = pool.map((i) => clean(i.sailing_role)).filter(Boolean);

    const master =
      pool.find((i) => i.sailing_role === 'master') ||
      pool.find((i) => clean(i.sail_code) === referenceSailCode) ||
      pool[0];
    if (master) {
      inventoryItemId = master.id;
      shipCode = clean(master.ship_code) || shipCode;
      shipName = clean(master.ship_name) || shipName;
    }
  }

  // Schedule from master_sail (prefer reference / any code in scope)
  let sailDate = null;
  const codesForSail = [referenceSailCode, ...sailCodes].filter(Boolean);
  for (const sc of [...new Set(codesForSail)]) {
    const { data: sail } = await client
      .from('master_sail')
      .select('sail_code, sail_date_from, ship_code, ship_name')
      .eq('sail_code', sc)
      .maybeSingle();
    if (sail) {
      sailDate = sail.sail_date_from;
      shipCode = shipCode || clean(sail.ship_code);
      shipName = shipName || clean(sail.ship_name);
      break;
    }
  }

  if (!sailDate) {
    throw new Error(`Sailing not found: ${code}`);
  }

  // Capacity once for the voyage (never sum master + segments)
  let capacity = null;
  let capacitySource = null;

  if (shipCode) {
    const { data: berthRows } = await client
      .from('ship_day_capacity')
      .select('sellable_berths, berth_capacity, sail_code, date')
      .eq('ship_code', shipCode)
      .in('sail_code', sailCodes.length ? sailCodes : [referenceSailCode])
      .order('date', { ascending: true })
      .limit(50);

    if (berthRows?.length) {
      const caps = berthRows
        .map((r) => Number(r.sellable_berths ?? r.berth_capacity) || 0)
        .filter((n) => n > 0);
      if (caps.length) {
        capacity = Math.max(...caps);
        capacitySource = 'ship_day_capacity';
      }
    }

    if (!capacity) {
      const { data: ship } = await client
        .from('ship')
        .select('ship_pax_capacity, ship_code, ship_name')
        .eq('ship_code', shipCode)
        .maybeSingle();
      if (ship?.ship_pax_capacity != null) {
        capacity = Number(ship.ship_pax_capacity) || null;
        capacitySource = 'ship.ship_pax_capacity';
        shipName = shipName || clean(ship.ship_name);
      }
    }
  }

  return {
    requestedSailCode: code,
    referenceSailCode,
    inventoryItemId,
    sailCodes,
    roles,
    shipCode,
    shipName,
    sailDate,
    capacity,
    capacitySource,
  };
}

async function loadMarketRollUpIndex(client) {
  const { data } = await client
    .from('market_roll_up')
    .select('agency_market, new_budget_roll_up, active_record_flag');
  const index = new Map();
  (data || []).forEach((row) => {
    if (row.active_record_flag === false || row.active_record_flag === 0) return;
    const key = clean(row.agency_market);
    if (!key) return;
    index.set(key.toUpperCase(), clean(row.new_budget_roll_up) || key);
  });
  return index;
}

async function loadAgencyMarketIndex(client) {
  const { data } = await client
    .from('agency')
    .select('agency_id, market, default_currency');
  const index = new Map();
  (data || []).forEach((row) => {
    if (row.agency_id == null) return;
    index.set(String(row.agency_id), {
      market: clean(row.market) || 'UNKNOWN',
      defaultCurrency: clean(row.default_currency),
    });
  });
  return index;
}

/**
 * Fetch reservations for voyage sail_codes with dimension attributes.
 */
async function fetchScopedReservations(client, sailCodes) {
  if (!sailCodes?.length) return [];

  const batchSize = 100;
  const all = [];
  for (let i = 0; i < sailCodes.length; i += batchSize) {
    const batch = sailCodes.slice(i, i + batchSize);
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await client
        .from('reservation')
        .select('res_id, sail_code, ship, sail_from_date, agency_id, currency, guest_count, res_status')
        .in('sail_code', batch)
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (error) {
        console.error('[booking-profile-dimensional] reservation fetch:', error.message);
        break;
      }
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

async function fetchReservationChanges(client, resIds, sailDateStr) {
  if (!resIds?.length) {
    return { changes: [], distinctDates: 0, minDate: null, maxDate: null };
  }

  const batchSize = 500;
  const allChanges = [];
  for (let i = 0; i < resIds.length; i += batchSize) {
    const batch = resIds.slice(i, i + batchSize);
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await client
        .from('reservation_changes')
        .select('snapshot_date, res_id, guest_count, guest_count_delta, agency_id, sail_code')
        .in('res_id', batch)
        .order('snapshot_date', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (error) {
        console.error('[booking-profile-dimensional] changes fetch:', error.message);
        break;
      }
      if (data?.length) {
        const filtered = data.filter((c) => {
          const d = c.snapshot_date ? String(c.snapshot_date).split('T')[0] : null;
          return d && (!sailDateStr || d <= sailDateStr);
        });
        allChanges.push(...filtered);
        hasMore = data.length === pageSize;
        page += 1;
      } else {
        hasMore = false;
      }
    }
  }

  const dates = [...new Set(allChanges.map((c) => String(c.snapshot_date).split('T')[0]))].sort();
  return {
    changes: allChanges,
    distinctDates: dates.length,
    minDate: dates[0] || null,
    maxDate: dates[dates.length - 1] || null,
  };
}

function dimensionKeyForReservation(res, agencyIndex, rollUpIndex, breakdown) {
  if (breakdown === 'none') return 'TOTAL';
  const agency = agencyIndex.get(String(res.agency_id));
  const market = agency?.market || 'UNKNOWN';
  if (breakdown === 'market') return market;
  if (breakdown === 'market_group') {
    return rollUpIndex.get(market.toUpperCase()) || market;
  }
  if (breakdown === 'currency') {
    return clean(res.currency) || agency?.defaultCurrency || 'UNKNOWN';
  }
  return 'TOTAL';
}

function buildCurrentComposition(reservations, agencyIndex, rollUpIndex, capacity) {
  const by = {
    market: new Map(),
    market_group: new Map(),
    currency: new Map(),
  };

  const bump = (map, key, bookings, guests) => {
    const cur = map.get(key) || { dimensionKey: key, bookings: 0, guests: 0 };
    cur.bookings += bookings;
    cur.guests += guests;
    map.set(key, cur);
  };

  reservations.forEach((res) => {
    const guests = Number(res.guest_count) || 0;
    const agency = agencyIndex.get(String(res.agency_id));
    const market = agency?.market || 'UNKNOWN';
    const group = rollUpIndex.get(market.toUpperCase()) || market;
    const currency = clean(res.currency) || agency?.defaultCurrency || 'UNKNOWN';
    bump(by.market, market, 1, guests);
    bump(by.market_group, group, 1, guests);
    bump(by.currency, currency, 1, guests);
  });

  const toList = (map) =>
    [...map.values()]
      .map((row) => ({
        ...row,
        loadFactorPct: capacity > 0 ? round2((row.guests / capacity) * 100) : null,
      }))
      .sort((a, b) => b.guests - a.guests);

  return {
    market: toList(by.market),
    marketGroup: toList(by.market_group),
    currency: toList(by.currency),
  };
}

/**
 * Build week-bucketed series from change history + reservation dimension map.
 * Falls back to a single "current" point when history is too thin.
 */
function buildDimensionalCurves({
  sailDate,
  reservations,
  changesMeta,
  agencyIndex,
  rollUpIndex,
  breakdown,
  capacity,
}) {
  const resMeta = new Map();
  reservations.forEach((r) => {
    resMeta.set(r.res_id, r);
  });

  const dimKeyOf = (resId, change) => {
    const res = resMeta.get(resId) || {
      agency_id: change?.agency_id,
      currency: null,
    };
    return dimensionKeyForReservation(res, agencyIndex, rollUpIndex, breakdown);
  };

  const historyThin = changesMeta.distinctDates < 3;
  const seriesKeys = new Set();

  // Always include current composition keys
  reservations.forEach((r) => {
    seriesKeys.add(dimensionKeyForReservation(r, agencyIndex, rollUpIndex, breakdown));
  });

  const sail = new Date(sailDate);
  sail.setHours(0, 0, 0, 0);

  // Latest known state per res as of each week bucket
  const buildAtWeeks = (weeks) => {
    const target = new Date(sail);
    target.setDate(target.getDate() - weeks * 7);
    target.setHours(23, 59, 59, 999);
    const targetStr = target.toISOString().split('T')[0];

    const latestByRes = new Map();
    (changesMeta.changes || []).forEach((change) => {
      const d = change.snapshot_date ? String(change.snapshot_date).split('T')[0] : null;
      if (!d || d > targetStr) return;
      const existing = latestByRes.get(change.res_id);
      if (!existing || d >= existing.date) {
        latestByRes.set(change.res_id, {
          date: d,
          guest_count: Number(change.guest_count) || 0,
          agency_id: change.agency_id,
        });
      }
    });

    const byDim = new Map();
    if (latestByRes.size === 0 && weeks === 0) {
      // Fallback: current reservation snapshot at Sail / when no history
      reservations.forEach((r) => {
        const key = dimensionKeyForReservation(r, agencyIndex, rollUpIndex, breakdown);
        seriesKeys.add(key);
        const cur = byDim.get(key) || { bookings: 0, guests: 0 };
        cur.bookings += 1;
        cur.guests += Number(r.guest_count) || 0;
        byDim.set(key, cur);
      });
    } else {
      latestByRes.forEach((state, resId) => {
        const key = dimKeyOf(resId, state);
        seriesKeys.add(key);
        const cur = byDim.get(key) || { bookings: 0, guests: 0 };
        cur.bookings += 1;
        cur.guests += state.guest_count;
        byDim.set(key, cur);
      });
    }

    return byDim;
  };

  // If history thin, only emit current (Sail) + zero earlier points from current composition share is wrong;
  // emit Sail from current reservations and leave earlier weeks as 0 with dataQuality flag.
  const weekMaps = WEEK_INTERVALS.map((weeks) => ({
    weeks,
    map: historyThin && weeks > 0 ? new Map() : buildAtWeeks(weeks),
  }));

  if (historyThin) {
    const sailMap = buildAtWeeks(0);
    weekMaps[weekMaps.length - 1].map = sailMap;
  }

  const keys = [...seriesKeys].sort();
  const series = keys.map((dimensionKey) => {
    const points = weekMaps.map(({ weeks, map }) => {
      const cell = map.get(dimensionKey) || { bookings: 0, guests: 0 };
      const guests = Math.round(cell.guests);
      return {
        weekLabel: weekLabel(weeks),
        weeksUntilSailing: weeks,
        bookings: cell.bookings,
        guests,
        loadFactorPct: capacity > 0 ? round2((guests / capacity) * 100) : null,
      };
    });
    return { dimensionKey, points };
  });

  // Totals series
  const totals = WEEK_INTERVALS.map((weeks, idx) => {
    let bookings = 0;
    let guests = 0;
    series.forEach((s) => {
      bookings += s.points[idx].bookings;
      guests += s.points[idx].guests;
    });
    return {
      weekLabel: weekLabel(weeks),
      weeksUntilSailing: weeks,
      bookings,
      guests,
      loadFactorPct: capacity > 0 ? round2((guests / capacity) * 100) : null,
    };
  });

  return { series, totals, historyThin };
}

function buildLegacyDailyPoints(reservations, changesMeta, sailDate) {
  const sailDateStr = String(sailDate).split('T')[0];
  const sailDateEnd = new Date(sailDate);
  sailDateEnd.setHours(23, 59, 59, 999);
  const endStr = sailDateEnd.toISOString().split('T')[0];

  const latestSnapshots = new Map();
  (changesMeta.changes || []).forEach((change) => {
    const date = change.snapshot_date ? String(change.snapshot_date).split('T')[0] : null;
    if (!date || date > endStr) return;
    const key = `${date}_${change.res_id}`;
    const existing = latestSnapshots.get(key);
    if (!existing || Number(change.guest_count || 0) >= Number(existing.guest_count || 0)) {
      latestSnapshots.set(key, change);
    }
  });

  const groupedByDate = {};
  latestSnapshots.forEach((change) => {
    const date = change.snapshot_date ? String(change.snapshot_date).split('T')[0] : null;
    if (!date) return;
    if (!groupedByDate[date]) {
      groupedByDate[date] = {
        date,
        bookings: new Set(),
        guests: 0,
        newBookings: 0,
        cancellations: 0,
      };
    }
    groupedByDate[date].bookings.add(change.res_id);
    groupedByDate[date].guests += Number(change.guest_count || 0);
    const delta = Number(change.guest_count_delta || 0);
    if (delta > 0) groupedByDate[date].newBookings += 1;
    if (delta < 0) groupedByDate[date].cancellations += 1;
  });

  Object.keys(groupedByDate).forEach((date) => {
    groupedByDate[date].bookings = groupedByDate[date].bookings.size;
    groupedByDate[date].netBookings =
      groupedByDate[date].newBookings - groupedByDate[date].cancellations;
  });

  const actualDates = Object.keys(groupedByDate).sort();
  if (actualDates.length === 0) {
    // Single current point from reservations
    return [
      {
        date: sailDateStr,
        bookings: reservations.length,
        guests: Math.round(reservations.reduce((s, r) => s + (Number(r.guest_count) || 0), 0)),
        newBookings: 0,
        cancellations: 0,
        netBookings: 0,
      },
    ];
  }

  const first = new Date(actualDates[0]);
  first.setHours(0, 0, 0, 0);
  const points = [];
  let lastBookings = 0;
  let lastGuests = 0;
  const cursor = new Date(first);
  const end = new Date(sailDate);
  end.setHours(23, 59, 59, 999);

  while (cursor <= end) {
    const dateStr = cursor.toISOString().split('T')[0];
    const day = groupedByDate[dateStr];
    if (day) {
      lastBookings = day.bookings;
      lastGuests = day.guests;
      points.push({
        date: dateStr,
        bookings: lastBookings,
        guests: Math.round(lastGuests),
        newBookings: day.newBookings,
        cancellations: day.cancellations,
        netBookings: day.netBookings,
      });
    } else {
      points.push({
        date: dateStr,
        bookings: lastBookings,
        guests: Math.round(lastGuests),
        newBookings: 0,
        cancellations: 0,
        netBookings: 0,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return points;
}

/**
 * Main entry: dimensional booking profile for a voyage.
 */
export async function getBookingProfileDimensional(client, sailCode, options = {}) {
  const breakdown = BREAKDOWNS.has(options.breakdown) ? options.breakdown : 'none';
  const scope = await resolveVoyageScope(client, sailCode);
  const sailDateStr = String(scope.sailDate).split('T')[0];

  const [agencyIndex, rollUpIndex, reservations] = await Promise.all([
    loadAgencyMarketIndex(client),
    loadMarketRollUpIndex(client),
    fetchScopedReservations(client, scope.sailCodes),
  ]);

  const resIds = reservations.map((r) => r.res_id);
  const changesMeta = await fetchReservationChanges(client, resIds, sailDateStr);

  const currentBookings = reservations.length;
  const currentGuests = Math.round(
    reservations.reduce((sum, r) => sum + (Number(r.guest_count) || 0), 0)
  );
  const capacity = scope.capacity;
  const currentLoadFactorPct =
    capacity > 0 ? round2((currentGuests / capacity) * 100) : null;

  const composition = buildCurrentComposition(
    reservations,
    agencyIndex,
    rollUpIndex,
    capacity
  );

  const { series, totals, historyThin } = buildDimensionalCurves({
    sailDate: scope.sailDate,
    reservations,
    changesMeta,
    agencyIndex,
    rollUpIndex,
    breakdown,
    capacity,
  });

  const bookingDataPoints = buildLegacyDailyPoints(reservations, changesMeta, scope.sailDate);
  const totalNewBookings = bookingDataPoints.reduce((s, dp) => s + dp.newBookings, 0);
  const totalCancellations = bookingDataPoints.reduce((s, dp) => s + dp.cancellations, 0);
  const daysWithBookings = bookingDataPoints.length;
  const bookingVelocity = daysWithBookings > 0 ? round2(totalNewBookings / daysWithBookings) : 0;
  const cancellationRate =
    currentBookings > 0
      ? round2((totalCancellations / (currentBookings + totalCancellations)) * 100)
      : 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sail = new Date(scope.sailDate);
  const daysUntilSailing = Math.ceil((sail - today) / (1000 * 60 * 60 * 24));

  const historyQuality =
    changesMeta.distinctDates >= 14
      ? 'good'
      : changesMeta.distinctDates >= 3
        ? 'limited'
        : 'insufficient';

  return {
    sailCode: scope.requestedSailCode,
    referenceSailCode: scope.referenceSailCode,
    inventoryItemId: scope.inventoryItemId,
    sailCodes: scope.sailCodes,
    sailDate: sailDateStr,
    shipName: scope.shipName,
    shipCode: scope.shipCode,
    currentBookings,
    currentGuests,
    capacity,
    capacitySource: scope.capacitySource,
    currentLoadFactorPct,
    bookingVelocity,
    cancellationRate,
    daysUntilSailing,
    breakdown,
    bookingDataPoints,
    buildCurves: totals,
    series,
    composition,
    history: {
      quality: historyQuality,
      distinctSnapshotDates: changesMeta.distinctDates,
      minSnapshotDate: changesMeta.minDate,
      maxSnapshotDate: changesMeta.maxDate,
      thinHistory: historyThin,
      message:
        historyQuality === 'insufficient'
          ? 'Reservation snapshot history is too thin for a reliable build curve. Showing current distribution; re-sync reservation_changes for a wider Snapshot_Date range.'
          : historyQuality === 'limited'
            ? 'Snapshot history is limited; week-curve shape may be incomplete. Year-over-year should be treated as illustrative only.'
            : null,
    },
  };
}

/**
 * Inventory-scoped legacy-compatible profile (replaces ship+date join).
 */
export async function getBookingProfileScoped(client, sailCode) {
  const dimensional = await getBookingProfileDimensional(client, sailCode, {
    breakdown: 'none',
  });
  return {
    sailCode: dimensional.sailCode,
    sailDate: dimensional.sailDate,
    shipName: dimensional.shipName,
    shipCode: dimensional.shipCode,
    currentBookings: dimensional.currentBookings,
    currentGuests: dimensional.currentGuests,
    bookingDataPoints: dimensional.bookingDataPoints,
    bookingVelocity: dimensional.bookingVelocity,
    cancellationRate: dimensional.cancellationRate,
    daysUntilSailing: dimensional.daysUntilSailing,
    buildCurves: dimensional.buildCurves,
    referenceSailCode: dimensional.referenceSailCode,
    sailCodes: dimensional.sailCodes,
    capacity: dimensional.capacity,
    currentLoadFactorPct: dimensional.currentLoadFactorPct,
    history: dimensional.history,
  };
}

const dateParts = (value) => {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
};

const pad2 = (n) => String(n).padStart(2, '0');

const lastDayOfMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/**
 * Pick the same-ship sailing in a month bucket closest to the target day-of-month.
 * Prefers is_main masters.
 */
export function pickSameMonthPeer(rows = [], targetDate) {
  const target = dateParts(targetDate);
  if (!target) return null;
  const scored = (rows || [])
    .map((row) => {
      const parts = dateParts(row?.sail_date_from);
      if (!parts) return null;
      const dayDiff = Math.abs(parts.day - target.day);
      const mainBonus = row.is_main ? -2 : 0;
      return { row, score: dayDiff + mainBonus, sail: String(row.sail_code || '') };
    })
    .filter(Boolean);
  scored.sort((a, b) => a.score - b.score || a.sail.localeCompare(b.sail));
  return scored[0]?.row || null;
}

/**
 * Same ship, same calendar month last year (not a ±21 day window).
 */
export async function findSameMonthPriorYearPeer(client, sailCode, hint = {}) {
  const code = clean(sailCode);
  let shipCode = clean(hint.shipCode)?.toUpperCase() || null;
  let sailDate = clean(hint.sailDate);
  if (!shipCode || !sailDate) {
    const scope = await resolveVoyageScope(client, code);
    shipCode = shipCode || clean(scope.shipCode)?.toUpperCase() || null;
    sailDate = sailDate || clean(scope.sailDate);
  }
  const parts = dateParts(sailDate);
  if (!shipCode || !parts) return null;
  const priorYear = parts.year - 1;
  const from = `${priorYear}-${pad2(parts.month)}-01`;
  const to = `${priorYear}-${pad2(parts.month)}-${pad2(lastDayOfMonth(priorYear, parts.month))}`;
  const { data } = await client
    .from('master_sail')
    .select('sail_code, sail_date_from, ship_code, package_type, sail_days, is_main')
    .eq('ship_code', shipCode)
    .gte('sail_date_from', from)
    .lte('sail_date_from', to)
    .order('sail_date_from', { ascending: true });
  const match = pickSameMonthPeer(data || [], `${priorYear}-${pad2(parts.month)}-${pad2(parts.day)}`);
  return clean(match?.sail_code);
}

/**
 * Find a prior-year peer sail by ship + similar sail date (±21 days, year-1).
 */
export async function findPriorYearPeerSail(client, sailCode) {
  const scope = await resolveVoyageScope(client, sailCode);
  if (!scope.shipCode || !scope.sailDate) return null;

  const sail = new Date(scope.sailDate);
  const prior = new Date(sail);
  prior.setFullYear(prior.getFullYear() - 1);
  const from = new Date(prior);
  from.setDate(from.getDate() - 21);
  const to = new Date(prior);
  to.setDate(to.getDate() + 21);

  const { data } = await client
    .from('master_sail')
    .select('sail_code, sail_date_from, ship_code, package_type, sail_days, is_main')
    .eq('ship_code', scope.shipCode)
    .gte('sail_date_from', from.toISOString().split('T')[0])
    .lte('sail_date_from', to.toISOString().split('T')[0])
    .order('sail_date_from', { ascending: true });

  if (!data?.length) return null;

  // Prefer is_main / master-like codes matching reference pattern
  const scored = data.map((row) => {
    const d = new Date(row.sail_date_from);
    const dayDiff = Math.abs((d - prior) / (1000 * 60 * 60 * 24));
    const mainBonus = row.is_main ? -5 : 0;
    return { ...row, score: dayDiff + mainBonus };
  });
  scored.sort((a, b) => a.score - b.score);
  return clean(scored[0].sail_code);
}

export async function getBookingProfileDimensionalYoY(client, sailCode, options = {}) {
  const breakdown = options.breakdown || 'none';
  const current = await getBookingProfileDimensional(client, sailCode, { breakdown });

  let previousYearSailCode = clean(options.previousYearSailCode);
  let peerSource = 'explicit';
  if (!previousYearSailCode) {
    previousYearSailCode = await findPriorYearPeerSail(client, sailCode);
    peerSource = previousYearSailCode ? 'inventory_peer' : null;
  }

  let previous = null;
  if (previousYearSailCode) {
    try {
      previous = await getBookingProfileDimensional(client, previousYearSailCode, { breakdown });
    } catch (err) {
      console.warn('[booking-profile-dimensional] prior year profile failed:', err.message);
    }
  }

  const comparison =
    previous
      ? {
          bookingsDifference: current.currentBookings - previous.currentBookings,
          bookingsPercentageChange: pctChange(current.currentBookings, previous.currentBookings),
          guestsDifference: current.currentGuests - previous.currentGuests,
          guestsPercentageChange: pctChange(current.currentGuests, previous.currentGuests),
          velocityDifference: round2(current.bookingVelocity - previous.bookingVelocity),
          velocityPercentageChange: pctChange(current.bookingVelocity, previous.bookingVelocity),
          loadFactorDifference:
            current.currentLoadFactorPct != null && previous.currentLoadFactorPct != null
              ? round2(current.currentLoadFactorPct - previous.currentLoadFactorPct)
              : null,
        }
      : null;

  return {
    currentYear: current,
    previousYear: previous,
    comparison,
    previousYearSailCode,
    peerSource,
    representativenessNote:
      'Recent years (incl. the past ~18 months) are weak proxies for future demand. Treat YoY as illustrative, not a planning baseline.',
  };
}

/**
 * Finance budget end-state vs actual composition for a voyage.
 */
export async function getBudgetEndStateComparison(client, sailCode, options = {}) {
  const breakdown = BREAKDOWNS.has(options.breakdown) ? options.breakdown : 'market_group';
  const profile = await getBookingProfileDimensional(client, sailCode, { breakdown: 'none' });
  const masterVoyage = profile.referenceSailCode;

  const { data: budgetRows, error } = await client
    .from('budget')
    .select(
      'master_voyage, market, new_market_roll_up, currency, passengers, active_record_flag, fy, budget_name'
    )
    .eq('master_voyage', masterVoyage);

  if (error) {
    console.warn('[booking-profile-dimensional] budget fetch:', error.message);
  }

  const active = (budgetRows || []).filter(
    (r) => r.active_record_flag == null || r.active_record_flag === 1 || r.active_record_flag === true
  );

  const bump = (map, key, passengers) => {
    const cur = map.get(key) || { dimensionKey: key, budgetPassengers: 0 };
    cur.budgetPassengers += Number(passengers) || 0;
    map.set(key, cur);
  };

  const byDim = new Map();
  active.forEach((row) => {
    let key = 'TOTAL';
    if (breakdown === 'market') key = clean(row.market) || 'UNKNOWN';
    else if (breakdown === 'market_group') key = clean(row.new_market_roll_up) || clean(row.market) || 'UNKNOWN';
    else if (breakdown === 'currency') key = clean(row.currency) || 'UNKNOWN';
    bump(byDim, key, row.passengers);
  });

  const actualMap = new Map();
  const list =
    breakdown === 'market'
      ? profile.composition.market
      : breakdown === 'currency'
        ? profile.composition.currency
        : profile.composition.marketGroup;

  list.forEach((row) => {
    actualMap.set(row.dimensionKey, row);
  });

  const keys = new Set([...byDim.keys(), ...actualMap.keys()]);
  const rows = [...keys]
    .map((dimensionKey) => {
      const budgetPassengers = round2(byDim.get(dimensionKey)?.budgetPassengers || 0);
      const actual = actualMap.get(dimensionKey);
      const actualGuests = actual?.guests || 0;
      const actualBookings = actual?.bookings || 0;
      const gapGuests = round2(actualGuests - budgetPassengers);
      const budgetLf =
        profile.capacity > 0 ? round2((budgetPassengers / profile.capacity) * 100) : null;
      const actualLf =
        profile.capacity > 0 ? round2((actualGuests / profile.capacity) * 100) : null;
      return {
        dimensionKey,
        budgetPassengers,
        actualGuests,
        actualBookings,
        gapGuests,
        budgetLoadFactorPct: budgetLf,
        actualLoadFactorPct: actualLf,
        gapLoadFactorPct:
          budgetLf != null && actualLf != null ? round2(actualLf - budgetLf) : null,
      };
    })
    .sort((a, b) => b.budgetPassengers - a.budgetPassengers);

  const totalBudget = round2(rows.reduce((s, r) => s + r.budgetPassengers, 0));

  return {
    sailCode: profile.sailCode,
    referenceSailCode: masterVoyage,
    shipCode: profile.shipCode,
    shipName: profile.shipName,
    capacity: profile.capacity,
    breakdown,
    streamLabel: 'Finance budget',
    totalBudgetPassengers: totalBudget,
    totalActualGuests: profile.currentGuests,
    totalGapGuests: round2(profile.currentGuests - totalBudget),
    rows,
    budgetRowCount: active.length,
    message:
      active.length === 0
        ? 'No finance budget rows for this master voyage. Sync lkp.BUDGET into budget (active_record_flag).'
        : null,
  };
}

export { WEEK_INTERVALS, BREAKDOWNS };
