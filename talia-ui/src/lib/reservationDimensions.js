/**
 * Shared reservation dimension helpers for Distribution + Reservation booking curve.
 * Keep labels/order/colors identical across both views of the same reservation facts.
 */

/** Keep in sync with PROFILE_SERIES_PALETTE in chartConfig.js */
const SERIES_PALETTE = [
  '#7aa2f7',
  '#9ece6a',
  '#e0af68',
  '#bb9af7',
  '#f7768e',
  '#73daca',
  '#ff9e64',
  '#c0caf5',
  '#b08d57',
  '#64ffda',
];

export const CHANNEL_ORDER = ['Agency', 'Direct', 'Tour Op', 'Other'];
export const PAX_TYPE_ORDER = ['Group', 'FIT'];

/** Stable palette slots for known dimension keys (channel + passenger type). */
const STABLE_COLOR_INDEX = {
  Agency: 0,
  Direct: 1,
  'Tour Op': 2,
  Other: 3,
  Group: 0,
  FIT: 1,
};

/** Map Dim_Agency.agency_type → business channel rollup. */
export const rollupAgencyTypeToChannel = (agencyType) => {
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
};

/** Prefer pax_type (F/G from Fact_Reservation); fall back to group_id only if pax_type missing. */
export const classifyPassengerType = (row) => {
  const pax = String(row?.pax_type || '').trim().toUpperCase();
  if (pax.startsWith('G') || pax === 'GROUP') return 'Group';
  if (pax.startsWith('F') || pax === 'FIT') return 'FIT';
  if (row?.group_id != null && String(row.group_id).trim() !== '') return 'Group';
  return 'FIT';
};

const hashKey = (key) => {
  const s = String(key || '');
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) + h) + s.charCodeAt(i);
  }
  return Math.abs(h);
};

/**
 * Stable color for a dimension key so Distribution slices and profile series match.
 */
export const colorForDimensionKey = (key, palette = SERIES_PALETTE) => {
  const list = palette?.length ? palette : SERIES_PALETTE;
  const known = STABLE_COLOR_INDEX[String(key || '')];
  if (known != null) return list[known % list.length];
  return list[hashKey(key) % list.length];
};

export const SERIES_MODE_OPTIONS = [
  { key: 'market', label: 'Market' },
  { key: 'channel', label: 'Channel (distribution)' },
  { key: 'pax_type', label: 'Passenger type (Group/FIT)' },
];

export const normalizeSeriesMode = (value) => {
  if (value === 'channel' || value === 'pax_type') return value;
  return 'market';
};

export default {
  CHANNEL_ORDER,
  PAX_TYPE_ORDER,
  SERIES_MODE_OPTIONS,
  rollupAgencyTypeToChannel,
  classifyPassengerType,
  colorForDimensionKey,
  normalizeSeriesMode,
};
