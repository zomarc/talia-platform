import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildRmChecklistMemoText, memoTypeForFinding } from './rmChecklistMemo.js';

const row = {
  findingId: 'f-1',
  subjectId: 'CD03261023',
  severity: 'critical',
  score: 0.94,
  actionType: 'ESCALATE_SAILING',
  rationale: 'Load factor trails the selected target by 15pp or more.',
  loadFactor: 0.581,
  targetLoadFactor: 0.773,
  daysToSail: 23,
  agentId: 'rm.regulator.performance_vs_target',
};

describe('rm checklist memo snapshot', () => {
  it('maps a critical finding to a risk memo', () => {
    assert.equal(memoTypeForFinding(row), 'risk');
    assert.equal(memoTypeForFinding({ actionType: 'REVIEW_PRICING', severity: 'watch' }), 'pricing');
  });

  it('freezes the author, time, and row into the memo text', () => {
    const text = buildRmChecklistMemoText(row, {
      createdBy: 'Dev Admin',
      createdAt: '2026-10-05T12:04:00.000Z',
    });
    assert.match(text, /CD03261023/);
    assert.match(text, /Dev Admin/);
    assert.match(text, /Escalate/);
    assert.match(text, /58\.1%/);
    assert.match(text, /77\.3%/);
    assert.match(text, /Days to sail: 23/);
    assert.match(text, /Finding: f-1/);
  });
});
