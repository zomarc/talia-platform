import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseAction,
  evaluateRegulatorSails,
  interpolateTargetLf,
  regulatorScore,
} from './regulatorMath.ts';

describe('regulatorMath', () => {
  it('interpolates voyage LF targets between week points', () => {
    const lf = interpolateTargetLf([
      { weeks_until_sailing: 0, lf_pct: 80 },
      { weeks_until_sailing: 8, lf_pct: 40 },
    ], 28);
    assert.ok(lf != null);
    assert.ok(Math.abs((lf || 0) - 0.6) < 0.001);
  });

  it('scores urgency higher when further behind and closer to sail', () => {
    const far = regulatorScore(-0.18, 20);
    const near = regulatorScore(-0.04, 120);
    assert.ok(far > near);
    assert.ok(far > 0.6);
    assert.ok(near < 0.4);
  });

  it('escalates only for a material miss', () => {
    assert.equal(chooseAction(-0.16, 40, true).action_type, 'ESCALATE_SAILING');
    assert.equal(chooseAction(-0.09, 30, true).action_type, 'REVIEW_PRICING');
    assert.equal(chooseAction(0.02, 30, true).action_type, 'REVIEW_TARGET');
    assert.equal(chooseAction(0, 30, false).action_type, 'REVIEW_TARGET');
  });

  it('emits Findings with urgency scores in [0, 1]', () => {
    const findings = evaluateRegulatorSails([
      {
        sail_code: 'CD03260605',
        ship_code: 'CD',
        sail_date_from: '2026-10-01',
        load_factor: 0.41,
        target_load_factor: 0.55,
        days_to_sail: 46,
      },
    ], new Date('2026-09-07T12:00:00Z'));
    assert.equal(findings.length, 1);
    assert.equal(findings[0].agent_id, 'rm.regulator.performance_vs_target');
    assert.equal(findings[0].subject.id, 'CD03260605');
    assert.ok(findings[0].score >= 0 && findings[0].score <= 1);
    assert.equal(findings[0].severity, 'action');
    assert.equal(findings[0].recommended_action.action_type, 'REVIEW_PRICING');
  });

  it('does not treat a missing target as a 12pp miss', () => {
    const findings = evaluateRegulatorSails([
      {
        sail_code: 'XX1',
        load_factor: 0.5,
        target_load_factor: null,
        days_to_sail: 10,
      },
    ], new Date('2026-09-07T12:00:00Z'));
    assert.equal(findings[0].score, 0.4);
    assert.equal(findings[0].severity, 'watch');
    assert.equal(findings[0].recommended_action.action_type, 'REVIEW_TARGET');
  });
});
