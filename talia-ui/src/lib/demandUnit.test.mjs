import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_DEMAND_UNIT,
  DEMAND_UNIT_CABINS,
  DEMAND_UNIT_PAX,
  guestsToCabins,
  normalizeDemandUnit,
  toDemandVolume,
  demandUnitNoun,
} from './demandUnit.js';

test('normalizeDemandUnit defaults to cabins', () => {
  assert.equal(normalizeDemandUnit(null), DEFAULT_DEMAND_UNIT);
  assert.equal(normalizeDemandUnit(''), DEMAND_UNIT_CABINS);
  assert.equal(normalizeDemandUnit('pax'), DEMAND_UNIT_PAX);
  assert.equal(normalizeDemandUnit('guests'), DEMAND_UNIT_PAX);
  assert.equal(normalizeDemandUnit('cabins'), DEMAND_UNIT_CABINS);
});

test('toDemandVolume is presentation-only convert', () => {
  assert.equal(toDemandVolume(212, DEMAND_UNIT_PAX), 212);
  assert.equal(toDemandVolume(212, DEMAND_UNIT_CABINS), 106);
  assert.equal(guestsToCabins(1260), 630);
  assert.equal(toDemandVolume(null, DEMAND_UNIT_CABINS), null);
});

test('demandUnitNoun labels', () => {
  assert.equal(demandUnitNoun(DEMAND_UNIT_PAX), 'guests');
  assert.equal(demandUnitNoun(DEMAND_UNIT_CABINS), 'cabins');
});
