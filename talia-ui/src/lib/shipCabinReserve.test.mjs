import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CABIN_RESERVE_KIND,
  classifyCabinReserveType,
  indexCabinReservesForSail,
  reserveWindowOverlapsDate,
  summarizeCabinReserves,
} from './shipCabinReserve.js';

test('classifyCabinReserveType maps offsale, constrained, and segment', () => {
  assert.equal(classifyCabinReserveType('RESERVED'), CABIN_RESERVE_KIND.OFFSALE);
  assert.equal(classifyCabinReserveType('out of order'), CABIN_RESERVE_KIND.OFFSALE);
  assert.equal(classifyCabinReserveType('CREW'), CABIN_RESERVE_KIND.OFFSALE);
  assert.equal(classifyCabinReserveType('HANDICAP'), CABIN_RESERVE_KIND.CONSTRAINED);
  assert.equal(classifyCabinReserveType('VIP-MARKETING'), CABIN_RESERVE_KIND.CONSTRAINED);
  assert.equal(classifyCabinReserveType('SEGMENT LAV-LAV'), CABIN_RESERVE_KIND.SEGMENT);
  assert.equal(classifyCabinReserveType('LAV-LAV'), CABIN_RESERVE_KIND.SEGMENT);
  assert.equal(classifyCabinReserveType(null), CABIN_RESERVE_KIND.SEGMENT);
});

test('reserveWindowOverlapsDate inclusive of sail_date_from/to', () => {
  const row = { sail_date_from: '2026-07-18', sail_date_to: '2026-07-25' };
  assert.equal(reserveWindowOverlapsDate(row, '2026-07-18'), true);
  assert.equal(reserveWindowOverlapsDate(row, '2026-07-25'), true);
  assert.equal(reserveWindowOverlapsDate(row, '2026-07-17'), false);
  assert.equal(reserveWindowOverlapsDate(row, '2026-07-26'), false);
});

test('indexCabinReservesForSail prefers offsale when a cabin has mixed types', () => {
  const index = indexCabinReservesForSail([
    {
      ship_code: 'CJ',
      cabin_number: '4011',
      reserve_type: 'SEGMENT LAV-LAV',
      sail_date_from: '2026-07-18',
      sail_date_to: '2026-07-25',
    },
    {
      ship_code: 'CJ',
      cabin_number: '4011',
      reserve_type: 'RESERVED',
      sail_date_from: '2026-07-18',
      sail_date_to: '2026-07-25',
    },
    {
      ship_code: 'CJ',
      cabin_number: '5007',
      reserve_type: 'HANDICAP',
      sail_date_from: '2026-07-18',
      sail_date_to: '2026-07-25',
    },
    {
      ship_code: 'CD',
      cabin_number: '3001',
      reserve_type: 'RESERVED',
      sail_date_from: '2026-07-18',
      sail_date_to: '2026-07-25',
    },
  ], { shipCode: 'CJ', dateKey: '2026-07-20' });

  assert.equal(index.get('4011').kind, CABIN_RESERVE_KIND.OFFSALE);
  assert.equal(index.get('5007').kind, CABIN_RESERVE_KIND.CONSTRAINED);
  assert.equal(index.has('3001'), false);

  const summary = summarizeCabinReserves(index);
  assert.equal(summary.offsale, 1);
  assert.equal(summary.constrained, 1);
  assert.equal(summary.segment, 0);
});
