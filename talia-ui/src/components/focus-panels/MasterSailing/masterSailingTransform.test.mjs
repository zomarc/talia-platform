import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMasterSailingRows } from './masterSailingTransform.js';

test('buildMasterSailingRows maps reference code from inventory_item', () => {
  const sails = [
    {
      sail_code: 'SEG-001',
      sail_date_from: '2026-03-14',
      ship_name: 'Celestyal Discovery',
      ship_code: 'DIS',
    },
  ];
  const inventory = [
    {
      sail_code: 'SEG-001',
      reference_sail_code: 'MASTER-900',
    },
  ];

  const rows = buildMasterSailingRows(sails, inventory);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].reference_sail_code, 'MASTER-900');
  assert.equal(rows[0].reference_source, 'inventory_item');
  assert.equal(rows[0].departure_month_key, '2026-03');
  assert.equal(rows[0].ship_group_label, 'Celestyal Discovery');
});

test('buildMasterSailingRows falls back to sail_code when mapping missing', () => {
  const sails = [
    {
      sail_code: 'SEG-002',
      sail_date_from: '2026-04-02',
      ship_name: 'Celestyal Journey',
      ship_code: 'JRN',
    },
  ];

  const rows = buildMasterSailingRows(sails, []);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].reference_sail_code, 'SEG-002');
  assert.equal(rows[0].reference_source, 'derived_from_sail_code');
});

