import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSailingDemandComposition,
  isContractedDemand,
  isNamedBooked,
} from './sailingDemandComposition.js';

test('named booked excludes synthetic OF', () => {
  assert.equal(isNamedBooked({ res_status: 'BK', guest_count: 2, source_origin: 'res_header' }), true);
  assert.equal(isNamedBooked({
    res_status: 'OF',
    guest_count: 2,
    source_origin: 'fact_group_alloc',
    group_id: 123,
    res_id: 1234567,
  }), false);
});

test('contracted includes groups and offers', () => {
  assert.equal(isContractedDemand({ res_status: 'OF', pax_type: 'G', guest_count: 2 }), true);
  assert.equal(isContractedDemand({ res_status: 'BK', pax_type: 'G', guest_count: 2 }), true);
  assert.equal(isContractedDemand({ res_status: 'BK', pax_type: 'F', guest_count: 2 }), false);
});

test('composition sums guests and revenue', () => {
  const result = buildSailingDemandComposition([
    {
      res_status: 'BK',
      pax_type: 'F',
      guest_count: 4,
      source_origin: 'res_header',
      gross_ticket_revenue_eur: 1000,
    },
    {
      res_status: 'OF',
      pax_type: 'G',
      guest_count: 10,
      source_origin: 'fact_group_alloc',
      group_id: 99,
      res_id: 990001,
      group_probability: 50,
      gross_ticket_revenue_eur: 2000,
    },
  ]);
  assert.equal(result.booked.guests, 4);
  assert.equal(result.booked.revenueEur, 1000);
  assert.equal(result.contracted.guests, 10);
  assert.equal(result.estimated.guests, 5);
  assert.equal(result.estimated.revenueEur, 1000);
});
