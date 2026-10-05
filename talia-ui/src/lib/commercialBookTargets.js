/**
 * Commercial book targets (lkp.Commercial_Book_Targets).
 * Weekly pace, summed to a voyage total. Pax type A is excluded until defined.
 * Named booked only: F → FIT, G → Group. Held / GTY is not in this source.
 */

export const COMMERCIAL_TARGETS_OFF = 'off';
export const COMMERCIAL_TARGETS_ON = 'on';

export const COMMERCIAL_SAIL_COLUMNS = [
  'master_voyage',
  'pax_type',
  'master_voyage_length',
  'guest_count',
  'gross_ticket_revenue_eur',
  'pax_nights',
];

export const COMMERCIAL_VOYAGE_COLUMNS = [
  'master_voyage',
  'pax_type',
  'market_grouping',
  'agency_market',
  'agency_channel',
  'master_voyage_length',
  'guest_count',
  'gross_ticket_revenue_eur',
  'pax_nights',
];

export const COMMERCIAL_WEEK_COLUMNS = COMMERCIAL_VOYAGE_COLUMNS.concat([
  'wc_snapshot_date',
]);

export const normalizeCommercialTargets = (value) => {
  if (value === true || value === COMMERCIAL_TARGETS_ON || value === 'true') {
    return COMMERCIAL_TARGETS_ON;
  }
  return COMMERCIAL_TARGETS_OFF;
};

export const commercialTargetsEnabled = (value) => (
  normalizeCommercialTargets(value) === COMMERCIAL_TARGETS_ON
);

/** F → FIT, G → Group. A and anything else are excluded. */
export const commercialPaxBucket = (paxType) => {
  const pax = String(paxType || '').trim().toUpperCase();
  if (pax === 'G' || pax.startsWith('G')) return 'Group';
  if (pax === 'F' || pax.startsWith('F')) return 'FIT';
  return null;
};

/** Align commercial agency_channel with Distribution channel labels. */
export const commercialChannelLabel = (agencyChannel) => {
  const key = String(agencyChannel || '').trim().toUpperCase();
  if (!key) return 'Other';
  if (key.includes('TRAVEL AGENCY')) return 'Agency';
  if (key.includes('TOUR OPERATOR') || key === 'DMC' || key.includes('DMC')) return 'Tour Op';
  if (key === 'DIRECT' || key.includes('DIRECT')) return 'Direct';
  return 'Other';
};

export const commercialMarketLabel = (row, marketDimension = 'market_group') => {
  if (marketDimension === 'market') {
    return String(row?.agency_market || '').trim() || 'Unknown';
  }
  return String(row?.market_grouping || '').trim() || 'Unknown';
};

const asNumber = (value) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

const dateKey = (value) => {
  const text = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

const daysBetween = (fromKey, toKey) => {
  const from = Date.parse(`${fromKey}T00:00:00Z`);
  const to = Date.parse(`${toKey}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.round((to - from) / 86400000);
};

/** Weeks before sail, same rounding as the Monday booking-curve axis. */
export const weeksBeforeSail = (snapshotDate, sailDate) => {
  const from = dateKey(snapshotDate);
  const to = dateKey(sailDate);
  if (!from || !to) return null;
  const days = daysBetween(from, to);
  if (days == null) return null;
  return Math.max(0, Math.round(days / 7));
};

const round2 = (value) => Math.round(value * 100) / 100;

/**
 * PPPD = ticket revenue / passenger-nights.
 * pax_nights is already guest × nights; otherwise divide by guests and voyage length.
 */
export const commercialPppd = (ticket, guests, paxNights, voyageLength) => {
  const revenue = asNumber(ticket);
  if (!(revenue > 0)) return null;
  const nights = asNumber(paxNights);
  if (nights > 0) return round2(revenue / nights);
  const length = asNumber(voyageLength);
  const pax = asNumber(guests);
  if (pax > 0 && length > 0) return round2(revenue / pax / length);
  return null;
};

const emptyAccum = () => ({ guests: 0, ticket: 0, paxNights: 0, voyageLength: 0 });

const addRow = (accum, row) => {
  accum.guests += asNumber(row?.guest_count);
  accum.ticket += asNumber(row?.gross_ticket_revenue_eur);
  accum.paxNights += asNumber(row?.pax_nights);
  accum.voyageLength = Math.max(accum.voyageLength, asNumber(row?.master_voyage_length));
};

/**
 * Running total of weekly pace, far from sail toward week 0.
 * At week W the value includes every snapshot with weeks-before-sail >= W.
 */
export const cumulativeCommercialWeeks = (rows, sailDate, axisWeeks) => {
  const increments = new Map();
  (rows || []).forEach((row) => {
    if (!commercialPaxBucket(row?.pax_type)) return;
    const week = weeksBeforeSail(row?.wc_snapshot_date, sailDate);
    if (week == null) return;
    const cell = increments.get(week) || emptyAccum();
    addRow(cell, row);
    increments.set(week, cell);
  });

  const axis = (axisWeeks || []).map((week) => Number(week)).filter((week) => Number.isFinite(week));
  const walk = [...new Set([...increments.keys(), ...axis])].sort((a, b) => b - a);
  const running = emptyAccum();
  const atWeek = new Map();
  walk.forEach((week) => {
    const inc = increments.get(week);
    if (inc) {
      running.guests += inc.guests;
      running.ticket += inc.ticket;
      running.paxNights += inc.paxNights;
      running.voyageLength = Math.max(running.voyageLength, inc.voyageLength);
    }
    atWeek.set(week, {
      guests: running.guests,
      ticket: running.ticket,
      paxNights: running.paxNights,
      voyageLength: running.voyageLength,
      pppd: commercialPppd(running.ticket, running.guests, running.paxNights, running.voyageLength),
    });
  });

  return axis.map((week) => atWeek.get(week) || {
    guests: 0,
    ticket: 0,
    paxNights: 0,
    voyageLength: 0,
    pppd: null,
  });
};

/**
 * Overlay for the reservation curve.
 * Totals mode: one commercial guest line. Series mode: one line per market grain.
 */
export const buildCommercialCurveOverlay = (rows, {
  sailDate,
  axisWeeks,
  marketDimension = 'market_group',
  splitByDimension = false,
} = {}) => {
  const named = (rows || []).filter((row) => commercialPaxBucket(row?.pax_type));
  const total = cumulativeCommercialWeeks(named, sailDate, axisWeeks);
  if (!splitByDimension) {
    return { total, byDimension: [] };
  }

  const groups = new Map();
  named.forEach((row) => {
    const key = commercialMarketLabel(row, marketDimension);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  const byDimension = [...groups.entries()]
    .map(([dimensionKey, groupRows]) => ({
      dimensionKey,
      points: cumulativeCommercialWeeks(groupRows, sailDate, axisWeeks),
    }))
    .filter((series) => series.points.some((point) => point.guests > 0))
    .sort((a, b) => String(a.dimensionKey).localeCompare(String(b.dimensionKey)));

  return { total, byDimension };
};

/** Voyage totals for Master Sailing Explorer. A is excluded. */
export const indexCommercialByVoyage = (rows) => {
  const map = new Map();
  (rows || []).forEach((row) => {
    const bucket = commercialPaxBucket(row?.pax_type);
    if (!bucket) return;
    const code = String(row?.master_voyage || '').trim();
    if (!code) return;
    const cur = map.get(code) || { fitGuests: 0, groupGuests: 0, ticketEur: 0 };
    const guests = asNumber(row?.guest_count);
    if (bucket === 'FIT') cur.fitGuests += guests;
    if (bucket === 'Group') cur.groupGuests += guests;
    cur.ticketEur += asNumber(row?.gross_ticket_revenue_eur);
    map.set(code, cur);
  });
  return map;
};

const toSlices = (totals) => [...totals.entries()]
  .map(([label, value]) => ({ label, value: Math.round(value) }))
  .filter((slice) => slice.value > 0)
  .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

/** Channel, market, and FIT/Group slices for Distribution. */
export const buildCommercialDistribution = (rows, { marketDimension = 'market_group' } = {}) => {
  const channel = new Map();
  const market = new Map();
  const groupFit = new Map();
  (rows || []).forEach((row) => {
    const bucket = commercialPaxBucket(row?.pax_type);
    if (!bucket) return;
    const guests = asNumber(row?.guest_count);
    if (guests <= 0) return;
    const channelLabel = commercialChannelLabel(row?.agency_channel);
    const marketLabel = commercialMarketLabel(row, marketDimension);
    channel.set(channelLabel, (channel.get(channelLabel) || 0) + guests);
    market.set(marketLabel, (market.get(marketLabel) || 0) + guests);
    groupFit.set(bucket, (groupFit.get(bucket) || 0) + guests);
  });
  return {
    channelSlices: toSlices(channel),
    marketSlices: toSlices(market),
    groupFitSlices: toSlices(groupFit),
  };
};
