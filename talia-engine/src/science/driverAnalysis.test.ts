import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPythonAnalyze } from '../python/runner.ts';
import { SCIENCE_TASK_ID, validateScienceEvidence } from '../contracts/evidence.ts';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../python/driver_analysis.py');

describe('driver_analysis python element', () => {
  it('emits advisory Evidence without Finding score/action', async () => {
    const historic = [
      {
        sail_code: 'H1', ship_code: 'CL', sail_date_from: '2024-06-10',
        end_lf: 0.78, total_cabins: 200, occupied_cabins: 156, horizon: 'historic',
      },
      {
        sail_code: 'H2', ship_code: 'CL', sail_date_from: '2024-07-08',
        end_lf: 0.71, total_cabins: 200, occupied_cabins: 142, horizon: 'historic',
      },
      {
        sail_code: 'H3', ship_code: 'CL', sail_date_from: '2024-08-05',
        end_lf: 0.66, total_cabins: 200, occupied_cabins: 132, horizon: 'historic',
      },
      {
        sail_code: 'H4', ship_code: 'CL', sail_date_from: '2023-06-12',
        end_lf: 0.74, total_cabins: 200, occupied_cabins: 148, horizon: 'historic',
      },
    ];
    const subjects = [
      {
        sail_code: 'H1', ship_code: 'CL', sail_date_from: '2024-06-10',
        end_lf: 0.78, total_cabins: 200, occupied_cabins: 156, horizon: 'historic',
        manual_peer_sail_code: 'H4',
      },
      {
        sail_code: 'F1', ship_code: 'CL', sail_date_from: '2026-06-15',
        observed_lf: 0.42, total_cabins: 200, occupied_cabins: 84,
        weeks_until_sailing: 10, horizon: 'forward_now',
        group_requested: 120, group_reserved: 60, talia_mr: 0.55,
      },
    ];

    const result = await runPythonAnalyze({
      task: SCIENCE_TASK_ID,
      payload: {
        as_of: new Date().toISOString(),
        role: 'advisory',
        scope: { type: 'test' },
        historic,
        subjects,
      },
    }, script);

    assert.equal(result.ok, true, result.error);
    const body = result.result as any;
    assert.equal(body.tool, 'driver_analysis');
    assert.equal(body.score, null);
    assert.equal(body.recommended_action, null);
    assert.ok(Array.isArray(body.artifacts) && body.artifacts.length === 2);

    for (const artifact of body.artifacts) {
      const errors = validateScienceEvidence(artifact);
      assert.deepEqual(errors, [], errors.join('; '));
      assert.equal(artifact.role, 'advisory');
      assert.ok(artifact.peerset.n >= 1);
      assert.ok(artifact.covariate_ranks.length >= 1);
      assert.ok(artifact.reasons.length >= 1);
    }

    const historicEv = body.artifacts.find((a: any) => a.subject.horizon === 'historic');
    const forwardEv = body.artifacts.find((a: any) => a.subject.horizon === 'forward_now');
    assert.ok(historicEv.decision_moments.length >= 1);
    assert.ok(forwardEv.forward_now);
    assert.equal(typeof forwardEv.forward_now.revenue_at_stake, 'number');
  });
});
