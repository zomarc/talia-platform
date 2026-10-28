import assert from 'node:assert/strict';
import { buildDataManagementExport } from './dataManagementPrint.js';

const payload = buildDataManagementExport([{
  tableName: 'reservation_promotion',
  source: 'dwh.Fact_Reservation',
  loadMethod: 'incremental',
  rowCount: 1216176,
  dateRange: { min: '2026-08-11', max: '2026-10-22' },
  lastSync: '2026-10-28T16:13:00Z',
  latestAvailableData: '2026-10-22T00:00:00Z',
  recordsProcessed: 1200000,
  changesDetected: 12,
  syncDuration: 242000,
  status: 'Synced · Has Data',
  _health: {
    qualityLabel: 'Good',
    label: 'OK',
    gridMeta: 'Cov 88% | On time',
    expectedRange: { min: '2026-08-11', max: '2026-10-22' },
    dateRole: 'sailing_interval',
  },
  _actions: '<button>Sync</button>',
  _isSyncing: false,
}]);

assert.equal(payload.title, 'Data management');
assert.equal(payload.rows.length, 1);
assert.equal(payload.rows[0].tableName, 'reservation_promotion');
assert.equal(payload.rows[0].rows, '1,216,176');
assert.equal(payload.rows[0].quality, 'Good · Cov 88% | On time');
assert.equal(payload.rows[0].duration, '4m 2s');
assert.equal(payload.rows[0].status, 'Synced · Has Data');
assert.equal(JSON.stringify(payload.rows).includes('expectedRange'), false);
assert.equal(JSON.stringify(payload.rows).includes('dateRole'), false);
assert.equal(JSON.stringify(payload.rows).includes('<button>'), false);
assert.ok(payload.html.includes('background: #ffffff'));
assert.ok(payload.html.includes('table-layout: fixed'));
assert.ok(payload.html.includes('reservation_<wbr>promotion'));
assert.ok(payload.html.includes('Good · Cov 88% | On time'));
assert.equal(payload.html.includes('expectedRange'), false);
assert.equal(payload.html.includes('#1f4e79'), false);
assert.equal(payload.html.includes('<button>'), false);
assert.ok(payload.columns.some((column) => column.title === 'Quality'));
assert.equal(payload.columns.some((column) => column.field === '_health'), false);
assert.equal(payload.columns.some((column) => column.field === '_actions'), false);

const syncing = buildDataManagementExport([{
  tableName: 'budget',
  _isSyncing: true,
  _progress: { percentage: 40 },
  status: 'Synced',
}]);
assert.equal(syncing.rows[0].status, 'Syncing 40%');
assert.equal(syncing.rows[0].quality, 'Unknown');

const partial = buildDataManagementExport([{
  tableName: 'agency',
  _health: { qualityLabel: 'Good', gridMeta: 'N/A | On time' },
}]);
assert.equal(partial.rows[0].quality, 'Good · On time');
assert.equal(syncing.rows[0].range, 'N/A');

console.log('dataManagementPrint.test.mjs ok');
