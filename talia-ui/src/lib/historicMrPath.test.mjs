import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSourceMrPath, buildSourceMrPathDays } from '../../../talia-server/src/services/sourceMrPath.js';
import { planningValue } from './historicMrPath.js';
import { buildHistoricMrPathExport } from './historicMrPathPrint.js';

const quote = (overrides = {}) => ({
  group_id: 28657,
  ship_code: 'CO',
  sail_date_from: '2024-06-28',
  sail_date_to: '2024-07-01',
  final_named: 0,
  current_status: 'QT',
  change_days: 4,
  hold_date: '2024-01-22',
  hold_status: 'QT',
  hold_requested: 40,
  hold_probability: 100,
  hold_manual: false,
  hold_named: null,
  ...overrides,
});

test('a multi-day empty quote keeps low as-of named and is highlighted', () => {
  const path = buildSourceMrPath({
    holds: [
      quote(),
      quote({
        group_id: 1,
        hold_status: 'BK',
        current_status: 'BK',
        final_named: 40,
        hold_probability: 90,
        sail_date_from: '2024-06-28',
        change_days: 3,
      }),
      quote({
        group_id: 2,
        change_days: 1,
        sail_date_from: '2024-07-01',
      }),
    ],
  });
  assert.equal(path.namesFromHistory, false);
  assert.match(path.assumptions[0], /booked \(BK\) holds use the requested size/);
  assert.equal(path.highlights.length, 1);
  assert.equal(path.highlights[0].groupId, '28657');
  assert.equal(path.highlights[0].sourceExpectedGuests, 40);
  // Empty quote, source nudge on by default → ~11 expected
  assert.equal(path.highlights[0].taliaExpectedGuests, 11);
  assert.equal(path.highlights[0].namedGuests, 0);
  const month = path.months.find((row) => row.month === '2024-06');
  assert.ok(month.highlightedGroups >= 1);
});

test('BK with missing named uses requested as booked evidence', () => {
  const series = buildSourceMrPathDays({
    groupId: 58849,
    sailDate: '2026-10-05',
    finalNamed: 58,
    days: [
      {
        changed_on: '2026-09-02',
        group_status: 'BK',
        n_of_guests: 54,
        probability: 100,
        named_guests: null,
      },
    ],
  });
  assert.equal(series.days[0].namedGuests, 54);
  assert.equal(series.days[0].sourceExpectedGuests, 54);
  // ~90.5% after blend+lift, mild source nudge → ~50 expected (near source 54 / outcome 58)
  assert.equal(series.days[0].taliaExpectedGuests, 50);
  assert.ok(series.days[0].taliaMr > 0.85);
});

test('explicit header named wins over BK inference', () => {
  const series = buildSourceMrPathDays({
    groupId: 1,
    sailDate: '2026-10-05',
    finalNamed: 58,
    days: [
      {
        changed_on: '2026-09-02',
        group_status: 'BK',
        n_of_guests: 54,
        probability: 100,
        named_guests: 10,
      },
    ],
  });
  assert.equal(series.days[0].namedGuests, 10);
  assert.ok(series.days[0].taliaExpectedGuests < 40);
});

test('a header named count is as-of evidence', () => {
  const path = buildSourceMrPath({
    holds: [quote({ hold_named: 40, final_named: 0, change_days: 3 })],
  });
  assert.equal(path.namesFromHistory, true);
  assert.match(path.assumptions[0], /names known then/);
  assert.equal(path.highlights.length, 0);
  assert.equal(path.namedGuests, 0);
});

test('cancelled current status is omitted from forward totals but kept in groups', () => {
  const path = buildSourceMrPath({
    holds: [
      quote(),
      quote({
        group_id: 9,
        hold_status: 'CX',
        current_status: 'CX',
        final_named: 0,
        hold_requested: 80,
        hold_probability: 100,
        change_days: 2,
      }),
    ],
  });
  assert.equal(path.sailedGroupCount, 1);
  assert.equal(path.cancelledGroupCount, 1);
  assert.equal(path.sourceExpectedGuests, 40);
  assert.equal(path.groups.length, 2);
  const cancelled = path.groups.find((row) => row.groupId === '9');
  assert.equal(cancelled.taliaExpectedGuests, 0);
  assert.equal(cancelled.sourceExpectedGuests, 0);
  assert.equal(cancelled.cancelled, true);
});

test('ship and date filters keep the unfiltered sailed count', () => {
  const path = buildSourceMrPath({
    holds: [
      quote(),
      quote({ group_id: 9, ship_code: 'CD', sail_date_from: '2023-01-02' }),
    ],
    shipCode: 'CO',
    dateFrom: '2024-01-01',
    dateTo: '2024-12-31',
  });
  assert.equal(path.unfilteredSailedCount, 2);
  assert.equal(path.sailedGroupCount, 1);
  assert.deepEqual(path.ships, ['CD', 'CO']);
});

test('path days use as-of named 0 for QT when history has no names', () => {
  const series = buildSourceMrPathDays({
    groupId: 28657,
    sailDate: '2024-06-28',
    finalNamed: 11,
    days: [
      { changed_on: '2023-08-01', group_status: 'QT', n_of_guests: 40, probability: 100, is_prob_manual: false, named_guests: null },
      { changed_on: '2024-01-22', group_status: 'QT', n_of_guests: 40, probability: 100, is_prob_manual: false, named_guests: null },
      { changed_on: '2024-08-01', group_status: 'QT', n_of_guests: 40, probability: 50, is_prob_manual: false, named_guests: null },
    ],
  });
  assert.equal(series.namesFromHistory, false);
  assert.equal(series.namedGuests, 11);
  assert.equal(series.days.length, 2);
  assert.equal(series.days[0].namedGuests, 0);
  assert.equal(series.days[0].taliaExpectedGuests, 11);
  assert.equal(series.days[1].namedGuests, 0);
  assert.match(series.assumptions[0], /booked \(BK\) holds use the requested size/);
});

test('path days after cancel score expected guests as 0', () => {
  const series = buildSourceMrPathDays({
    groupId: 1,
    sailDate: '2024-06-28',
    finalNamed: 0,
    days: [
      { changed_on: '2024-01-22', group_status: 'QT', n_of_guests: 40, probability: 100, named_guests: null },
      { changed_on: '2024-05-01', group_status: 'CX', n_of_guests: 40, probability: 100, named_guests: null },
    ],
  });
  assert.equal(series.days[0].taliaExpectedGuests, 11);
  assert.equal(series.days[1].taliaExpectedGuests, 0);
  assert.equal(series.days[1].sourceExpectedGuests, 0);
  assert.equal(series.days[1].cancelled, true);
});

test('source nudge off restores low empty-quote Talia', () => {
  const off = buildSourceMrPathDays({
    groupId: 1,
    sailDate: '2024-06-28',
    finalNamed: 0,
    useSourceNudge: false,
    days: [
      { changed_on: '2024-01-22', group_status: 'QT', n_of_guests: 40, probability: 100, named_guests: null },
    ],
  });
  const on = buildSourceMrPathDays({
    groupId: 1,
    sailDate: '2024-06-28',
    finalNamed: 0,
    useSourceNudge: true,
    days: [
      { changed_on: '2024-01-22', group_status: 'QT', n_of_guests: 40, probability: 100, named_guests: null },
    ],
  });
  assert.equal(off.days[0].taliaExpectedGuests, 6);
  assert.equal(on.days[0].taliaExpectedGuests, 11);
});

test('planning value stays empty until a rate is typed, and the pdf states the assumptions', () => {
  assert.equal(planningValue(100, 40, ''), null);
  assert.equal(planningValue(100, 40, '250').euros, 15000);
  const path = buildSourceMrPath({ holds: [quote()] });
  const html = buildHistoricMrPathExport({
    path,
    planning: planningValue(path.sourceExpectedGuests, path.namedGuests, '200'),
    charts: [{ id: 'months', image: 'javascript:alert(1)' }, { id: 'months', image: 'data:image/png;base64,abc' }],
  });
  assert.match(html, /booked \(BK\) holds use the requested size/);
  assert.match(html, /GROUP_ExpectedAddition/);
  assert.match(html, /8,000/);
  assert.match(html, /data:image\/png/);
  assert.doesNotMatch(html, /javascript:/);
  const hidden = buildHistoricMrPathExport({
    path,
    includeAssumptions: false,
    charts: [{ id: 'range', image: 'data:image/png;base64,abc' }],
  });
  assert.doesNotMatch(hidden, /<h2>Assumptions<\/h2>/);
  assert.match(hidden, /This range/);
  assert.match(hidden, /data:image\/png/);
});
