import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSourceMrPathDays } from '../../../talia-server/src/services/sourceMrPath.js';
import {
  addDays,
  aggregateDtdSeries,
  asOfAtDtd,
  buildCompareRetrospect,
  buildDtdSeries,
  buildRetrospectAnnotations,
  daysBetween,
  dtdForChangeDay,
  pickStep,
} from './mrRetrospect.js';

test('daysBetween and addDays are UTC calendar-day safe', () => {
  assert.equal(daysBetween('2024-06-01', '2024-06-28'), 27);
  assert.equal(addDays('2024-06-28', -30), '2024-05-29');
  assert.equal(dtdForChangeDay('2024-01-22', '2024-06-28'), 158);
});

test('asOfAtDtd takes the last hold on or before sail − DTD', () => {
  const series = buildSourceMrPathDays({
    groupId: 28657,
    sailDate: '2024-06-28',
    finalNamed: 11,
    days: [
      { changed_on: '2023-08-01', group_status: 'QT', n_of_guests: 40, probability: 100, named_guests: null },
      { changed_on: '2024-01-22', group_status: 'QT', n_of_guests: 40, probability: 100, named_guests: null },
      { changed_on: '2024-05-01', group_status: 'QT', n_of_guests: 40, probability: 50, named_guests: null },
    ],
  });
  const at90 = asOfAtDtd(series.days, series.sailDateFrom, 90);
  assert.equal(at90.holdDate, '2024-01-22');
  assert.equal(at90.sourceExpectedGuests, 40);
  assert.equal(at90.taliaExpectedGuests, series.days[0].taliaExpectedGuests);
  const at30 = asOfAtDtd(series.days, series.sailDateFrom, 30);
  assert.equal(at30.holdDate, '2024-05-01');
  assert.equal(at30.sourceExpectedGuests, 20);
  assert.equal(at30.taliaExpectedGuests, series.days.find((day) => day.changedDate === '2024-05-01').taliaExpectedGuests);
});

test('buildDtdSeries compares Talia suggestion with final named outcome', () => {
  const series = buildSourceMrPathDays({
    groupId: 28657,
    sailDate: '2024-06-28',
    finalNamed: 0,
    days: [
      { changed_on: '2024-01-22', group_status: 'QT', n_of_guests: 40, probability: 100, named_guests: null },
      { changed_on: '2024-05-29', group_status: 'QT', n_of_guests: 40, probability: 100, named_guests: null },
    ],
  });
  const dtd = buildDtdSeries(series, { steps: [90, 30, 0] });
  assert.equal(dtd.outcomeNamed, 0);
  assert.equal(dtd.steps.length, 3);
  assert.equal(dtd.steps[0].dtd, 90);
  assert.equal(dtd.steps[0].taliaGap, 11);
  assert.equal(dtd.steps[0].sourceGap, 40);
  assert.equal(pickStep(dtd, 30).holdDate, '2024-05-29');
});

test('aggregateDtdSeries sums sailing groups at shared checkpoints', () => {
  const a = buildSourceMrPathDays({
    groupId: 1,
    sailDate: '2024-06-28',
    finalNamed: 10,
    days: [
      { changed_on: '2024-01-22', group_status: 'QT', n_of_guests: 40, probability: 100, named_guests: null },
    ],
  });
  const b = buildSourceMrPathDays({
    groupId: 2,
    sailDate: '2024-06-28',
    finalNamed: 5,
    days: [
      { changed_on: '2024-01-22', group_status: 'QT', n_of_guests: 20, probability: 100, named_guests: null },
    ],
  });
  const rollup = aggregateDtdSeries([a, b], [90, 0]);
  assert.equal(rollup.groupCount, 2);
  const at90 = pickStep(rollup, 90);
  assert.equal(at90.sourceExpectedGuests, 60);
  assert.equal(at90.outcomeNamed, 15);
  assert.equal(at90.taliaExpectedGuests, a.days[0].taliaExpectedGuests + b.days[0].taliaExpectedGuests);
});

test('buildRetrospectAnnotations marks source changes and first named', () => {
  const series = buildSourceMrPathDays({
    groupId: 1,
    sailDate: '2024-06-28',
    finalNamed: 11,
    days: [
      { changed_on: '2024-01-22', group_status: 'QT', n_of_guests: 40, probability: 100, named_guests: 0 },
      { changed_on: '2024-05-01', group_status: 'QT', n_of_guests: 40, probability: 50, named_guests: 0 },
      { changed_on: '2024-06-01', group_status: 'BK', n_of_guests: 40, probability: 50, named_guests: 11 },
    ],
  });
  const marks = buildRetrospectAnnotations(series);
  assert.ok(marks.some((row) => row.kind === 'source' && row.dtd === 58));
  assert.ok(marks.some((row) => row.kind === 'named' && row.dtd === 27 && /Named 11/.test(row.label)));
  const source = marks.find((row) => row.kind === 'source');
  assert.match(source.tip, /days before departure/);
  assert.match(source.tip, /Hold date/);
});

test('buildCompareRetrospect overlays per-model expected guests', () => {
  const series = buildSourceMrPathDays({
    groupId: 1,
    sailDate: '2024-06-28',
    finalNamed: 20,
    days: [
      { changed_on: '2024-01-22', group_status: 'BK', n_of_guests: 40, probability: 80, named_guests: 10 },
    ],
  });
  const base = buildDtdSeries(series, { steps: [90, 0] });
  const mr00 = {
    ...base,
    steps: base.steps.map((step) => ({
      ...step,
      taliaMr: 0.5,
      taliaExpectedGuests: 20,
    })),
  };
  const mr01 = {
    ...base,
    steps: base.steps.map((step) => ({
      ...step,
      taliaMr: 0.7,
      taliaExpectedGuests: 28,
    })),
  };
  const compare = buildCompareRetrospect({ MR00: mr00, MR01: mr01 }, ['MR00', 'MR01']);
  assert.deepEqual(compare.modelIds, ['MR00', 'MR01']);
  assert.equal(compare.steps[0].byModel.MR00.expectedGuests, 20);
  assert.equal(compare.steps[0].byModel.MR01.expectedGuests, 28);
  assert.equal(compare.steps[0].byModel.MR01.gap, 28 - compare.steps[0].outcomeNamed);
});

test('aggregateDtdSeries keeps every group at a hold unique to one group', () => {
  const a = buildSourceMrPathDays({
    groupId: 1,
    sailDate: '2024-06-28',
    finalNamed: 10,
    days: [
      { changed_on: '2024-01-22', group_status: 'QT', n_of_guests: 40, probability: 100, named_guests: null },
      { changed_on: '2024-06-16', group_status: 'QT', n_of_guests: 40, probability: 100, named_guests: null },
    ],
  });
  const b = buildSourceMrPathDays({
    groupId: 2,
    sailDate: '2024-06-28',
    finalNamed: 5,
    days: [
      { changed_on: '2024-01-22', group_status: 'QT', n_of_guests: 20, probability: 100, named_guests: null },
    ],
  });
  // DTD 12 is only a hold for group A; B must still be carried forward (not dropped).
  const rollup = aggregateDtdSeries([a, b], [90, 0]);
  const at12 = pickStep(rollup, 12);
  assert.equal(at12.groupCount, 2);
  assert.equal(at12.sourceExpectedGuests, 60);
  assert.equal(at12.outcomeNamed, 15);
});
