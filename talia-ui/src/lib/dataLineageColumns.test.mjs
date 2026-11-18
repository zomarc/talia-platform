import assert from 'node:assert/strict';
import test from 'node:test';
import {
  groupColumnsByTable,
  normalizeFieldKey,
} from './dataLineageColumns.js';

test('normalizeFieldKey unifies camel and snake', () => {
  assert.equal(normalizeFieldKey('sailCode'), 'sail_code');
  assert.equal(normalizeFieldKey('Sail_Code'), 'sail_code');
  assert.equal(normalizeFieldKey('[Sail_Code]'), 'sail_code');
});

test('groupColumnsByTable attributes UI fields to Synapse-backed tables', () => {
  const result = groupColumnsByTable({
    fields: ['sail_code', 'actual_booked_pct', 'agency_id'],
    panelTables: ['master_sail', 'agency'],
    panelTableColumns: {
      master_sail: ['sail_code', 'ship_code'],
      agency: ['agency_id', 'agency_name'],
    },
    syncTableColumns: {
      master_sail: ['Sail_Code', 'Ship_Code'],
    },
    tableSourcesMap: {
      master_sail: { source: 'dwh.Dim_Master_Sail' },
      agency: { source: 'dwh.Dim_Agency' },
    },
    fieldLabels: {
      sail_code: { short: 'Sail', long: 'Sailing code' },
      actual_booked_pct: { short: 'Bk%', long: 'Actual booked %' },
    },
  });

  const master = result.groups.find((g) => g.table === 'master_sail');
  const agency = result.groups.find((g) => g.table === 'agency');
  assert.ok(master);
  assert.equal(master.synapseSource, 'dwh.Dim_Master_Sail');
  assert.ok(master.columns.some((c) => c.name === 'sail_code'));
  assert.ok(agency.columns.some((c) => c.name === 'agency_id'));
  assert.ok(result.unmapped.some((c) => c.name === 'actual_booked_pct'));
});
