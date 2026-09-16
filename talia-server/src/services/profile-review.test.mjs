import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickMasterInventoryItem } from './profile-review.js';
import {
  isReusableTargetProfileName,
  resolveSailingUpsertId,
} from './inventory-target-profile.js';

describe('pickMasterInventoryItem', () => {
  const items = [
    { id: 722, sail_code: 'CJ07260919', reference_sail_code: 'CJ07260919', sailing_role: 'segment' },
    { id: 721, sail_code: 'CJ07260919', reference_sail_code: 'CJ07260919', sailing_role: 'master' },
    { id: 359, sail_code: 'CD03260919', reference_sail_code: 'CD03260918', sailing_role: 'segment' },
    { id: 358, sail_code: 'CD03260918', reference_sail_code: 'CD03260918', sailing_role: 'master' },
  ];

  it('prefers the master inventory_item for a voyage', () => {
    assert.equal(pickMasterInventoryItem(items, 'CJ07260919').id, 721);
  });

  it('resolves a segment code to the voyage master', () => {
    assert.equal(pickMasterInventoryItem(items, 'CD03260919').id, 358);
  });
});

describe('isReusableTargetProfileName', () => {
  it('keeps General / Generic / other named templates', () => {
    assert.equal(isReusableTargetProfileName('General Sept '), true);
    assert.equal(isReusableTargetProfileName('Generic 2026'), true);
    assert.equal(isReusableTargetProfileName('Autumn goal'), true);
  });

  it('rejects Suggested / Default auto-fills', () => {
    assert.equal(isReusableTargetProfileName('Suggested · CJ07250920'), false);
    assert.equal(isReusableTargetProfileName('Default · 2026-09'), false);
    assert.equal(isReusableTargetProfileName('Suggested target'), false);
  });
});

describe('resolveSailingUpsertId', () => {
  const existing = [
    { id: '10', isActive: false },
    { id: '11', isActive: true },
  ];

  it('keeps an explicit sailing profile id', () => {
    assert.equal(resolveSailingUpsertId(existing, '10', { isLibrarySource: false }), '10');
  });

  it('replaces the active sailing row when assigning a library/suggested curve', () => {
    assert.equal(resolveSailingUpsertId(existing, '99', { isLibrarySource: true }), '11');
    assert.equal(resolveSailingUpsertId(existing, null, { isLibrarySource: true }), '11');
  });

  it('inserts when the sailing has no profile yet', () => {
    assert.equal(resolveSailingUpsertId([], null, { isLibrarySource: true }), null);
  });
});
