import test from 'node:test';
import assert from 'node:assert/strict';
import { DATE_ROLES, inferDateRole, resolveDateProfile } from './integrationDateProfile.js';
import { computeIntegrationHealth } from './integrationDateHealth.js';

const requestedRange = { min: '2026-08-16', max: '2029-01-30' };
const todayStamp = new Date().toISOString();

test('inferDateRole treats eff_sail_from/to as a sailing interval', () => {
  assert.equal(
    inferDateRole(['eff_sail_from', 'eff_sail_to']),
    DATE_ROLES.SAILING_INTERVAL
  );
  assert.equal(
    inferDateRole(['effective_from', 'effective_to']),
    DATE_ROLES.RECORD_VALIDITY
  );
  assert.equal(inferDateRole(['snapshot_date']), DATE_ROLES.EVENT);
});

test('resolveDateProfile uses sail_from_date/sail_to_date as the reservation interval', () => {
  const profile = resolveDateProfile({
    dateColumns: ['sail_from_date', 'sail_to_date', 'res_init_date'],
    dateRole: 'sailing_interval',
  }, 'reservation');
  assert.equal(profile.intervalFrom, 'sail_from_date');
  assert.equal(profile.intervalTo, 'sail_to_date');
});

test('ship_cabin_ctg_link health is OK when windows cover the sailing horizon', () => {
  const health = computeIntegrationHealth({
    tableName: 'ship_cabin_ctg_link',
    dateRole: 'sailing_interval',
    rowCount: 2560,
    dateRange: requestedRange,
    actualDataRange: { min: '2020-01-01', max: '2099-12-31' },
    lastSync: todayStamp,
    latestAvailableData: todayStamp,
    coverage: {
      dateRole: 'sailing_interval',
      overlappingRows: 2560,
      rowCoveragePct: 100,
      coveredSails: 1175,
      totalSails: 1175,
      sailCoveragePct: 100,
      openEnded: true,
    },
  }, requestedRange);

  assert.equal(health.variant, 'ok');
  assert.equal(health.label, 'OK');
  assert.equal(health.coveragePct, 100);
  assert.equal(health.coverageKind, 'sails');
  assert.equal(health.openEnded, true);
  assert.equal(health.freshnessClock, 'last_sync');
  assert.match(health.gridMeta, /Applies 100% sails/);
  assert.doesNotMatch(health.gridMeta, /behind/);
});

test('legacy min/max of eff_sail_from alone is a false mismatch', () => {
  const health = computeIntegrationHealth({
    tableName: 'ship_cabin_ctg_link',
    dateRole: 'sailing_interval',
    rowCount: 2560,
    dateRange: requestedRange,
    actualDataRange: { min: '2020-01-01', max: '2026-08-01' },
    lastSync: todayStamp,
    latestAvailableData: '2026-08-01',
    coverage: null,
  }, requestedRange);

  assert.equal(health.coveragePct, 0);
  assert.equal(health.variant, 'mismatch');
});

test('event tables keep snapshot coverage and latest-data freshness', () => {
  const health = computeIntegrationHealth({
    tableName: 'cabin_availability',
    dateRole: 'event',
    rowCount: 10,
    dateRange: requestedRange,
    actualDataRange: { min: '2026-08-16', max: '2029-01-30' },
    lastSync: todayStamp,
    latestAvailableData: todayStamp,
  }, requestedRange);

  assert.equal(health.dateRole, DATE_ROLES.EVENT);
  assert.equal(health.freshnessClock, 'latest_data');
  assert.equal(health.coveragePct, 100);
  assert.match(health.gridMeta, /Cov 100%/);
});
