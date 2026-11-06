import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeTaliaMaterialisation,
  evaluateGroupPerformance,
  formatMrPct,
  isCancelledStatus,
  isDistressedRemaining,
  normalizeMr,
  scoreTaliaHold,
} from './groupsMaterialisation.js';
import {
  buildGroupsExplorerRows,
  buildGroupsExplorerSnapshot,
} from './groupsExplorerTransform.js';

test('normalizeMr accepts percent and fraction', () => {
  assert.equal(normalizeMr(50), 0.5);
  assert.equal(normalizeMr(0.4), 0.4);
  assert.equal(formatMrPct(0.42), '42%');
});

test('isDistressedRemaining uses 20% threshold', () => {
  assert.equal(isDistressedRemaining(0.15), true);
  assert.equal(isDistressedRemaining(0.25), false);
  assert.equal(isDistressedRemaining(15), true);
});

test('computeTaliaMaterialisation nudges from source by default', () => {
  const off = computeTaliaMaterialisation({
    requestedPax: 100,
    reservedPax: 20,
    sourceMr: 0.9,
    offerHeavy: true,
    hasNamedBooked: false,
    useSourceNudge: false,
  });
  const on = computeTaliaMaterialisation({
    requestedPax: 100,
    reservedPax: 20,
    sourceMr: 0.9,
    offerHeavy: true,
    hasNamedBooked: false,
  });
  assert.equal(off.source_mr, 0.9);
  assert.ok(off.talia_mr < on.talia_mr);
  assert.ok(on.talia_mr < 0.9);
  assert.ok(off.reasons.every((line) => !/mild uplift|mild temper/.test(line)));
  assert.ok(on.reasons.some((line) => /mild uplift|mild temper/.test(line)));
});

test('scoreTaliaHold zeros cancelled holds', () => {
  assert.equal(isCancelledStatus('CX'), true);
  assert.equal(isCancelledStatus('CA'), true);
  const scored = scoreTaliaHold({
    status: 'CX',
    requested: 40,
    named: 0,
    probability: 100,
  });
  assert.equal(scored.taliaExpectedGuests, 0);
  assert.equal(scored.sourceExpectedGuests, 0);
  assert.equal(scored.cancelled, true);
});

test('scoreTaliaHold treats missing named on BK as requested', () => {
  const scored = scoreTaliaHold({
    status: 'BK',
    requested: 54,
    named: null,
    probability: 100,
  });
  assert.equal(scored.namedGuests, 54);
  assert.equal(scored.taliaExpectedGuests, 50);
  assert.ok(scored.talia_mr > 0.85);
});

test('scoreTaliaHold keeps missing named on QT at 0', () => {
  const scored = scoreTaliaHold({
    status: 'QT',
    requested: 54,
    named: null,
    probability: 100,
  });
  assert.equal(scored.namedGuests, 0);
  assert.ok(scored.taliaExpectedGuests < 20);
});

test('evaluateGroupPerformance flags weak large groups', () => {
  const flags = evaluateGroupPerformance({
    talia_mr: 0.2,
    source_mr: 0.6,
    requestedPax: 80,
    requestedCabins: 40,
    groupValueEur: 40000,
  });
  assert.equal(flags.non_performant, true);
  assert.ok(flags.flags.includes('weak_mr'));
  assert.ok(flags.flags.includes('below_source'));
  assert.ok(flags.value_at_risk > 0);
});

test('buildGroupsExplorerRows rolls up by group_id with Talia MR', () => {
  const rows = buildGroupsExplorerRows([
    {
      group_id: '123456',
      agency_id: '1111',
      sail_code: 'CD04270329',
      ship_code: 'CD',
      sail_from_date: '2027-03-29',
      res_status: 'OF',
      pax_type: 'G',
      source_origin: 'fact_group_alloc',
      guest_count: 100,
      group_probability: 50,
      gross_ticket_revenue_eur: 50000,
      res_id: '1234560001',
    },
    {
      group_id: '123456',
      agency_id: '1111',
      sail_code: 'CD04270329',
      ship_code: 'CD',
      sail_from_date: '2027-03-29',
      res_status: 'BK',
      pax_type: 'G',
      guest_count: 20,
      group_probability: 50,
      gross_ticket_revenue_eur: 10000,
      res_id: '998877',
    },
  ], {
    agenciesById: new Map([['1111', { agency_id: '1111', agency_name: 'Demo Agency' }]]),
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].group_id, '123456');
  assert.equal(rows[0].agency_name, 'Demo Agency');
  assert.equal(rows[0].requested_pax >= 100, true);
  assert.equal(rows[0].reserved_pax, 20);
  assert.ok(rows[0].source_mr != null);
  assert.ok(rows[0].talia_mr != null);
  assert.ok(rows[0].mr_reason.length > 0);

  const snap = buildGroupsExplorerSnapshot(rows);
  assert.equal(snap.group_count, 1);
  assert.ok(snap.requested_cabins > 0);
});
