/**
 * Seaware ship_cabin_reserve classification and sail-window overlap.
 * Offsale types reduce sellable capacity. Segment / constrained do not.
 * Keep in sync with public.cabin_reserve_kind() in talia-server migrations.
 */

const toDateKey = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

export const CABIN_RESERVE_KIND = {
  OFFSALE: 'offsale',
  CONSTRAINED: 'constrained',
  SEGMENT: 'segment',
};

export const OFFSALE_RESERVE_TYPES = new Set([
  'RESERVED',
  'BROKEN',
  'OUT OF ORDER',
  'EMERGENCY',
  'WAREHOUSE',
  'CREW',
  'OVER',
]);

const KIND_RANK = {
  [CABIN_RESERVE_KIND.OFFSALE]: 3,
  [CABIN_RESERVE_KIND.CONSTRAINED]: 2,
  [CABIN_RESERVE_KIND.SEGMENT]: 1,
};

export const normalizeCabinNumber = (value) => String(value || '').trim().toUpperCase();

export const classifyCabinReserveType = (reserveType) => {
  const type = String(reserveType || '').trim().toUpperCase();
  if (!type) return CABIN_RESERVE_KIND.SEGMENT;
  if (OFFSALE_RESERVE_TYPES.has(type)) return CABIN_RESERVE_KIND.OFFSALE;
  if (type === 'HANDICAP' || type.startsWith('VIP')) return CABIN_RESERVE_KIND.CONSTRAINED;
  return CABIN_RESERVE_KIND.SEGMENT;
};

export const reserveWindowOverlapsDate = (row, dateKey) => {
  const day = toDateKey(dateKey);
  if (!day) return true;
  const from = toDateKey(row?.sail_date_from);
  const to = toDateKey(row?.sail_date_to);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
};

const pickPreferredReserve = (current, next) => {
  if (!current) return next;
  const currentRank = KIND_RANK[current.kind] || 0;
  const nextRank = KIND_RANK[next.kind] || 0;
  return nextRank > currentRank ? next : current;
};

/**
 * Distinct cabins overlapping a ship × itinerary date, preferring offsale over
 * constrained over segment when a cabin has multiple reserve rows.
 */
export const indexCabinReservesForSail = (rows = [], { shipCode = null, dateKey = null } = {}) => {
  const ship = String(shipCode || '').trim();
  const map = new Map();
  (rows || []).forEach((row) => {
    if (ship && String(row?.ship_code || '').trim() !== ship) return;
    if (!reserveWindowOverlapsDate(row, dateKey)) return;
    const cabinKey = normalizeCabinNumber(row?.cabin_number);
    if (!cabinKey) return;
    const kind = classifyCabinReserveType(row?.reserve_type);
    const entry = {
      cabin_number: String(row?.cabin_number || '').trim(),
      reserve_type: String(row?.reserve_type || '').trim() || null,
      kind,
      comments: row?.comments || null,
    };
    map.set(cabinKey, pickPreferredReserve(map.get(cabinKey), entry));
  });
  return map;
};

export const summarizeCabinReserves = (index) => {
  let offsale = 0;
  let constrained = 0;
  let segment = 0;
  (index || new Map()).forEach((entry) => {
    if (entry?.kind === CABIN_RESERVE_KIND.OFFSALE) offsale += 1;
    else if (entry?.kind === CABIN_RESERVE_KIND.CONSTRAINED) constrained += 1;
    else segment += 1;
  });
  return { offsale, constrained, segment, total: offsale + constrained + segment };
};
