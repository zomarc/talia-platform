import {
  isSyntheticGroupOfRow,
  resolveDeliveryProbability,
  RESERVATION_SOURCE_ORIGIN,
} from './deliveryProbability.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message || 'Assertion failed');
};

assert(resolveDeliveryProbability({ pax_type: 'F', res_probability: 80 }) === 80, 'FIT res');
assert(resolveDeliveryProbability({ pax_type: 'G', group_probability: 40, res_probability: 100 }) === 40, 'Group prefers group');
assert(resolveDeliveryProbability({ pax_type: 'G', res_probability: 70 }) === 70, 'Group falls back to res');
assert(resolveDeliveryProbability({ probability: 55, allocation_owner_type: 'GROUP' }) === 55, 'alloc hold');
assert(resolveDeliveryProbability({}) === 100, 'default 100');

assert(isSyntheticGroupOfRow({
  source_origin: RESERVATION_SOURCE_ORIGIN.FACT_GROUP_ALLOC,
  res_status: 'OF',
}), 'origin flag');

assert(isSyntheticGroupOfRow({
  group_id: 69037,
  res_id: '690373349931',
  res_status: 'OF',
}), 'dummy res_id prefix');

assert(!isSyntheticGroupOfRow({
  group_id: 31778,
  res_id: 317787,
  res_status: 'OF',
}), 'short false-positive prefix rejected');

assert(!isSyntheticGroupOfRow({
  group_id: 69037,
  res_id: 120381,
  res_status: 'BK',
}), 'real BK not synthetic');

assert(resolveDeliveryProbability({
  pax_type: 'G',
  group_probability: 50,
  talia_probability: 10,
}, { probabilitySource: 'talia' }) === 10, 'talia mode');

console.log('deliveryProbability.test.mjs: ok');
