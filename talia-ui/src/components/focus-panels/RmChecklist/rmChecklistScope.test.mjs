import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHECKLIST_SELECT_ORIGIN,
  buildFindingSailSelectDetail,
  filterFindingsByHorizon,
  filterFindingsBySailCodes,
  resolveNeighborSailCodes,
  resolveFocusSailing,
  sortFindingsWithFocusFirst,
  uniqueSailCodes,
} from './rmChecklistScope.js';

const row = (id, date, ship) => ({
  subjectId: id,
  subject: { id, sail_date_from: date, ship_code: ship },
  score: 0.5,
});

const inventory = [
  { sail_code: 'CD01', reference_sail_code: 'CD01', ship_code: 'CD', ship_name: 'Discovery', sail_date_from: '2026-09-04', sailing_role: 'master' },
  { sail_code: 'CD01A', reference_sail_code: 'CD01', ship_code: 'CD', sail_date_from: '2026-09-04', sailing_role: 'segment' },
  { sail_code: 'CD02', reference_sail_code: 'CD02', ship_code: 'CD', ship_name: 'Discovery', sail_date_from: '2026-09-07', sailing_role: 'master' },
  { sail_code: 'CD03', reference_sail_code: 'CD03', ship_code: 'CD', ship_name: 'Discovery', sail_date_from: '2026-09-11', sailing_role: 'master' },
  { sail_code: 'CD04', reference_sail_code: 'CD04', ship_code: 'CD', ship_name: 'Discovery', sail_date_from: '2026-09-14', sailing_role: 'master' },
  { sail_code: 'CD05', reference_sail_code: 'CD05', ship_code: 'CD', ship_name: 'Discovery', sail_date_from: '2026-09-18', sailing_role: 'master' },
  { sail_code: 'CJ01', reference_sail_code: 'CJ01', ship_code: 'CJ', ship_name: 'Journey', sail_date_from: '2026-09-05', sailing_role: 'master' },
];

describe('filterFindingsByHorizon', () => {
  const rows = [
    row('A', '2026-11-16', 'CD'),
    row('B', '2026-12-01', 'CJ'),
    row('C', '2026-08-01', 'CD'),
  ];

  it('keeps Findings inside DATE window and ship', () => {
    const next = filterFindingsByHorizon(rows, {
      dateFrom: '2026-11-01',
      dateTo: '2026-11-30',
      shipCode: 'CD',
    });
    assert.deepEqual(next.map((item) => item.subjectId), ['A']);
  });

  it('does not drop Findings that lack a date when the window is set', () => {
    const next = filterFindingsByHorizon([row('X', null, 'CD')], {
      dateFrom: '2026-11-01',
      dateTo: '2026-11-30',
    });
    assert.equal(next.length, 1);
  });
});

describe('neighbors', () => {
  it('resolves the focus sailing from inventory_item', () => {
    const focus = resolveFocusSailing('CD03', inventory);
    assert.equal(focus.sail_code, 'CD03');
    assert.equal(focus.ship_code, 'CD');
    assert.equal(focus.sail_date_from, '2026-09-11');
  });

  it('returns the focus plus two master departures either side on the same ship', () => {
    assert.deepEqual(resolveNeighborSailCodes('CD03', inventory), [
      'CD01', 'CD02', 'CD03', 'CD04', 'CD05',
    ]);
  });

  it('does not treat segments of the focus as neighbors', () => {
    const codes = resolveNeighborSailCodes('CD01', inventory);
    assert.equal(codes.includes('CD01A'), false);
    assert.deepEqual(codes, ['CD01', 'CD02', 'CD03']);
  });

  it('does not include another ship', () => {
    assert.equal(resolveNeighborSailCodes('CD03', inventory).includes('CJ01'), false);
  });

  it('uses extra sailings when inventory is empty', () => {
    const codes = resolveNeighborSailCodes('CD03', [], {
      shipCode: 'CD',
      extraSailings: [
        { sail_code: 'CD02', ship_code: 'CD', sail_date_from: '2026-09-07', sailing_role: 'master' },
        { sail_code: 'CD03', ship_code: 'CD', sail_date_from: '2026-09-11', sailing_role: 'master' },
        { sail_code: 'CD04', ship_code: 'CD', sail_date_from: '2026-09-14', sailing_role: 'master' },
      ],
    });
    assert.deepEqual(codes, ['CD02', 'CD03', 'CD04']);
  });
});

describe('finding filters', () => {
  it('keeps Findings whose subject is in the neighbor set', () => {
    const next = filterFindingsBySailCodes([
      row('CD03', '2026-09-11', 'CD'),
      row('CJ01', '2026-09-05', 'CJ'),
      row('CD04', '2026-09-14', 'CD'),
    ], ['CD03', 'CD04']);
    assert.deepEqual(next.map((item) => item.subjectId), ['CD03', 'CD04']);
  });

  it('keeps a segment Finding when the master is selected', () => {
    const next = filterFindingsBySailCodes([{
      subjectId: 'CD01A',
      subject: { id: 'CD01A', reference_sail_code: 'CD01', sail_date_from: '2026-09-04', ship_code: 'CD' },
    }], ['CD01']);
    assert.equal(next.length, 1);
  });

  it('emits a checklist-origin sail select from a Finding', () => {
    const detail = buildFindingSailSelectDetail(row('CD03', '2026-09-11', 'CD'));
    assert.equal(detail.sail_code, 'CD03');
    assert.equal(detail.selection_origin, CHECKLIST_SELECT_ORIGIN);
  });

  it('dedupes sail codes used for This matching', () => {
    assert.deepEqual(uniqueSailCodes(['CD01', 'CD01'], 'CD01A', [null, 'CD01']), ['CD01', 'CD01A']);
  });

  it('sorts the focus sailing ahead of neighbors', () => {
    const next = sortFindingsWithFocusFirst([
      { ...row('CD04', '2026-09-14', 'CD'), score: 0.9 },
      { ...row('CD03', '2026-09-11', 'CD'), score: 0.2 },
    ], 'CD03');
    assert.deepEqual(next.map((item) => item.subjectId), ['CD03', 'CD04']);
  });
});
