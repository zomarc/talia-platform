/**
 * Distribution aggregations — guests by channel (agency type rollup) and market.
 * Join booking agency_id → agency dimension; never invent channel from source_code.
 */

export const CHANNEL_ORDER = ['Agency', 'Direct', 'Tour Op', 'Other'];

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

/**
 * Join reservations to agencies and roll up guest counts.
 * Group/FIT: group_id present → Group; else FIT. Data coverage is thin — flag in meta.
 */
export const buildDistributionBundle = ({ reservations = [], agencies = [] } = {}) => {
  const agencyById = indexAgenciesById(agencies);
  const channelTotals = new Map();
  const marketTotals = new Map();
  const groupFitTotals = new Map([['Group', 0], ['FIT', 0]]);
  let bookingCount = 0;
  let guestTotal = 0;
  let withAgency = 0;
  let withGroupId = 0;

  (reservations || []).forEach((row) => {
    const guests = asNumber(row?.guest_count);
    if (guests <= 0 && row?.guest_count == null) {
      // Still count the booking row as 1 guest unit when guest_count missing? Prefer skip zero.
    }
    const units = guests > 0 ? guests : 0;
    bookingCount += 1;
    guestTotal += units;

    const agency = agencyById.get(agencyKey(row?.agency_id));
    if (agency) withAgency += 1;

    const channel = rollupAgencyTypeToChannel(agency?.agency_type);
    channelTotals.set(channel, (channelTotals.get(channel) || 0) + units);

    const market = String(agency?.market || '').trim() || 'Unknown';
    marketTotals.set(market, (marketTotals.get(market) || 0) + units);

    const hasGroup = row?.group_id != null && String(row.group_id).trim() !== '';
    if (hasGroup) {
      withGroupId += 1;
      groupFitTotals.set('Group', (groupFitTotals.get('Group') || 0) + units);
    } else {
      groupFitTotals.set('FIT', (groupFitTotals.get('FIT') || 0) + units);
    }
  });

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

  return {
    channelSlices: toSortedSlices(channelTotals, CHANNEL_ORDER),
    marketSlices: toSortedSlices(marketTotals),
    groupFitSlices: toSortedSlices(groupFitTotals, ['Group', 'FIT']),
    meta: {
      bookingCount,
      guestTotal,
      withAgency,
      withGroupId,
      groupFitCoverageNote: withGroupId === 0
        ? 'No group_id on current bookings — Group/FIT split is not reliable until FACT enrichment.'
        : `Only ${withGroupId} of ${bookingCount} bookings have group_id; unconfirmed group holds need FACT_RESERVATION review.`,
    },
  };
};

export default {
  CHANNEL_ORDER,
  rollupAgencyTypeToChannel,
  buildDistributionBundle,
};
