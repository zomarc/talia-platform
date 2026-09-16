import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  builtinDefaultNodes,
  mergeHorizonSails,
  DEFAULT_TARGET_WAYPOINTS,
} from './profile-backfill.js';

describe('profile-backfill helpers', () => {
  it('builds a four-point voyage default curve', () => {
    const nodes = builtinDefaultNodes();
    assert.equal(nodes.length, DEFAULT_TARGET_WAYPOINTS.length);
    assert.deepEqual(
      nodes.map((node) => [node.weeksUntilSailing, node.lfPct]),
      DEFAULT_TARGET_WAYPOINTS.map((point) => [point.weeksUntilSailing, point.lfPct])
    );
    assert.ok(nodes.every((node) => node.dimensionLevel === 'voyage'));
  });

  it('keeps in-progress sails ahead of later departures and de-dupes', () => {
    const merged = mergeHorizonSails(
      [
        { sail_code: 'B', sail_date_from: '2026-09-10' },
        { sail_code: 'A', sail_date_from: '2026-09-20' },
      ],
      [
        { sail_code: 'A', sail_date_from: '2026-08-28' },
        { sail_code: 'C', sail_date_from: '2026-08-20' },
      ],
      10
    );
    assert.deepEqual(merged.map((sail) => sail.sail_code), ['A', 'C', 'B']);
  });

  it('respects the horizon limit', () => {
    const merged = mergeHorizonSails(
      [{ sail_code: 'D1' }, { sail_code: 'D2' }],
      [{ sail_code: 'P1' }],
      2
    );
    assert.deepEqual(merged.map((sail) => sail.sail_code), ['P1', 'D1']);
  });
});
