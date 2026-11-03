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
  change_days: 4,
  hold_date: '2024-01-22',
  hold_status: 'QT',
  hold_requested: 40,
  hold_probability: 100,
  hold_manual: false,
  hold_named: null,
  ...overrides,
});

test('a multi-day empty quote is hindsight and is highlighted', () => {
  const path = buildSourceMrPath({
    holds: [
      quote(),
      quote({
        group_id: 1,
        hold_status: 'BK',
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
  assert.match(path.assumptions[0], /hindsight/);
  assert.equal(path.highlights.length, 1);
  assert.equal(path.highlights[0].groupId, '28657');
  assert.equal(path.highlights[0].sourceExpectedGuests, 40);
  assert.equal(path.highlights[0].taliaExpectedGuests, 11);
  assert.equal(path.highlights[0].namedGuests, 0);
  const month = path.months.find((row) => row.month === '2024-06');
  assert.ok(month.highlightedGroups >= 1);
});

test('a header named count replaces the final count', () => {
  const path = buildSourceMrPath({
    holds: [quote({ hold_named: 40, final_named: 0, change_days: 3 })],
  });
  assert.equal(path.namesFromHistory, true);
  assert.match(path.assumptions[0], /names known then/);
  assert.equal(path.highlights.length, 0);
  assert.equal(path.namedGuests, 40);
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

test('path days repeat the final named count until history carries names', () => {
  const series = buildSourceMrPathDays({
    groupId: 28657,
    sailDate: '2024-06-28',
    finalNamed: 0,
    days: [
      { changed_on: '2023-08-01', group_status: 'QT', n_of_guests: 40, probability: 100, is_prob_manual: false, named_guests: null },
      { changed_on: '2024-01-22', group_status: 'QT', n_of_guests: 40, probability: 100, is_prob_manual: false, named_guests: null },
      { changed_on: '2024-08-01', group_status: 'QT', n_of_guests: 40, probability: 50, is_prob_manual: false, named_guests: null },
    ],
  });
  assert.equal(series.namesFromHistory, false);
  assert.equal(series.days.length, 2);
  assert.equal(series.days[0].taliaExpectedGuests, 11);
  assert.equal(series.days[1].namedGuests, 0);
  assert.match(series.assumptions[0], /final count/);
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
  assert.match(html, /hindsight/);
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
