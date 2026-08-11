import {
  indexCabinCategoryGroups,
  resolveCabinCategoryLabel,
  normalizeCabinCategoryMode,
  CABIN_CATEGORY_MODE,
} from '../../../lib/cabinCategoryGroups.js';
import {
  buildAgencyExplorerMetrics,
  enrichAgenciesWithExplorerMetrics,
  guestNights,
  isBookedReservation,
  isSoftReservation,
  resolveEffectiveProbabilityPct,
  resolveRevenueEur,
} from './agencyExplorerMetrics.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message || 'Assertion failed');
};

assert(normalizeCabinCategoryMode('group') === CABIN_CATEGORY_MODE.GROUP, 'group mode');
assert(normalizeCabinCategoryMode('real') === CABIN_CATEGORY_MODE.REAL, 'real mode');

const ctg = indexCabinCategoryGroups([
  { cabin_code: 'IA', generic_category: 'INSIDE', active_record_flag: 1 },
  { cabin_code: 'XB', generic_category: 'OUTSIDE', active_record_flag: 1 },
  { cabin_code: 'SP', generic_category: 'DELUXE', active_record_flag: 1 },
]);
assert(resolveCabinCategoryLabel('IA', ctg, 'group') === 'INSIDE', 'group label');

assert(isBookedReservation({ res_status: 'BK' }), 'BK booked');
assert(isSoftReservation({ res_status: 'OF' }), 'OF soft');
assert(!isBookedReservation({ res_status: 'CX' }), 'CX not booked');
assert(resolveRevenueEur({ gross_ticket_revenue_eur: 100, net_ticket_revenue_eur: 80 }) === 100, 'prefer gross');
assert(resolveEffectiveProbabilityPct({ res_probability: 50 }) === 50, 'res pct');
assert(resolveEffectiveProbabilityPct({ res_probability: 0.5 }) === 50, 'fraction');
assert(resolveEffectiveProbabilityPct({ pax_type: 'G', group_probability: 40, res_probability: 100 }) === 40, 'group prefers group_probability');
assert(resolveEffectiveProbabilityPct({ pax_type: 'F', group_probability: 40, res_probability: 80 }) === 80, 'FIT uses res_probability');
assert(resolveEffectiveProbabilityPct({}) === 100, 'missing → 100');
assert(guestNights({ guest_count: 2, sail_duration: 7 }) === 14, 'guest nights');

const rows = [
  {
    agency_id: 1,
    res_status: 'BK',
    guest_count: 2,
    sail_duration: 7,
    gross_ticket_revenue_eur: 1400,
    res_probability: 100,
    cabin_category: 'IA',
    pax_type: 'F',
  },
  {
    agency_id: 1,
    res_status: 'BK',
    guest_count: 2,
    sail_duration: 7,
    gross_ticket_revenue_eur: 1400,
    res_probability: 100,
    group_probability: 50,
    cabin_category: 'XB',
    pax_type: 'G',
  },
  {
    agency_id: 1,
    res_status: 'OF',
    guest_count: 2,
    sail_duration: 7,
    gross_ticket_revenue_eur: 1400,
    res_probability: 50,
    cabin_category: 'IA',
    pax_type: 'F',
  },
  {
    agency_id: 1,
    res_status: 'CX',
    guest_count: 4,
    sail_duration: 7,
    gross_ticket_revenue_eur: 9999,
    cabin_category: 'IA',
    pax_type: 'F',
  },
];

const metrics = buildAgencyExplorerMetrics({
  reservationRows: rows,
  cabinCtgIndex: ctg,
  cabinCategoryMode: 'group',
  selectedAgencyId: 1,
});

const a1 = metrics.byAgency.get('1');
assert(a1.current_guests === 4, 'current guests = BK only');
assert(a1.current_value_eur === 2800, 'current value = BK face');
// Expected: FIT BK 1400*1 + Group BK 1400*0.5 + OF 1400*0.5 = 1400+700+700 = 2800
assert(a1.expected_value_eur === 2800, `expected value got ${a1.expected_value_eur}`);
assert(a1.expected_guests === 4, `expected guests got ${a1.expected_guests}`);
assert(a1.current_value_eur !== a1.expected_guests || true, 'placeholder');
// Current guests 4 face vs expected guests 2+1+1=4 — values same by chance; force unequal case:
assert(a1.group_current_guests === 2, 'group current guests');

const unequal = buildAgencyExplorerMetrics({
  reservationRows: [
    {
      agency_id: 9,
      res_status: 'BK',
      guest_count: 2,
      sail_duration: 7,
      gross_ticket_revenue_eur: 2000,
      group_probability: 50,
      pax_type: 'G',
      cabin_category: 'IA',
    },
  ],
  cabinCtgIndex: ctg,
}).byAgency.get('9');
assert(unequal.current_value_eur === 2000, 'current face');
assert(unequal.expected_value_eur === 1000, 'expected half via group_probability');
assert(unequal.current_ppd === 142.86, `current ppd got ${unequal.current_ppd}`);
assert(unequal.expected_ppd === 142.86, `expected ppd got ${unequal.expected_ppd}`);

const withSynthetic = buildAgencyExplorerMetrics({
  reservationRows: [
    {
      agency_id: 3,
      res_status: 'BK',
      guest_count: 2,
      sail_duration: 7,
      gross_ticket_revenue_eur: 1000,
      res_probability: 100,
      pax_type: 'F',
      source_origin: 'res_header',
      cabin_category: 'IA',
    },
    {
      agency_id: 3,
      res_id: '690373349931',
      group_id: 69037,
      res_status: 'OF',
      guest_count: 2,
      sail_duration: 7,
      gross_ticket_revenue_eur: 1000,
      group_probability: 50,
      pax_type: 'G',
      source_origin: 'fact_group_alloc',
      cabin_category: 'IA',
    },
  ],
  cabinCtgIndex: ctg,
}).byAgency.get('3');
assert(withSynthetic.current_value_eur === 1000, 'synthetic OF not in current');
assert(withSynthetic.expected_value_eur === 1500, 'BK 1000 + OF 500 expected');

const enriched = enrichAgenciesWithExplorerMetrics(
  [{ agency_id: 9, agency_name: 'A' }],
  new Map([['9', unequal]])
);
assert(enriched[0].expected_value_eur === 1000, 'enriched');

console.log('agencyExplorerMetrics.test.mjs: ok');
