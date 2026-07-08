import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInventoryReferenceIndex } from '../../../lib/inventoryReference.js';
import {
  buildShipDayRows,
  buildShipDaySummaries,
  buildShipDayBerthBundle,
  buildShipNameMap,
  filterDayRowsByScope,
  mapShipSelectToFilters,
  resolveListenerScope,
  resolveShipSelectionLabel,
} from './shipDayBerthTransform.js';

const inventoryItems = [
  { sail_code: 'CJ07260718', reference_sail_code: 'CJ07260718', ship_code: 'CJ', ship_name: 'Celestyal Journey', sailing_role: 'master' },
  { sail_code: 'CJ07260719', reference_sail_code: 'CJ07260718', ship_code: 'CJ', ship_name: 'Celestyal Journey', sailing_role: 'segment' },
];

const inventoryIndex = buildInventoryReferenceIndex(inventoryItems);

const shipRows = [
  { ship_code: 'CJ', ship_name: 'Celestyal Journey' },
  { ship_code: 'CD', ship_name: 'Celestyal Discovery' },
];

const berthRows = [
  { ship_code: 'CJ', sail_code: 'CJ07260718', date: '2026-07-18', berth_capacity: 1693, berths_occupied: 1453 },
  { ship_code: 'CJ', sail_code: 'CJ07260718', date: '2026-07-19', berth_capacity: 1693, berths_occupied: 1400 },
  // Turnaround day: two sail codes on same ship/date must NOT sum
  { ship_code: 'CJ', sail_code: 'CJ07260718', date: '2026-07-25', berth_capacity: 1693, berths_occupied: 1200 },
  { ship_code: 'CJ', sail_code: 'CJ07260725', date: '2026-07-25', berth_capacity: 1693, berths_occupied: 300 },
  // Same ship, different voyage — must drop on sail.select
  { ship_code: 'CJ', sail_code: 'CJ08260801', date: '2026-08-01', berth_capacity: 1693, berths_occupied: 500 },
  { ship_code: 'CD', sail_code: 'CD03260904', date: '2026-09-04', berth_capacity: 1200, berths_occupied: 900 },
];

test('ship name map resolves codes', () => {
  const map = buildShipNameMap(shipRows);
  assert.equal(map.get('CJ'), 'Celestyal Journey');
});

test('turnaround days take max per ship/day, not the sum', () => {
  const rows = buildShipDayRows(berthRows, shipRows);
  const turnaround = rows.find((r) => r.ship_code === 'CJ' && r.date === '2026-07-25');
  assert.equal(turnaround.capacity, 1693);
  assert.equal(turnaround.occupied, 1200);
  assert.equal(turnaround.available, 493);
  assert.deepEqual(turnaround.sail_codes, ['CJ07260718', 'CJ07260725']);
});

test('day rows carry occupancy and grouping labels', () => {
  const rows = buildShipDayRows(berthRows, shipRows);
  const day = rows.find((r) => r.date === '2026-07-18');
  assert.equal(day.ship_name, 'Celestyal Journey');
  assert.equal(day.month_label, 'Jul 2026');
  assert.equal(day.ship_group_label, 'Celestyal Journey');
  assert.equal(Math.round(day.occupancy_pct), 86);
  assert.equal(day.available, 240);
});

test('summaries report peaks and tightest availability per ship', () => {
  const rows = buildShipDayRows(berthRows, shipRows);
  const summaries = buildShipDaySummaries(rows);
  const cj = summaries.find((s) => s.ship_code === 'CJ');
  assert.equal(cj.peak_capacity, 1693);
  assert.equal(cj.peak_occupied, 1453);
  assert.equal(cj.min_available, 240);
  assert.equal(cj.day_count, 4);
});

test('bundle returns rows and summaries', () => {
  const bundle = buildShipDayBerthBundle({ shipDayBerthRows: berthRows, shipRows });
  assert.ok(bundle.dayRows.length > 0);
  assert.equal(bundle.summaries.length, 2);
});

test('mapShipSelectToFilters maps ship_code from event detail', () => {
  assert.deepEqual(
    mapShipSelectToFilters({ ship_code: 'CJ', ship_name: 'Celestyal Journey' }),
    { ship_code: 'CJ' }
  );
  assert.deepEqual(
    mapShipSelectToFilters({ row_data: { ship_code: 'CD' } }),
    { ship_code: 'CD' }
  );
  assert.equal(mapShipSelectToFilters({ sail_code: 'CJ07260718' }), null);
});

test('resolveShipSelectionLabel resolves ship name from catalog', () => {
  const label = resolveShipSelectionLabel({ ship_code: 'CJ' }, shipRows);
  assert.equal(label.ship_code, 'CJ');
  assert.equal(label.ship_name, 'Celestyal Journey');
});

test('resolveListenerScope upgrades incomplete emitted canonical_scope via local index', () => {
  const emittedDetail = {
    sail_code: 'CJ07260719',
    reference_sail_code: 'CJ07260719',
    canonical_scope: {
      reference_sail_code: 'CJ07260719',
      ship_code: null,
      ship_name: null,
      sail_codes: ['CJ07260719'],
      roles: [],
      source: 'reference_only',
    },
  };

  const scope = resolveListenerScope(emittedDetail, inventoryIndex);
  assert.equal(scope.ship_code, 'CJ');
  assert.equal(scope.ship_name, 'Celestyal Journey');
  assert.deepEqual(scope.sail_codes, ['CJ07260718', 'CJ07260719']);
  assert.equal(scope.source, 'inventory_reference');
});

test('filterDayRowsByScope constrains sail.select to voyage days only', () => {
  const dayRows = buildShipDayRows(berthRows, shipRows);
  const scope = resolveListenerScope(
    {
      sail_code: 'CJ07260718',
      reference_sail_code: 'CJ07260718',
      canonical_scope: {
        reference_sail_code: 'CJ07260718',
        ship_code: 'CJ',
        ship_name: 'Celestyal Journey',
        sail_codes: ['CJ07260718', 'CJ07260719'],
        roles: ['master', 'segment'],
        source: 'inventory_reference',
      },
    },
    inventoryIndex
  );

  const filtered = filterDayRowsByScope(dayRows, scope);
  assert.ok(filtered.every((row) => row.ship_code === 'CJ'));
  assert.equal(filtered.length, 3);
  assert.ok(filtered.every((row) => row.in_voyage));
  assert.deepEqual(filtered.map((row) => row.date), ['2026-07-18', '2026-07-19', '2026-07-25']);
  assert.ok(!filtered.some((row) => row.date === '2026-08-01'));
});

test('filterDayRowsByScope filters ship.select to all days for one ship', () => {
  const dayRows = buildShipDayRows(berthRows, shipRows);
  const scope = resolveListenerScope({ ship_code: 'CJ' }, inventoryIndex);
  const filtered = filterDayRowsByScope(dayRows, scope);

  assert.equal(filtered.length, 4);
  assert.ok(filtered.every((row) => row.ship_code === 'CJ'));
  assert.ok(filtered.every((row) => row.in_voyage === false));
  assert.ok(filtered.some((row) => row.date === '2026-08-01'));
});

test('filterDayRowsByScope filters ship.select to one ship', () => {
  const dayRows = buildShipDayRows(berthRows, shipRows);
  const scope = resolveListenerScope({ ship_code: 'CD' }, inventoryIndex);
  const filtered = filterDayRowsByScope(dayRows, scope);

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].ship_code, 'CD');
  assert.equal(filtered[0].in_voyage, false);
});
