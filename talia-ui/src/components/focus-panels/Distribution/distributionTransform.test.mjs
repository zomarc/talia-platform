import { buildDistributionBundle, rollupAgencyTypeToChannel } from './distributionTransform.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message || 'Assertion failed');
};

assert(rollupAgencyTypeToChannel('Travel Agency') === 'Agency', 'travel agency');
assert(rollupAgencyTypeToChannel('CLST DIRECT') === 'Direct', 'direct');
assert(rollupAgencyTypeToChannel('Tour Operator') === 'Tour Op', 'tour op');
assert(rollupAgencyTypeToChannel('Weird') === 'Other', 'other');

const bundle = buildDistributionBundle({
  reservations: [
    { agency_id: '1', guest_count: 100, group_id: null },
    { agency_id: '2', guest_count: 400, group_id: null },
    { agency_id: '3', guest_count: 100, group_id: 'G1' },
  ],
  agencies: [
    { agency_id: '1', agency_type: 'Travel Agency', market: 'Spain' },
    { agency_id: '2', agency_type: 'CLST DIRECT', market: 'UK' },
    { agency_id: '3', agency_type: 'Tour Operator', market: 'Italy' },
  ],
});

assert(bundle.channelSlices.find((s) => s.label === 'Direct')?.value === 400, 'direct guests');
assert(bundle.marketSlices.find((s) => s.label === 'UK')?.value === 400, 'uk market');
assert(bundle.groupFitSlices.find((s) => s.label === 'Group')?.value === 100, 'group guests');
assert(bundle.meta.guestTotal === 600, 'guest total');

console.log('distributionTransform.test.mjs: ok');
