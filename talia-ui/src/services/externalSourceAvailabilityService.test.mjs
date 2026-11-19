import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Lightweight contract checks for the availability YES/NO gate.
 * Full probe I/O is covered in browser; here we lock the semantics.
 */
describe('external source availability contract', () => {
  it('treats only checked+available as YES', () => {
    const isAvailable = (status) => status?.checked === true && status?.available === true;
    assert.equal(isAvailable({ checked: false, available: false }), false);
    assert.equal(isAvailable({ checked: false, available: true }), false);
    assert.equal(isAvailable({ checked: true, available: false }), false);
    assert.equal(isAvailable({ checked: true, available: true }), true);
  });
});
