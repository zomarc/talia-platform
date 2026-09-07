import test from 'node:test';
import assert from 'node:assert/strict';
import { DATE_ROLES, getDateProfileForTable } from './table-mappings.js';

test('ship_cabin_ctg_link is a sailing interval with sail coverage', () => {
  const profile = getDateProfileForTable('ship_cabin_ctg_link');
  assert.equal(profile.dateRole, DATE_ROLES.SAILING_INTERVAL);
  assert.equal(profile.intervalFrom, 'eff_sail_from');
  assert.equal(profile.intervalTo, 'eff_sail_to');
  assert.equal(profile.sailCoverage, true);
});

test('cabin_ctg is record validity, budget stays an event series', () => {
  const cabin = getDateProfileForTable('cabin_ctg');
  assert.equal(cabin.dateRole, DATE_ROLES.RECORD_VALIDITY);
  assert.equal(cabin.intervalFrom, 'effective_from');
  assert.equal(cabin.intervalTo, 'effective_to');

  const budget = getDateProfileForTable('budget');
  assert.equal(budget.dateRole, DATE_ROLES.EVENT);
  assert.equal(budget.intervalFrom, null);
});

test('reservation interval uses sail_from_date / sail_to_date', () => {
  const profile = getDateProfileForTable('reservation');
  assert.equal(profile.dateRole, DATE_ROLES.SAILING_INTERVAL);
  assert.equal(profile.intervalFrom, 'sail_from_date');
  assert.equal(profile.intervalTo, 'sail_to_date');
  assert.equal(profile.sailCoverage, false);
});
