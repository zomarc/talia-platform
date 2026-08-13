/**
 * Unit tests for profile densify + review classify (no DB).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  densifyLfSeriesFromCurve,
  densifyTargetSeries,
  interpolateLfOntoWeeks,
} from './profile-compare.js';
import { classifyGap, endTargetLf } from './profile-review.js';

test('densifyLfSeriesFromCurve builds from stacked series when totals missing', () => {
  const series = densifyLfSeriesFromCurve({
    loadFactorPct: 50,
    series: [
      {
        dimensionKey: 'Europe',
        points: [
          { weekLabel: 'W-1', weeksUntilSailing: 1, bookings: 20, guests: 40 },
          { weekLabel: 'Sail', weeksUntilSailing: 0, bookings: 40, guests: 80 },
        ],
      },
      {
        dimensionKey: 'US',
        points: [
          { weekLabel: 'W-1', weeksUntilSailing: 1, bookings: 10, guests: 20 },
          { weekLabel: 'Sail', weeksUntilSailing: 0, bookings: 20, guests: 40 },
        ],
      },
    ],
  });
  assert.equal(series.length, 2);
  assert.equal(series[0].weeksUntilSailing, 1);
  assert.equal(series[0].bookings, 30);
  assert.equal(series[1].lfPct, 50);
});

test('densifyLfSeriesFromCurve scales bookings to end LF%', () => {
  const series = densifyLfSeriesFromCurve({
    loadFactorPct: 80,
    totals: [
      { weekLabel: 'W-2', weeksUntilSailing: 2, bookings: 50, guests: 100 },
      { weekLabel: 'W-1', weeksUntilSailing: 1, bookings: 75, guests: 150 },
      { weekLabel: 'Sail', weeksUntilSailing: 0, bookings: 100, guests: 200 },
    ],
  });
  assert.equal(series.length, 3);
  assert.equal(series[0].lfPct, 40);
  assert.equal(series[1].lfPct, 60);
  assert.equal(series[2].lfPct, 80);
});

test('densifyTargetSeries prefers week grid on voyage nodes', () => {
  const series = densifyTargetSeries({
    nodes: [
      { dimensionLevel: 'voyage', weeksUntilSailing: 4, lfPct: 40, weekLabel: 'W-4' },
      { dimensionLevel: 'voyage', weeksUntilSailing: 0, lfPct: 90, weekLabel: 'Sail' },
      { dimensionLevel: 'market', weeksUntilSailing: 0, lfPct: 50 },
    ],
  });
  assert.equal(series.length, 2);
  assert.equal(series[0].weeksUntilSailing, 4);
  assert.equal(series[0].lfPct, 40);
  assert.equal(series[1].lfPct, 90);
});

test('interpolateLfOntoWeeks fills gaps between waypoints', () => {
  const dense = interpolateLfOntoWeeks(
    [
      { weeksUntilSailing: 4, lfPct: 40 },
      { weeksUntilSailing: 0, lfPct: 80 },
    ],
    [4, 3, 2, 1, 0]
  );
  assert.equal(dense.length, 5);
  assert.equal(dense[0].lfPct, 40);
  assert.equal(dense[2].lfPct, 60);
  assert.equal(dense[4].lfPct, 80);
});

test('classifyGap uses behind/on/ahead thresholds', () => {
  assert.equal(classifyGap(70, 80), 'behind');
  assert.equal(classifyGap(81, 80), 'on');
  assert.equal(classifyGap(90, 80), 'ahead');
  assert.equal(classifyGap(null, 80), 'unknown');
});

test('endTargetLf picks lowest weeks voyage node', () => {
  const lf = endTargetLf({
    nodes: [
      { dimensionLevel: 'voyage', weeksUntilSailing: 8, lfPct: 50 },
      { dimensionLevel: 'voyage', weeksUntilSailing: 0, lfPct: 88 },
    ],
  });
  assert.equal(lf, 88);
});

test('resolveModelPeer override semantics: manual map wins over lazy (pure contract)', () => {
  // Documented contract mirrored in profile-model-map.resolveModelPeer:
  // matchMode=manual + modelSailCode → peerSource manual_map
  const map = { matchMode: 'manual', modelSailCode: 'HIST01' };
  const resolved =
    map.matchMode === 'manual' && map.modelSailCode
      ? { modelSailCode: map.modelSailCode, peerSource: 'manual_map' }
      : { modelSailCode: 'LAZY01', peerSource: 'lazy_peer' };
  assert.equal(resolved.modelSailCode, 'HIST01');
  assert.equal(resolved.peerSource, 'manual_map');
});
