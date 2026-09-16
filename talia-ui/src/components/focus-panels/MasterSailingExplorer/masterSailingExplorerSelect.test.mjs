import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMseSailSelectDetail,
  resolveMseMasterCode,
  shouldEmitMseSelection,
  shouldSkipDuplicateMseEmit,
} from './masterSailingExplorerSelect.js';
import { buildMasterSailingExplorerColumns, shortenTargetProfileName } from './masterSailingExplorerColumns.js';

const master = {
  row_type: 'master',
  sail_code: 'CD04261116',
  reference_sail_code: 'CD04261116',
  ship_code: 'CD',
  ship_name: 'Celestyal Discovery',
  sail_date_from: '2026-11-16',
  segment_codes: ['CD04261116'],
  sailing_role: 'master',
};

test('resolveMseMasterCode reads reference then sail code', () => {
  assert.equal(resolveMseMasterCode(master), 'CD04261116');
  assert.equal(resolveMseMasterCode({ row_type: 'day', sail_code: 'x' }), null);
});

test('shouldEmitMseSelection ignores day rows and expand-toggle clicks', () => {
  assert.equal(shouldEmitMseSelection(master, {}), true);
  assert.equal(shouldEmitMseSelection({ ...master, row_type: 'day' }, {}), false);
  assert.equal(shouldEmitMseSelection(master, {
    target: { closest: (sel) => sel.includes('expand_toggle') },
  }), false);
});

test('buildMseSailSelectDetail keeps a slim canonical payload', () => {
  const detail = buildMseSailSelectDetail({
    ...master,
    total_booked: 243,
    segment_summaries: [{ sail_code: 'CD04261116', guests: 100 }],
  });
  assert.equal(detail.sail_code, 'CD04261116');
  assert.equal(detail.selection_origin, 'master-sailing-explorer');
  assert.deepEqual(Object.keys(detail.row_data).sort(), [
    'reference_sail_code',
    'sail_code',
    'sail_date_from',
    'sailing_role',
    'segment_codes',
    'ship_code',
    'ship_name',
  ]);
  assert.equal(detail.row_data.total_booked, undefined);
});

test('shouldSkipDuplicateMseEmit suppresses the follow-up click', () => {
  assert.equal(shouldSkipDuplicateMseEmit({ code: 'CD04261116', t: 1000 }, 'CD04261116', 1100), true);
  assert.equal(shouldSkipDuplicateMseEmit({ code: 'CD04261116', t: 1000 }, 'CD04261102', 1100), false);
  assert.equal(shouldSkipDuplicateMseEmit({ code: 'CD04261116', t: 1000 }, 'CD04261116', 1900), false);
});

test('compact MSE columns are Date, Bk B, Bk C, and vs Tgt', () => {
  const columns = buildMasterSailingExplorerColumns({ compact: true, viewMode: 'flat' });
  assert.deepEqual(columns.map((col) => col.field), [
    'sail_date_from',
    'berths_occupied',
    'booked_cabins',
    'target_review_status',
  ]);
  assert.deepEqual(columns.map((col) => col.title), ['Date', 'Bk B', 'Bk C', 'vs Tgt']);
  assert.equal(columns.some((col) => col.field === 'expand_toggle'), false);
});

test('shortenTargetProfileName drops suggested prefix', () => {
  assert.equal(shortenTargetProfileName('Suggested · CD04250907'), 'CD04250907');
  assert.equal(shortenTargetProfileName('Commercial plan'), 'Commercial plan');
});
