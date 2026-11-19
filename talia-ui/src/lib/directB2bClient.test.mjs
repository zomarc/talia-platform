import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  clearDirectB2bDown,
  isDirectB2bDown,
  isDirectB2bUnavailableError,
  markDirectB2bDown,
} from './directB2bFailFast.js';

afterEach(() => {
  clearDirectB2bDown();
});

describe('directB2b fail-fast cooldown', () => {
  it('marks the endpoint down and clears on request', () => {
    assert.equal(isDirectB2bDown(), false);
    markDirectB2bDown(30_000);
    assert.equal(isDirectB2bDown(), true);
    clearDirectB2bDown();
    assert.equal(isDirectB2bDown(), false);
  });

  it('expires after the cooldown window', async () => {
    markDirectB2bDown(20);
    assert.equal(isDirectB2bDown(), true);
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(isDirectB2bDown(), false);
  });

  it('recognizes timeout and network failures', () => {
    assert.equal(isDirectB2bUnavailableError(new Error('Timeout after 3000ms')), true);
    assert.equal(isDirectB2bUnavailableError(new Error('Failed to fetch')), true);
    assert.equal(isDirectB2bUnavailableError(new Error('GraphQL validation failed')), false);
  });
});
