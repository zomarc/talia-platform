import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mergeComponentOptionsMaps,
  resolveStoredComponentViews,
} from './componentOptionsInstance.js';

describe('per-instance component views', () => {
  it('uses component views until that panel has its own map', () => {
    const entry = {
      views: { snapshot: false, graph: true },
      instances: {},
    };
    assert.deepEqual(resolveStoredComponentViews(entry, 'win-a'), {
      snapshot: false,
      graph: true,
    });
  });

  it('keeps two panels independent once each has been saved', () => {
    const entry = {
      views: { snapshot: true, graph: true },
      instances: {
        'win-a': { views: { snapshot: true, graph: false } },
        'win-b': { views: { snapshot: false, graph: true } },
      },
    };
    assert.equal(resolveStoredComponentViews(entry, 'win-a').graph, false);
    assert.equal(resolveStoredComponentViews(entry, 'win-b').snapshot, false);
    assert.equal(resolveStoredComponentViews(entry, 'win-b').graph, true);
  });

  it('merges one panel without dropping the other panel or shared views', () => {
    const current = {
      'reservation-booking-curve': {
        views: { snapshot: true },
        operations: { showFilters: true },
        instances: {
          'win-a': { views: { graph: false } },
        },
      },
    };
    const patch = {
      'reservation-booking-curve': {
        operations: { showFilters: true },
        instances: {
          'win-b': { views: { snapshot: false } },
        },
      },
    };
    const merged = mergeComponentOptionsMaps(current, patch);
    const entry = merged['reservation-booking-curve'];
    assert.equal(entry.views.snapshot, true);
    assert.equal(entry.instances['win-a'].views.graph, false);
    assert.equal(entry.instances['win-b'].views.snapshot, false);
  });
});
