import {
  buildDistributionBundle,
  collapseTopNSlices,
  rollupAgencyTypeToChannel,
} from './distributionTransform.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message || 'Assertion failed');
};

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
    { agency_id: '1', guest_count: 100, group_id: null },
    { agency_id: '2', guest_count: 400, group_id: null },
    { agency_id: '3', guest_count: 100, group_id: 'G1' },
    { agency_id: '4', guest_count: 50, group_id: null },
    { agency_id: '5', guest_count: 40, group_id: null },
    { agency_id: '6', guest_count: 30, group_id: null },
    { agency_id: '7', guest_count: 20, group_id: null },
    { agency_id: '8', guest_count: 10, group_id: null },
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
assert(bundle.groupFitSlices.find((s) => s.label === 'Group')?.value === 100, 'group guests');
assert(bundle.meta.guestTotal === 750, 'guest total');

console.log('distributionTransform.test.mjs: ok');
