import assert from 'node:assert/strict';
import test from 'node:test';
import { computeTaliaMaterialisation } from '../components/focus-panels/GroupsExplorer/groupsMaterialisation.js';
import {
  buildSourceMrReview,
  materialiseExtractGroup,
  pickTestCandidate,
} from '../../../talia-server/src/services/sourceMrReview.js';

const quote = (groupId, guests, sailDate) => ({
  rec_group_id: groupId,
  group_id: groupId,
  group_status: 'QT',
  sail_date_from: sailDate,
  sail_date_to: sailDate,
  changed_date: '2025-02-10',
  n_of_guests: guests,
  n_of_delegate_guests: 0,
  n_of_cabins: guests / 2,
  probability: 100,
  is_prob_manual: false,
});

test('quote materialisation does not copy a 100% source rate', () => {
  const row = quote(24567, 750, '2024-10-04');
  // Source MR Review keeps nudge off unless explicitly enabled (calibration surface).
  const local = computeTaliaMaterialisation({
    requestedPax: 750,
    reservedPax: 0,
    sourceMr: 100,
    hasNamedBooked: false,
    offerHeavy: true,
    useSourceNudge: false,
  });
  const reviewed = materialiseExtractGroup(row);
  assert.equal(reviewed.talia_mr, local.talia_mr);
  assert.ok(reviewed.talia_mr < 0.4);
  assert.equal(reviewed.source_mr, 1);
});

test('the test candidate is a controller-sized sailed quote, not a whole-ship placeholder', () => {
  const groups = [
    quote(23533, 100, '2024-06-21'),
    quote(24567, 750, '2024-10-04'),
    quote(99999, 800, '2026-06-01'),
  ];
  const review = buildSourceMrReview({
    groups,
    shipsByRecGroupId: new Map([['23533', { ship_code: 'CO', sail_id: 12 }]]),
  });
  assert.equal(review.feedThrough, '2025-02-10');
  assert.equal(review.candidate.groupId, '23533');
  assert.equal(review.candidate.shipCode, 'CO');
  assert.equal(review.candidate.requestedGuests, 100);
  assert.equal(review.candidate.namedGuests, 0);
  assert.equal(review.candidate.sourceExpectedGuests, 100);
  assert.ok(review.candidate.taliaExpectedGuests < 40);
  assert.equal(pickTestCandidate(
    groups.map((row) => ({
      row,
      status: 'QT',
      requested: row.n_of_guests,
      named: 0,
      rates: { source_mr: 1 },
    })),
    '2025-02-10'
  ).row.group_id, 23533);

  const quotes = review.statuses.find((status) => status.status === 'QT');
  assert.equal(quotes.sailedRequestedGuests, 850);
  assert.equal(quotes.sailedNamedGuests, 0);
  assert.equal(quotes.sailedSourceExpectedGuests, 850);
  assert.equal(quotes.openRequestedGuests, 800);

  const withHistory = buildSourceMrReview({
    groups: [
      quote(50577, 120, '2024-08-24'),
      quote(28657, 40, '2024-06-28'),
    ],
    activityByGroupId: new Map([['28657', 4], ['50577', 1]]),
  });
  assert.equal(withHistory.candidate.groupId, '28657');
});

test('ship and date filters override the portfolio without changing the extract end', () => {
  const groups = [
    quote(1, 40, '2023-06-01'),
    quote(2, 80, '2024-06-01'),
  ];
  groups[0].rec_group_id = 1;
  groups[1].rec_group_id = 2;
  const ships = new Map([
    [1, { ship_code: 'CO' }],
    ['2', { ship_code: 'EV' }],
  ]);
  const review = buildSourceMrReview({
    groups,
    shipsByRecGroupId: ships,
    shipCode: 'EV',
    dateFrom: '2024-01-01',
    dateTo: '2024-12-31',
  });
  assert.equal(review.feedThrough, '2025-02-10');
  assert.equal(review.unfilteredGroupCount, 2);
  assert.equal(review.groupCount, 1);
  assert.deepEqual(review.ships, ['CO', 'EV']);
  assert.equal(review.sailDateMin, '2023-06-01');
  assert.equal(review.candidate.groupId, '2');
  const quotes = review.statuses.find((status) => status.status === 'QT');
  assert.equal(quotes.sailedRequestedGuests, 80);
});
