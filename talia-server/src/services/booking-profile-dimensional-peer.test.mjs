import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickSameMonthPeer } from './booking-profile-dimensional.js';

describe('pickSameMonthPeer', () => {
  const rows = [
    { sail_code: 'CD01', sail_date_from: '2025-09-04', is_main: 1 },
    { sail_code: 'CD02', sail_date_from: '2025-09-18', is_main: 1 },
    { sail_code: 'CD02A', sail_date_from: '2025-09-18', is_main: 0 },
    { sail_code: 'CD03', sail_date_from: '2025-09-28', is_main: 1 },
  ];

  it('picks the closest day-of-month in the same month', () => {
    assert.equal(pickSameMonthPeer(rows, '2025-09-11').sail_code, 'CD01');
    assert.equal(pickSameMonthPeer(rows, '2025-09-20').sail_code, 'CD02');
  });

  it('prefers the master when two sails share a date', () => {
    assert.equal(pickSameMonthPeer(rows, '2025-09-18').sail_code, 'CD02');
  });
});
