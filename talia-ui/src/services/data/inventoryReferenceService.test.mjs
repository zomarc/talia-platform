import test from 'node:test';
import assert from 'node:assert/strict';
import {
  setInventoryItems,
  isInventoryIndexReady,
  resolveScopeSync,
  enrichSelectionDetail,
  __resetInventoryReferenceService,
} from './inventoryReferenceService.js';

const inventoryItems = [
  { sail_code: 'CJ07260718', reference_sail_code: 'CJ07260718', ship_code: 'CJ', ship_name: 'Celestyal Journey', sailing_role: 'master' },
  { sail_code: 'CJ07260719', reference_sail_code: 'CJ07260718', ship_code: 'CJ', ship_name: 'Celestyal Journey', sailing_role: 'segment' },
];

test('index is not ready until primed, then ready after setInventoryItems', () => {
  __resetInventoryReferenceService();
  assert.equal(isInventoryIndexReady(), false);
  setInventoryItems(inventoryItems);
  assert.equal(isInventoryIndexReady(), true);
});

test('resolveScopeSync translates a sail selection via inventory', () => {
  __resetInventoryReferenceService();
  setInventoryItems(inventoryItems);
  const scope = resolveScopeSync({ reference_sail_code: 'CJ07260718' });
  assert.equal(scope.ship_code, 'CJ');
  assert.deepEqual(scope.sail_codes, ['CJ07260718', 'CJ07260719']);
});

test('enrichSelectionDetail adds canonical fields and scope to raw detail', () => {
  __resetInventoryReferenceService();
  setInventoryItems(inventoryItems);
  const enriched = enrichSelectionDetail({ sail_code: 'CJ07260719', row_data: { x: 1 } });
  assert.equal(enriched.reference_sail_code, 'CJ07260718');
  assert.equal(enriched.ship_code, 'CJ');
  assert.equal(enriched.ship_name, 'Celestyal Journey');
  assert.deepEqual(enriched.sail_codes, ['CJ07260718', 'CJ07260719']);
  assert.equal(enriched.canonical_scope.source, 'inventory_reference');
  assert.deepEqual(enriched.row_data, { x: 1 });
});

test('enrichSelectionDetail preserves explicit ship_code from emitter', () => {
  __resetInventoryReferenceService();
  setInventoryItems(inventoryItems);
  const enriched = enrichSelectionDetail({ ship_code: 'CD' });
  assert.equal(enriched.ship_code, 'CD');
});

test('enrichSelectionDetail is a no-op passthrough when index empty', () => {
  __resetInventoryReferenceService();
  const enriched = enrichSelectionDetail({ sail_code: 'CJ07260719' });
  // Reference-only fallback still yields a scope from the detail itself.
  assert.equal(enriched.reference_sail_code, 'CJ07260719');
  assert.equal(enriched.canonical_scope.source, 'reference_only');
});

test('null detail passes through untouched', () => {
  __resetInventoryReferenceService();
  setInventoryItems(inventoryItems);
  assert.equal(enrichSelectionDetail(null), null);
});
