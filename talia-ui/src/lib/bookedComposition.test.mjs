import {
  BOOKED_COMPOSITION,
  buildGroupFitSlices,
  isGroupHoldAlloc,
  normalizeBookedComposition,
  resolveGroupHoldProbability,
  sumGroupHeldExpected,
} from './bookedComposition.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message || 'Assertion failed');
};

assert(normalizeBookedComposition(null) === BOOKED_COMPOSITION.GROUP_FIT_EXPECTED, 'default mode');
assert(normalizeBookedComposition('booked_only') === BOOKED_COMPOSITION.BOOKED_ONLY, 'booked_only');
assert(normalizeBookedComposition('three_way') === BOOKED_COMPOSITION.THREE_WAY, 'three_way');

assert(resolveGroupHoldProbability({ probability: 75 }) === 75, 'prob percent');
assert(resolveGroupHoldProbability({ probability: 0.8 }) === 80, 'prob fraction');
assert(resolveGroupHoldProbability({}) === 100, 'prob default');

assert(isGroupHoldAlloc({
  allocation_owner_type: 'GROUP',
  inventory_request_type: 'GTY ONLY',
}) === true, 'gty hold');
assert(isGroupHoldAlloc({
  allocation_owner_type: 'GROUP',
  inventory_request_type: 'STANDARD',
}) === false, 'standard group not hold');

const held = sumGroupHeldExpected([
  {
    allocation_owner_type: 'GROUP',
    inventory_request_type: 'GTY ONLY',
    occupancy: 100,
    probability: 50,
  },
  {
    allocation_owner_type: 'GROUP',
    inventory_request_type: 'STANDARD',
    occupancy: 200,
    probability: 100,
  },
]);
assert(held === 50, 'held expected ignores STANDARD');

const reservations = [
  { pax_type: 'F', guest_count: 80, res_status: 'BK' },
  { pax_type: 'G', guest_count: 20, res_status: 'BK' },
  { pax_type: 'G', guest_count: 5, res_status: 'CX' },
];
const allocRows = [
  {
    allocation_owner_type: 'GROUP',
    inventory_request_type: 'GTY ONLY',
    occupancy: 40,
    probability: 50,
  },
];

const bookedOnly = buildGroupFitSlices({
  reservations,
  allocRows,
  mode: BOOKED_COMPOSITION.BOOKED_ONLY,
});
assert(bookedOnly.meta.fitGuests === 80, 'booked FIT');
assert(bookedOnly.meta.groupBookedGuests === 20, 'booked Group');
assert(bookedOnly.slices.find((s) => s.label === 'Group')?.value === 20, 'booked_only Group slice');

const expected = buildGroupFitSlices({
  reservations,
  allocRows,
  mode: BOOKED_COMPOSITION.GROUP_FIT_EXPECTED,
});
assert(expected.meta.groupHeldExpected === 20, 'held expected');
assert(expected.slices.find((s) => s.label === 'Group')?.value === 40, 'Group = booked + held');
assert(expected.slices.find((s) => s.label === 'FIT')?.value === 80, 'FIT unchanged');

const threeWay = buildGroupFitSlices({
  reservations,
  allocRows,
  mode: BOOKED_COMPOSITION.THREE_WAY,
});
assert(threeWay.slices.some((s) => s.label === 'Group held'), 'three_way held label');
assert(threeWay.slices.find((s) => s.label === 'Group booked')?.value === 20, 'three_way booked');
assert(threeWay.slices.find((s) => s.label === 'Group held')?.value === 20, 'three_way held');

console.log('bookedComposition.test.mjs: ok');
