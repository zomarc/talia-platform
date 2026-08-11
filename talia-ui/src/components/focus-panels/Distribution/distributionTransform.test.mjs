import {
  buildDistributionBundle,
  buildDistributionBundleForSail,
  classifyPassengerType,
  collapseTopNSlices,
  indexDistributionBundlesBySailCode,
  rollupAgencyTypeToChannel,
} from './distributionTransform.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message || 'Assertion failed');
};

assert(classifyPassengerType({ pax_type: 'G' }) === 'Group', 'pax G');
assert(classifyPassengerType({ pax_type: 'F' }) === 'FIT', 'pax F');
assert(classifyPassengerType({ pax_type: 'group' }) === 'Group', 'pax group');
assert(classifyPassengerType({ pax_type: null, group_id: '99' }) === 'Group', 'group_id fallback');
assert(classifyPassengerType({ pax_type: 'F', group_id: '99' }) === 'FIT', 'pax_type wins over group_id');
assert(classifyPassengerType({}) === 'FIT', 'default FIT');

assert(rollupAgencyTypeToChannel('Travel Agency') === 'Agency', 'travel agency');
assert(rollupAgencyTypeToChannel('CLST DIRECT') === 'Direct', 'direct');
assert(rollupAgencyTypeToChannel('Tour Operator') === 'Tour Op', 'tour op');

const collapsed = collapseTopNSlices([
  { label: 'A', value: 100 },
  { label: 'B', value: 80 },
  { label: 'C', value: 60 },
  { label: 'D', value: 40 },
  { label: 'E', value: 30 },
  { label: 'F', value: 20 },
  { label: 'G', value: 10 },
], 5);
assert(collapsed.length === 6, 'top5 + others');
assert(collapsed[5].label === 'Others', 'others label');
assert(collapsed[5].value === 30, 'others sum');
assert(collapsed[5].others_count === 2, 'others count');

const bundle = buildDistributionBundle({
  reservations: [
    { agency_id: '1', guest_count: 100, pax_type: 'F' },
    { agency_id: '2', guest_count: 400, pax_type: 'F' },
    { agency_id: '3', guest_count: 100, pax_type: 'G' },
    { agency_id: '4', guest_count: 50, pax_type: 'F' },
    { agency_id: '5', guest_count: 40, pax_type: 'F' },
    { agency_id: '6', guest_count: 30, pax_type: 'F' },
    { agency_id: '7', guest_count: 20, pax_type: 'F' },
    { agency_id: '8', guest_count: 10, pax_type: 'F' },
  ],
  agencies: [
    { agency_id: '1', agency_type: 'Travel Agency', market: 'Spain' },
    { agency_id: '2', agency_type: 'CLST DIRECT', market: 'UK' },
    { agency_id: '3', agency_type: 'Tour Operator', market: 'Italy' },
    { agency_id: '4', agency_type: 'Travel Agency', market: 'GRC' },
    { agency_id: '5', agency_type: 'Travel Agency', market: 'USA' },
    { agency_id: '6', agency_type: 'Travel Agency', market: 'AUS' },
    { agency_id: '7', agency_type: 'Travel Agency', market: 'FRA' },
    { agency_id: '8', agency_type: 'Travel Agency', market: 'TUR' },
  ],
  marketRollUp: [
    { agency_market: 'Spain', new_budget_roll_up: 'Southern Europe', active_record_flag: 1 },
    { agency_market: 'Italy', new_budget_roll_up: 'Southern Europe', active_record_flag: 1 },
    { agency_market: 'GRC', new_budget_roll_up: 'Southern Europe', active_record_flag: 1 },
    { agency_market: 'UK', new_budget_roll_up: 'UK & Ireland', active_record_flag: 1 },
    { agency_market: 'USA', new_budget_roll_up: 'Americas', active_record_flag: 1 },
    { agency_market: 'AUS', new_budget_roll_up: 'ANZ', active_record_flag: 1 },
    { agency_market: 'FRA', new_budget_roll_up: 'Western Europe', active_record_flag: 1 },
    { agency_market: 'TUR', new_budget_roll_up: 'Eastern Med', active_record_flag: 1 },
  ],
});

assert(bundle.channelSlices.find((s) => s.label === 'Direct')?.value === 400, 'direct guests');
assert(bundle.marketSlices[0].label === 'UK & Ireland', 'top market group');
assert(bundle.marketSlices.find((s) => s.label === 'Southern Europe')?.value === 250, 'rolled southern europe');
assert(bundle.meta.marketGrouping === 'new_budget_roll_up', 'uses roll-up');
assert(bundle.meta.withMarketGroup === 8, 'all mapped to groups');
assert(bundle.groupFitSlices.find((s) => s.label === 'Group')?.value === 100, 'group guests via pax_type');
assert(bundle.meta.withPaxType === 8, 'pax_type coverage');
assert(bundle.meta.guestTotal === 750, 'guest total');

const byMarket = buildDistributionBundle({
  reservations: bundle.meta ? [
    { agency_id: '1', guest_count: 100, pax_type: 'F' },
    { agency_id: '2', guest_count: 400, pax_type: 'F' },
  ] : [],
  agencies: [
    { agency_id: '1', agency_type: 'Travel Agency', market: 'Spain' },
    { agency_id: '2', agency_type: 'CLST DIRECT', market: 'UK' },
  ],
  marketRollUp: [
    { agency_market: 'Spain', new_budget_roll_up: 'Southern Europe', active_record_flag: 1 },
    { agency_market: 'UK', new_budget_roll_up: 'UK & Ireland', active_record_flag: 1 },
  ],
  marketDimension: 'market',
});
assert(byMarket.marketSlices.find((s) => s.label === 'UK')?.value === 400, 'raw market UK');
assert(byMarket.meta.marketDimension === 'market', 'market dimension flag');

const sailScoped = buildDistributionBundleForSail({
  reservations: [
    { sail_code: 'M1', agency_id: '1', guest_count: 100, pax_type: 'G' },
    { sail_code: 'M1-SEG', agency_id: '2', guest_count: 50, pax_type: 'F' },
    { sail_code: 'OTHER', agency_id: '3', guest_count: 999, pax_type: 'G' },
  ],
  agencies: [
    { agency_id: '1', agency_type: 'Travel Agency', market: 'Spain' },
    { agency_id: '2', agency_type: 'CLST DIRECT', market: 'UK' },
    { agency_id: '3', agency_type: 'Tour Operator', market: 'Italy' },
  ],
  marketRollUp: [
    { agency_market: 'Spain', new_budget_roll_up: 'Southern Europe', active_record_flag: 1 },
    { agency_market: 'UK', new_budget_roll_up: 'UK & Ireland', active_record_flag: 1 },
  ],
  sailCodes: ['M1', 'M1-SEG'],
  capacityBerths: 500,
});
assert(sailScoped.meta.guestTotal === 150, 'sail filter guest total');
assert(sailScoped.groupFitSlices.find((s) => s.label === 'Group')?.value === 100, 'sail group guests');
assert(sailScoped.groupFitSlices.find((s) => s.label === 'FIT')?.value === 50, 'sail fit guests');
assert(sailScoped.meta.capacityBerths === 500, 'capacity override');
assert(sailScoped.meta.loadFactorPct === 30, 'LF from override');

const indexed = indexDistributionBundlesBySailCode({
  reservations: [
    { sail_code: 'M1', agency_id: '1', guest_count: 100, pax_type: 'G' },
    { sail_code: 'M1-SEG', agency_id: '2', guest_count: 50, pax_type: 'F' },
  ],
  agencies: [
    { agency_id: '1', agency_type: 'Travel Agency', market: 'Spain' },
    { agency_id: '2', agency_type: 'CLST DIRECT', market: 'UK' },
  ],
  marketRollUp: [
    { agency_market: 'Spain', new_budget_roll_up: 'Southern Europe', active_record_flag: 1 },
    { agency_market: 'UK', new_budget_roll_up: 'UK & Ireland', active_record_flag: 1 },
  ],
  sailCodeList: ['M1'],
  capacityBySail: { M1: 500 },
  filterSailCodesBySail: { M1: ['M1', 'M1-SEG'] },
});
assert(indexed.get('M1')?.meta?.guestTotal === 150, 'indexed master includes segments');
assert(indexed.get('M1')?.meta?.capacityBerths === 500, 'indexed capacity');
assert(indexed.get('M1')?.groupFitSlices.find((s) => s.label === 'Group')?.value === 100, 'indexed group');

console.log('distributionTransform.test.mjs: ok');
