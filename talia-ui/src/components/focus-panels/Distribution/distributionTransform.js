/**
 * Distribution aggregations — guests by channel, market/market_group, Group/FIT.
 * Aligns with reservation booking curve: active reservation facts + shared roll-up.
 */

import {
  indexMarketRollUpByAgencyMarket,
  normalizeMarketDimension,
  resolveMarketGroup,
} from '../../../lib/marketRollup.js';
import {
  buildGroupFitSlices,
  DEFAULT_BOOKED_COMPOSITION,
  normalizeBookedComposition,
} from '../../../lib/bookedComposition.js';
import {
  CHANNEL_ORDER,
  classifyPassengerType,
  rollupAgencyTypeToChannel,
} from '../../../lib/reservationDimensions.js';
import { summarizeCabinOccupancyBerths } from '../CapacityValidation/capacityValidationTransform.js';

export { CHANNEL_ORDER, classifyPassengerType, rollupAgencyTypeToChannel };
export const MARKET_TOP_N = 5;

const asNumber = (value) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

const agencyKey = (id) => (id == null || id === '' ? null : String(id).trim());

export const isActiveReservation = (row) => {
  const status = String(row?.res_status || '').toUpperCase();
  return status !== 'CX' && status !== 'CANCELLED' && status !== 'CANCELED';
};

export const indexAgenciesById = (agencies = []) => {
  const map = new Map();
  (agencies || []).forEach((row) => {
    const id = agencyKey(row?.agency_id);
    if (!id || map.has(id)) return;
    map.set(id, row);
  });
  return map;
};

/**
 * Voyage berth capacity for LF indicators.
 * Prefer reference sail; never sum master + segments (same physical berths).
 */
export const resolveDistributionCapacity = (
  occupancyRows = [],
  { sailCodes = [], referenceSailCode = null } = {}
) => {
  const codes = (sailCodes || []).map((c) => String(c).trim()).filter(Boolean);
  const preferred = referenceSailCode
    ? String(referenceSailCode).trim()
    : (codes[0] || null);

  const fromCapacityView = (code) => {
    if (!code) return null;
    const rows = (occupancyRows || []).filter(
      (row) => String(row?.sail_code || '').trim() === code
        && (row?.sellable_berths != null || row?.nameplate_berths != null)
    );
    if (!rows.length) return null;
    let peakSellable = 0;
    let peakCabins = 0;
    let peakDate = null;
    rows.forEach((row) => {
      const sellable = Number(row?.sellable_berths ?? row?.berth_capacity) || 0;
      if (sellable > peakSellable) {
        peakSellable = sellable;
        peakCabins = Number(row?.sellable_cabins ?? row?.total_cabins) || 0;
        peakDate = row?.date || row?.sail_itinerary_date || null;
      }
    });
    if (!(peakSellable > 0)) return null;
    return {
      capacityBerths: peakSellable,
      capacityCabins: peakCabins || null,
      sourceSail: code,
      peakDate,
    };
  };

  const fromCode = (code) => {
    if (!code) return null;
    const fromView = fromCapacityView(code);
    if (fromView) return fromView;
    const summary = summarizeCabinOccupancyBerths(occupancyRows, { sailCode: code });
    if (summary?.capacity == null) return null;
    return {
      capacityBerths: summary.capacity,
      capacityCabins: summary.cabins,
      sourceSail: code,
      peakDate: summary.peakDate || null,
    };
  };

  const preferredHit = fromCode(preferred);
  if (preferredHit) return preferredHit;

  let best = null;
  codes.forEach((code) => {
    const hit = fromCode(code);
    if (!hit) return;
    if (!best || hit.capacityBerths > best.capacityBerths) best = hit;
  });
  return best;
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

const withCapacityShare = (slices, capacityBerths) => {
  if (capacityBerths == null || !(capacityBerths > 0)) {
    return (slices || []).map((s) => ({ ...s, capacityPct: null }));
  }
  return (slices || []).map((s) => ({
    ...s,
    capacityPct: Math.round(((Number(s.value) || 0) / capacityBerths) * 1000) / 10,
  }));
};

/**
 * Join reservations to agencies and roll up guest counts.
 * @param {'market'|'market_group'} marketDimension — from global header criteria
 * @param {number|null} [capacityBerths] — optional override (skips occupancy resolve)
 */
export const buildDistributionBundle = ({
  reservations = [],
  agencies = [],
  marketRollUp = [],
  occupancyRows = [],
  sailCodes = [],
  referenceSailCode = null,
  marketDimension = 'market_group',
  bookedComposition = DEFAULT_BOOKED_COMPOSITION,
  allocRows = [],
  capacityBerths: capacityBerthsOverride = undefined,
} = {}) => {
  const dim = normalizeMarketDimension(marketDimension);
  const compositionMode = normalizeBookedComposition(bookedComposition);
  const agencyById = indexAgenciesById(agencies);
  const rollUpIndex = indexMarketRollUpByAgencyMarket(marketRollUp);
  const channelTotals = new Map();
  const marketTotals = new Map();
  let bookingCount = 0;
  let guestTotal = 0;
  let withAgency = 0;
  let withMarket = 0;
  let withMarketGroup = 0;
  let withGroupSignal = 0;
  let withPaxType = 0;

  (reservations || []).forEach((row) => {
    if (!isActiveReservation(row)) return;
    const guests = asNumber(row?.guest_count);
    if (guests <= 0) return;
    bookingCount += 1;
    guestTotal += guests;

    const agency = agencyById.get(agencyKey(row?.agency_id));
    if (agency) withAgency += 1;

    const channel = rollupAgencyTypeToChannel(agency?.agency_type);
    channelTotals.set(channel, (channelTotals.get(channel) || 0) + guests);

    const marketRaw = String(row?.agency_market || agency?.market || '').trim();
    const marketGroup = resolveMarketGroup(marketRaw, rollUpIndex);
    if (marketRaw) withMarket += 1;
    if (marketGroup) withMarketGroup += 1;
    const marketLabel = dim === 'market'
      ? (marketRaw || 'Unknown')
      : (marketGroup || marketRaw || 'Unknown');
    marketTotals.set(marketLabel, (marketTotals.get(marketLabel) || 0) + guests);

    if (String(row?.pax_type || '').trim()) withPaxType += 1;
    if (classifyPassengerType(row) === 'Group') withGroupSignal += 1;
  });

  const hasOverride = capacityBerthsOverride !== undefined;
  const capacity = hasOverride
    ? null
    : resolveDistributionCapacity(occupancyRows, {
      sailCodes,
      referenceSailCode,
    });
  const capacityBerths = hasOverride
    ? (capacityBerthsOverride != null && Number(capacityBerthsOverride) > 0
      ? Number(capacityBerthsOverride)
      : null)
    : (capacity?.capacityBerths ?? null);
  const loadFactorPct = capacityBerths > 0
    ? Math.round((guestTotal / capacityBerths) * 1000) / 10
    : null;

  const marketAll = toSortedSlices(marketTotals);
  const groupFit = buildGroupFitSlices({
    reservations,
    allocRows,
    mode: compositionMode,
    capacityBerths,
  });

  return {
    channelSlices: withCapacityShare(
      toSortedSlices(channelTotals, CHANNEL_ORDER),
      capacityBerths
    ),
    marketSlices: withCapacityShare(
      collapseTopNSlices(marketAll, MARKET_TOP_N),
      capacityBerths
    ),
    marketSliceCount: marketAll.length,
    groupFitSlices: groupFit.slices,
    meta: {
      bookingCount,
      guestTotal,
      withAgency,
      withMarket,
      withMarketGroup,
      withGroupSignal,
      withPaxType,
      marketTopN: MARKET_TOP_N,
      marketDimension: dim,
      marketGrouping: dim === 'market'
        ? 'agency.market'
        : (rollUpIndex.size > 0 ? 'new_budget_roll_up' : 'agency.market'),
      capacityBerths,
      capacityCabins: capacity?.capacityCabins ?? null,
      capacitySourceSail: capacity?.sourceSail
        || (hasOverride ? (referenceSailCode || null) : null),
      loadFactorPct,
      availableBerths: capacityBerths != null
        ? Math.max(0, capacityBerths - guestTotal)
        : null,
      bookedComposition: compositionMode,
      groupFitLabel: groupFit.meta.groupFitLabel,
      fitGuests: groupFit.meta.fitGuests,
      groupBookedGuests: groupFit.meta.groupBookedGuests,
      groupHeldExpected: groupFit.meta.groupHeldExpected,
      probabilitySource: groupFit.meta.probabilitySource,
      groupFitCoverageNote: withPaxType === 0
        ? (withGroupSignal > 0
          ? `No pax_type — Group inferred from group_id on ${withGroupSignal} of ${bookingCount} bookings.`
          : 'No pax_type on reservations — Group/FIT defaults to FIT until Fact_Reservation enrichment.')
        : [
          withPaxType < bookingCount
            ? `pax_type on ${withPaxType} of ${bookingCount} bookings.`
            : null,
          compositionMode !== 'booked_only' && groupFit.meta.groupHeldExpected > 0
            ? `Group held expected ${groupFit.meta.groupHeldExpected} (source alloc probability).`
            : null,
        ].filter(Boolean).join(' ') || null,
    },
  };
};

const normalizeSailCodeSet = (sailCodes = []) => {
  const set = new Set();
  (sailCodes || []).forEach((code) => {
    const normalized = String(code || '').trim();
    if (normalized) set.add(normalized);
  });
  return set;
};

/** Filter reservations to sail codes, then build a distribution bundle. */
export const buildDistributionBundleForSail = ({
  reservations = [],
  sailCodes = [],
  ...rest
} = {}) => {
  const codeSet = normalizeSailCodeSet(sailCodes);
  const filtered = codeSet.size === 0
    ? []
    : (reservations || []).filter((row) => (
      codeSet.has(String(row?.sail_code || '').trim())
    ));
  return buildDistributionBundle({
    ...rest,
    reservations: filtered,
    sailCodes: [...codeSet],
  });
};

/**
 * Batch-precompute distribution bundles keyed by master sail_code.
 * @param {string[]} sailCodeList — master sail codes
 * @param {Record<string, number>|Map} [capacityBySail]
 * @param {Record<string, string[]>|Map} [filterSailCodesBySail] — master → codes to include in mix
 */
export const indexDistributionBundlesBySailCode = ({
  reservations = [],
  agencies = [],
  marketRollUp = [],
  sailCodeList = [],
  capacityBySail = null,
  filterSailCodesBySail = null,
  marketDimension = 'market_group',
  bookedComposition = DEFAULT_BOOKED_COMPOSITION,
  allocRowsByScope = null,
  masterScopeBySail = null,
} = {}) => {
  const bySail = new Map();
  (reservations || []).forEach((row) => {
    const code = String(row?.sail_code || '').trim();
    if (!code) return;
    if (!bySail.has(code)) bySail.set(code, []);
    bySail.get(code).push(row);
  });

  const capacityLookup = (code) => {
    if (!capacityBySail) return undefined;
    if (capacityBySail instanceof Map) return capacityBySail.get(code);
    return capacityBySail[code];
  };

  const filterLookup = (code) => {
    if (!filterSailCodesBySail) return null;
    if (filterSailCodesBySail instanceof Map) return filterSailCodesBySail.get(code);
    return filterSailCodesBySail[code];
  };

  const scopeLookup = (code) => {
    if (!masterScopeBySail) return null;
    if (masterScopeBySail instanceof Map) return masterScopeBySail.get(code);
    return masterScopeBySail[code];
  };

  const allocLookup = (scopeKey) => {
    if (!scopeKey || !allocRowsByScope) return [];
    if (allocRowsByScope instanceof Map) return allocRowsByScope.get(scopeKey) || [];
    return allocRowsByScope[scopeKey] || [];
  };

  const result = new Map();
  (sailCodeList || []).forEach((entry) => {
    const masterCode = String(
      (entry && typeof entry === 'object' ? (entry.sailCode || entry.sail_code) : entry) || ''
    ).trim();
    if (!masterCode) return;

    const filterCodes = (() => {
      if (entry && typeof entry === 'object' && Array.isArray(entry.filterSailCodes)) {
        return [...normalizeSailCodeSet(entry.filterSailCodes)];
      }
      const fromLookup = filterLookup(masterCode);
      if (Array.isArray(fromLookup) && fromLookup.length) {
        return [...normalizeSailCodeSet(fromLookup)];
      }
      return [masterCode];
    })();

    const rows = [];
    filterCodes.forEach((code) => {
      const list = bySail.get(code);
      if (list?.length) rows.push(...list);
    });

    const capacityOverride = entry && typeof entry === 'object' && entry.capacityBerths != null
      ? entry.capacityBerths
      : capacityLookup(masterCode);

    const scope = scopeLookup(masterCode);
    const allocRows = allocLookup(scope?.scopeKey || null);

    result.set(masterCode, buildDistributionBundle({
      reservations: rows,
      agencies,
      marketRollUp,
      sailCodes: filterCodes,
      referenceSailCode: masterCode,
      marketDimension,
      bookedComposition,
      allocRows,
      capacityBerths: capacityOverride !== undefined ? capacityOverride : null,
    }));
  });

  return result;
};

export default {
  CHANNEL_ORDER,
  MARKET_TOP_N,
  rollupAgencyTypeToChannel,
  classifyPassengerType,
  isActiveReservation,
  collapseTopNSlices,
  resolveDistributionCapacity,
  buildDistributionBundle,
  buildDistributionBundleForSail,
  indexDistributionBundlesBySailCode,
};
