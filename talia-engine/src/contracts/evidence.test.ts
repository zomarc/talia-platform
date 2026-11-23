import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canPromoteToSource,
  citeEvidence,
  SCIENCE_TASK_ID,
  validateScienceEvidence,
  type ScienceEvidence,
} from './evidence.ts';

const sample = (): ScienceEvidence => ({
  evidence_id: 'ev-1',
  task_id: SCIENCE_TASK_ID,
  method_version: '0.1.0',
  role: 'advisory',
  as_of: new Date().toISOString(),
  scope: { type: 'ship_season', ship_code: 'CL', season: '2025-Q2' },
  subject: { type: 'sailing', id: 'S1', horizon: 'historic' },
  peerset: {
    cluster_id: 'c1',
    members: [{ sail_code: 'S0', weight: 1, in_reason: 'same ship season' }],
    n: 3,
    selection: 'constrained_cluster',
  },
  prior: {
    pace: { mean_lf: 0.72, band_low: 0.6, band_high: 0.82, curve: [{ weeks_until_sailing: 8, lf: 0.55 }] },
    revenue: { mean_yield_per_guest: 900, implied_end_revenue: 450000, currency: 'EUR' },
  },
  decision_moments: [{
    weeks_until_sailing: 12,
    when_label: 'W-12',
    posture: 'price_hold',
    actual_lf: 0.4,
    prior_lf: 0.52,
    supportable_alternate: 'review_pace_vs_peerset',
    material_delta_guests: 40,
    revenue_delta: 36000,
    rationale: 'Below peerset band',
  }],
  material_value: { guests_delta: 40, lf_delta: -0.12, unit: 'guests' },
  revenue_value: { amount: 36000, currency: 'EUR', basis: 'yield_x_guests_delta' },
  covariate_ranks: [{
    feature: 'price_posture',
    importance: 0.22,
    direction: 'mixed',
    stability: 0.6,
    note: 'Often confounded with seasonality',
  }],
  forward_now: null,
  reasons: [{
    id: 'r1',
    statement: 'Peerset prior beats single YoY peer for pace',
    historic_proof: '€36k delta at W-12',
    forward_implication: 'Apply same prior at now on open book',
  }],
  diagnostics: {
    n_historic: 12,
    n_forward: 0,
    honesty: 'Association-backed counterfactual; not causal proof.',
  },
});

describe('ScienceEvidence contract', () => {
  it('accepts a valid advisory artifact', () => {
    assert.deepEqual(validateScienceEvidence(sample()), []);
  });

  it('rejects Finding-like score fields', () => {
    const bad = { ...sample(), score: 0.9 } as any;
    const errors = validateScienceEvidence(bad);
    assert.ok(errors.some((e) => e.includes('score')));
  });

  it('builds a citation without inventing actions', () => {
    const citation = citeEvidence(sample());
    assert.equal(citation.evidence_id, 'ev-1');
    assert.equal(citation.task_id, SCIENCE_TASK_ID);
    assert.equal((citation as any).score, undefined);
  });

  it('gates source promotion on peerset size and reasons', () => {
    const thin = sample();
    thin.peerset.n = 1;
    assert.ok(canPromoteToSource(thin).length > 0);
    assert.deepEqual(canPromoteToSource(sample()), []);
  });
});
