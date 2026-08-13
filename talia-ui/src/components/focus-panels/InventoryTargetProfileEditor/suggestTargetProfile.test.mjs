import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sampleWeekWaypoints,
  buildSuggestedTargetDraft,
  minimiseTargetWaypoints,
  smoothTargetWaypoints,
} from './suggestTargetProfile.js';

test('sampleWeekWaypoints sparsifies dense LF series', () => {
  const series = [];
  for (let w = 12; w >= 0; w -= 1) {
    series.push({ weeksUntilSailing: w, lfPct: 10 + (12 - w) * 5 });
  }
  const nodes = sampleWeekWaypoints(series, 4);
  assert.ok(nodes.length >= 4);
  assert.equal(nodes[0].weeksUntilSailing, 12);
  assert.equal(nodes[nodes.length - 1].weeksUntilSailing, 0);
  assert.equal(nodes[nodes.length - 1].lfPct, 70);
});

test('buildSuggestedTargetDraft prefers model over REAL', () => {
  const draft = buildSuggestedTargetDraft({
    modelSailCode: 'HIST01',
    peerSource: 'lazy_peer',
    modelSeries: [
      { weeksUntilSailing: 8, lfPct: 40 },
      { weeksUntilSailing: 4, lfPct: 60 },
      { weeksUntilSailing: 0, lfPct: 80 },
    ],
    realSeries: [
      { weeksUntilSailing: 0, lfPct: 20 },
    ],
  });
  assert.ok(draft);
  assert.equal(draft.suggestionMeta.source, 'model');
  assert.match(draft.name, /HIST01/);
  assert.equal(draft.nodes[draft.nodes.length - 1].lfPct, 80);
  assert.equal(draft.isActive, true);
});

test('buildSuggestedTargetDraft falls back to REAL', () => {
  const draft = buildSuggestedTargetDraft({
    modelSeries: [],
    realSeries: [
      { weeksUntilSailing: 4, lfPct: 30 },
      { weeksUntilSailing: 0, lfPct: 50 },
    ],
  });
  assert.ok(draft);
  assert.equal(draft.suggestionMeta.source, 'real');
});

test('minimiseTargetWaypoints keeps endpoints and corners', () => {
  const nodes = [];
  for (let w = 16; w >= 0; w -= 1) {
    nodes.push({
      tempKey: `w${w}`,
      dimensionLevel: 'voyage',
      dimensionKey: 'TOTAL',
      weeksUntilSailing: w,
      weekLabel: w === 0 ? 'Sail' : `W-${w}`,
      lfPct: w > 8 ? 20 : 20 + (8 - w) * 8,
      pointOrder: 16 - w,
    });
  }
  const next = minimiseTargetWaypoints(nodes, { maxPoints: 5 });
  const voyage = next.filter((n) => n.dimensionLevel === 'voyage');
  assert.ok(voyage.length <= 5);
  assert.equal(voyage[0].weeksUntilSailing, 16);
  assert.equal(voyage[voyage.length - 1].weeksUntilSailing, 0);
});

test('smoothTargetWaypoints averages middle LF points', () => {
  const nodes = [
    { tempKey: 'a', dimensionLevel: 'voyage', dimensionKey: 'TOTAL', weeksUntilSailing: 4, lfPct: 10, pointOrder: 0 },
    { tempKey: 'b', dimensionLevel: 'voyage', dimensionKey: 'TOTAL', weeksUntilSailing: 2, lfPct: 40, pointOrder: 1 },
    { tempKey: 'c', dimensionLevel: 'voyage', dimensionKey: 'TOTAL', weeksUntilSailing: 0, lfPct: 70, pointOrder: 2 },
  ];
  const next = smoothTargetWaypoints(nodes);
  assert.equal(next[0].lfPct, 10);
  assert.equal(next[2].lfPct, 70);
  assert.equal(next[1].lfPct, 40);
});
