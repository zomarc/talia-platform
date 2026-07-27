/**
 * Distribution aggregations — guests by channel (agency type rollup) and market group.
 * Join booking agency_id → agency.market → market_roll_up.new_budget_roll_up.
 * Never invent channel from source_code.
 */

import {
  indexMarketRollUpByAgencyMarket,
  resolveMarketGroup,
} from '../../../lib/marketRollup.js';

export const CHANNEL_ORDER = ['Agency', 'Direct', 'Tour Op', 'Other'];
export const MARKET_TOP_N = 5;

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

const asNumber = (value) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

const agencyKey = (id) => (id == null || id === '' ? null : String(id).trim());

export const indexAgenciesById = (agencies = []) => {
  const map = new Map();
  (agencies || []).forEach((row) => {
    const id = agencyKey(row?.agency_id);
    if (!id || map.has(id)) return;
    map.set(id, row);
  });
  return map;
};

const toSortedSlices = (map, preferredOrder = null) => {
  const entries = [...map.entries()]
    .filter(([, value]) => value > 0)
    .map(([label, value]) => ({ label, value }));
  if (preferredOrder) {
    entries.sort((a, b) => {
      const ai = preferredOrder.indexOf(a.label);
      const bi = preferredOrder.indexOf(b.label);
      const ao = ai === -1 ? preferredOrder.length : ai;
      const bo = bi === -1 ? preferredOrder.length : bi;
      if (ao !== bo) return ao - bo;
      return b.value - a.value;
    });
    return entries;
  }
  return entries.sort((a, b) => b.value - a.value);
};

/**
 * Keep top N slices by value; roll the rest into "Others".
 * Preserves descending order; "Others" always last when present.
 */
export const collapseTopNSlices = (slices = [], topN = MARKET_TOP_N) => {
  const sorted = [...(slices || [])]
    .filter((s) => s && Number(s.value) > 0)
    .sort((a, b) => b.value - a.value);
  if (sorted.length <= topN) return sorted;
  const head = sorted.slice(0, topN);
  const rest = sorted.slice(topN);
  const othersValue = rest.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  if (othersValue <= 0) return head;
  return [...head, { label: 'Others', value: othersValue, others_count: rest.length }];
};

/**
 * Join reservations to agencies and roll up guest counts.
 * Market chart uses market_roll_up.new_budget_roll_up (falls back to agency.market).
 * Group/FIT: group_id present → Group; else FIT. Data coverage is thin — flag in meta.
 */
export const buildDistributionBundle = ({
  reservations = [],
  agencies = [],
  marketRollUp = [],
} = {}) => {
  const agencyById = indexAgenciesById(agencies);
  const rollUpIndex = indexMarketRollUpByAgencyMarket(marketRollUp);
  const channelTotals = new Map();
  const marketTotals = new Map();
  const groupFitTotals = new Map([['Group', 0], ['FIT', 0]]);
  let bookingCount = 0;
  let guestTotal = 0;
  let withAgency = 0;
  let withMarket = 0;
  let withMarketGroup = 0;
  let withGroupId = 0;

  (reservations || []).forEach((row) => {
    const guests = asNumber(row?.guest_count);
    if (guests <= 0) return;
    bookingCount += 1;
    guestTotal += guests;

    const agency = agencyById.get(agencyKey(row?.agency_id));
    if (agency) withAgency += 1;

    const channel = rollupAgencyTypeToChannel(agency?.agency_type);
    channelTotals.set(channel, (channelTotals.get(channel) || 0) + guests);

    const marketRaw = String(agency?.market || '').trim();
    const marketGroup = resolveMarketGroup(marketRaw, rollUpIndex);
    const market = marketGroup || marketRaw || 'Unknown';
    if (marketRaw) withMarket += 1;
    if (marketGroup) withMarketGroup += 1;
    marketTotals.set(market, (marketTotals.get(market) || 0) + guests);

    const hasGroup = row?.group_id != null && String(row.group_id).trim() !== '';
    if (hasGroup) {
      withGroupId += 1;
      groupFitTotals.set('Group', (groupFitTotals.get('Group') || 0) + guests);
    } else {
      groupFitTotals.set('FIT', (groupFitTotals.get('FIT') || 0) + guests);
    }
  });

  const marketAll = toSortedSlices(marketTotals);

  return {
    channelSlices: toSortedSlices(channelTotals, CHANNEL_ORDER),
    marketSlices: collapseTopNSlices(marketAll, MARKET_TOP_N),
    marketSliceCount: marketAll.length,
    groupFitSlices: toSortedSlices(groupFitTotals, ['Group', 'FIT']),
    meta: {
      bookingCount,
      guestTotal,
      withAgency,
      withMarket,
      withMarketGroup,
      withGroupId,
      marketTopN: MARKET_TOP_N,
      marketGrouping: rollUpIndex.size > 0 ? 'new_budget_roll_up' : 'agency.market',
      groupFitCoverageNote: withGroupId === 0
        ? 'No group_id on current bookings — Group/FIT split is not reliable until FACT enrichment.'
        : `Only ${withGroupId} of ${bookingCount} bookings have group_id; unconfirmed group holds need FACT_RESERVATION review.`,
    },
  };
};

export default {
  CHANNEL_ORDER,
  MARKET_TOP_N,
  rollupAgencyTypeToChannel,
  collapseTopNSlices,
  buildDistributionBundle,
};
