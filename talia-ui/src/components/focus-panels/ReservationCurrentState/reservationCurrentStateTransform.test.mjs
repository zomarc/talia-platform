import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isCancelledStatus,
  isBookedStatus,
  filterByReservationStatus,
  buildShipSailTooltip,
} from './reservationCurrentStateTransform.js';
import { formatSailDateRange } from '../../../lib/dateFormat.js';

test('isCancelledStatus recognizes cancelled codes', () => {
  assert.equal(isCancelledStatus('CX'), true);
  assert.equal(isCancelledStatus('cancelled'), true);
  assert.equal(isCancelledStatus('X'), true);
  assert.equal(isCancelledStatus('BK'), false);
});

test('isBookedStatus is inverse of cancelled', () => {
  assert.equal(isBookedStatus('BK'), true);
  assert.equal(isBookedStatus('CX'), false);
});

test('filterByReservationStatus filters booked and cancelled', () => {
  const rows = [
    { res_id: 1, res_status: 'BK', source_origin: 'res_header', pax_type: 'F' },
    { res_id: 2, res_status: 'CX', source_origin: 'res_header' },
    { res_id: 3, res_status: 'BOOKED', source_origin: 'res_header', pax_type: 'F' },
  ];
  assert.equal(filterByReservationStatus(rows, 'all').length, 3);
  assert.deepEqual(
    filterByReservationStatus(rows, 'cancelled').map((r) => r.res_id),
    [2]
  );
  assert.deepEqual(
    filterByReservationStatus(rows, 'booked').map((r) => r.res_id),
    [1, 3]
  );
});

test('filter synthetic and estimated pipeline', () => {
  const rows = [
    { res_id: 1, res_status: 'BK', source_origin: 'res_header', pax_type: 'F', guest_count: 2 },
    {
      res_id: 99000111,
      res_status: 'OF',
      source_origin: 'fact_group_alloc',
      group_id: 99,
      pax_type: 'G',
      guest_count: 2,
    },
    { res_id: 3, res_status: 'OF', source_origin: 'res_header', pax_type: 'G', guest_count: 2 },
    { res_id: 4, res_status: 'CX', source_origin: 'fact_group_alloc', group_id: 1 },
  ];
  assert.deepEqual(
    filterByReservationStatus(rows, 'synthetic').map((r) => r.res_id),
    [99000111]
  );
  const estimated = filterByReservationStatus(rows, 'estimated').map((r) => r.res_id);
  assert.ok(estimated.includes(1));
  assert.ok(estimated.includes(99000111));
  assert.ok(estimated.includes(3));
  assert.ok(!estimated.includes(4));
});

test('buildShipSailTooltip combines ship and sail code', () => {
  assert.equal(
    buildShipSailTooltip({ ship: 'SC', sail_code: 'SC001' }),
    'Ship: SC · Sail: SC001'
  );
  assert.equal(buildShipSailTooltip({ sail_code: 'SC001' }), 'Sail: SC001');
  assert.equal(buildShipSailTooltip({}), '');
});

test('formatSailDateRange compacts same-month ranges', () => {
  assert.equal(
    formatSailDateRange('2026-07-18', '2026-07-25'),
    '18–25 Jul 2026'
  );
});

test('formatSailDateRange spans months within a year', () => {
  assert.equal(
    formatSailDateRange('2026-07-18', '2026-08-25'),
    '18 Jul – 25 Aug 2026'
  );
});
