import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { severityFromScore, validateFinding, type Finding } from './finding.ts';

const sample = (): Finding => ({
  finding_id: 'f-1',
  agent_id: 'rm.regulator.performance_vs_target',
  subject: { type: 'sailing', id: 'SAIL-1' },
  as_of: '2026-09-07T12:00:00Z',
  score: 0.82,
  severity: 'action',
  recommended_action: {
    action_type: 'REVIEW_PRICING',
    params: { dimension: 'occupancy' },
    rationale: 'Behind target.',
  },
  evidence: { load_factor: 0.41 },
  status: 'open',
});

describe('Finding contract', () => {
  it('accepts a valid Finding', () => {
    assert.deepEqual(validateFinding(sample()), []);
  });

  it('rejects a signed-looking agent id and out-of-range score', () => {
    const bad = sample();
    bad.agent_id = 'regulator';
    bad.score = 1.4;
    const errors = validateFinding(bad);
    assert.ok(errors.some((row) => row.includes('agent_id')));
    assert.ok(errors.some((row) => row.includes('score')));
  });

  it('maps score bands to severity', () => {
    assert.equal(severityFromScore(0.2), 'info');
    assert.equal(severityFromScore(0.4), 'watch');
    assert.equal(severityFromScore(0.7), 'action');
    assert.equal(severityFromScore(0.9), 'critical');
  });
});
