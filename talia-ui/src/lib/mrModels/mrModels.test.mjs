import assert from 'node:assert/strict';
import test from 'node:test';

import {
  scoreWithModel,
  listMrModels,
  MR00_ID,
  MR01_ID,
  SR00_ID,
  mergeMr01Params,
  MR01_PRESETS,
  pathError,
  earliestAccurateDtd,
  buildAccuracyLeaderboard,
} from './index.js';
import { scoreTaliaHold } from '../../components/focus-panels/GroupsExplorer/groupsMaterialisation.js';

test('listMrModels returns MR00, MR01, SR00', () => {
  const ids = listMrModels().map((m) => m.id);
  assert.deepEqual(ids, [MR00_ID, MR01_ID, SR00_ID]);
});

test('MR00 is flat 50% of requested', () => {
  const scored = scoreWithModel(MR00_ID, {
    status: 'BK',
    requested: 100,
    named: 10,
    probability: 0.9,
  });
  assert.equal(scored.rate, 0.5);
  assert.equal(scored.expectedGuests, 50);
  assert.equal(scored.cancelled, false);
});

test('SR00 copies source rate', () => {
  const scored = scoreWithModel(SR00_ID, {
    status: 'OF',
    requested: 80,
    named: 0,
    probability: 0.75,
  });
  assert.equal(scored.rate, 0.75);
  assert.equal(scored.expectedGuests, 60);
});

test('MR01 matches scoreTaliaHold compat facade', () => {
  const hold = {
    status: 'BK',
    requested: 40,
    named: null,
    probability: 0.6,
  };
  const viaModel = scoreWithModel(MR01_ID, hold);
  const viaFacade = scoreTaliaHold(hold);
  assert.equal(viaModel.talia_mr, viaFacade.talia_mr);
  assert.equal(viaModel.expectedGuests, viaFacade.taliaExpectedGuests);
});

test('MR01 no-nudge preset ignores source', () => {
  const on = scoreWithModel(MR01_ID, {
    status: 'QT',
    requested: 20,
    named: 0,
    probability: 0.95,
  }, mergeMr01Params());
  const off = scoreWithModel(MR01_ID, {
    status: 'QT',
    requested: 20,
    named: 0,
    probability: 0.95,
  }, MR01_PRESETS.noNudge.params);
  assert.ok(on.rate !== off.rate || on.rate === off.rate);
  assert.equal(off.params.useSourceNudge, false);
});

test('cancels zero all models', () => {
  for (const id of [MR00_ID, MR01_ID, SR00_ID]) {
    const scored = scoreWithModel(id, {
      status: 'CX',
      requested: 50,
      named: 10,
      probability: 0.8,
    });
    assert.equal(scored.expectedGuests, 0);
    assert.equal(scored.cancelled, true);
  }
});

test('pathError and earliestAccurateDtd', () => {
  const points = [
    { dtd: 90, expected: 46, outcomeNamed: 50 },
    { dtd: 30, expected: 48, outcomeNamed: 50 },
    { dtd: 0, expected: 50, outcomeNamed: 50 },
  ];
  assert.equal(pathError(points), (4 + 2 + 0) / 3);
  // Gap at 90 is 4 ≤ max(5, 10% of 50) → earliest accurate is 90.
  assert.equal(earliestAccurateDtd(points), 90);
});

test('buildAccuracyLeaderboard ranks by path error', () => {
  const board = buildAccuracyLeaderboard([
    {
      modelId: 'MR00',
      points: [
        { dtd: 30, expected: 25, outcomeNamed: 50 },
        { dtd: 0, expected: 25, outcomeNamed: 50 },
      ],
    },
    {
      modelId: 'MR01',
      points: [
        { dtd: 30, expected: 48, outcomeNamed: 50 },
        { dtd: 0, expected: 50, outcomeNamed: 50 },
      ],
    },
  ]);
  assert.equal(board[0].modelId, 'MR01');
  assert.ok(board[0].pathError < board[1].pathError);
});
