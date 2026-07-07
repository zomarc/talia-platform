import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveReferenceSailCode,
  resolveSailCode,
  resolveShipCode,
  buildInventoryReferenceIndex,
  resolveSelectionScope,
} from './inventoryReference.js';

const inventoryItems = [
  { sail_code: 'CJ07260718', reference_sail_code: 'CJ07260718', ship_code: 'CJ', ship_name: 'Celestyal Journey', sailing_role: 'master' },
  { sail_code: 'CJ07260719', reference_sail_code: 'CJ07260718', ship_code: 'CJ', ship_name: 'Celestyal Journey', sailing_role: 'segment' },
  { sail_code: 'CD03260904', reference_sail_code: 'CD03260904', ship_code: 'CD', ship_name: 'Celestyal Discovery', sailing_role: 'master' },
];

test('resolveReferenceSailCode prefers reference over sail_code', () => {
  assert.equal(resolveReferenceSailCode({ reference_sail_code: 'CJ07260718', sail_code: 'CJ07260719' }), 'CJ07260718');
  assert.equal(resolveReferenceSailCode({ sail_code: 'CJ07260719' }), 'CJ07260719');
  assert.equal(resolveReferenceSailCode('CJ07260718'), 'CJ07260718');
  assert.equal(resolveReferenceSailCode({ row_data: { reference_sail_code: 'X1' } }), 'X1');
});

test('resolveSailCode and resolveShipCode read plain fields', () => {
  assert.equal(resolveSailCode({ sail_code: 'CJ07260719' }), 'CJ07260719');
  assert.equal(resolveShipCode({ ship_code: 'CJ' }), 'CJ');
  assert.equal(resolveShipCode({ row_data: { ship_code: 'CD' } }), 'CD');
});

test('index groups all segment sail codes under one reference', () => {
  const index = buildInventoryReferenceIndex(inventoryItems);
  const entry = index.byReference.get('CJ07260718');
  assert.equal(entry.ship_code, 'CJ');
  assert.deepEqual(entry.sail_codes, new Set(['CJ07260718', 'CJ07260719']));
  assert.equal(index.referenceBySailCode.get('CJ07260719'), 'CJ07260718');
});

test('selecting a master resolves to full physical scope via inventory', () => {
  const index = buildInventoryReferenceIndex(inventoryItems);
  const scope = resolveSelectionScope(
    { reference_sail_code: 'CJ07260718', sail_code: 'CJ07260718' },
    index
  );
  assert.equal(scope.ship_code, 'CJ');
  assert.equal(scope.ship_name, 'Celestyal Journey');
  assert.deepEqual(scope.sail_codes, ['CJ07260718', 'CJ07260719']);
  assert.equal(scope.source, 'inventory_reference');
});

test('selecting a segment hops to its master reference and full scope', () => {
  const index = buildInventoryReferenceIndex(inventoryItems);
  const scope = resolveSelectionScope({ sail_code: 'CJ07260719' }, index);
  assert.equal(scope.reference_sail_code, 'CJ07260718');
  assert.equal(scope.ship_code, 'CJ');
  assert.deepEqual(scope.sail_codes, ['CJ07260718', 'CJ07260719']);
});

test('ship-only selection falls back to ship scope', () => {
  const index = buildInventoryReferenceIndex(inventoryItems);
  const scope = resolveSelectionScope({ ship_code: 'CD' }, index);
  assert.equal(scope.ship_code, 'CD');
  assert.equal(scope.source, 'ship_code');
});

test('unmapped reference still yields a reference-only scope', () => {
  const index = buildInventoryReferenceIndex(inventoryItems);
  const scope = resolveSelectionScope({ reference_sail_code: 'ZZ99999999' }, index);
  assert.equal(scope.reference_sail_code, 'ZZ99999999');
  assert.equal(scope.source, 'reference_only');
  assert.deepEqual(scope.sail_codes, ['ZZ99999999']);
});

test('null detail resolves to null scope', () => {
  const index = buildInventoryReferenceIndex(inventoryItems);
  assert.equal(resolveSelectionScope(null, index), null);
});
