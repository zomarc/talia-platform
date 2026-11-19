import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('source availability refresh contract', () => {
  const canRefresh = (status) => {
    if (status.policy === 'optimistic') {
      return !(status.checked === true && status.available === false);
    }
    return status.checked === true && status.available === true;
  };

  it('optimistic sources allow refresh until proven down', () => {
    assert.equal(canRefresh({ policy: 'optimistic', checked: false, available: false }), true);
    assert.equal(canRefresh({ policy: 'optimistic', checked: true, available: true }), true);
    assert.equal(canRefresh({ policy: 'optimistic', checked: true, available: false }), false);
  });

  it('strict sources require a successful probe before refresh', () => {
    assert.equal(canRefresh({ policy: 'strict', checked: false, available: false }), false);
    assert.equal(canRefresh({ policy: 'strict', checked: false, available: true }), false);
    assert.equal(canRefresh({ policy: 'strict', checked: true, available: false }), false);
    assert.equal(canRefresh({ policy: 'strict', checked: true, available: true }), true);
  });
});
