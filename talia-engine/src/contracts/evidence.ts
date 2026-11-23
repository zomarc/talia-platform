export const SCIENCE_TASK_ID = 'science.driver_analysis.v0' as const;
export const SCIENCE_METHOD_VERSION = '0.1.0' as const;
export const EVIDENCE_ROLES = ['advisory', 'source'] as const;

export type EvidenceRole = (typeof EVIDENCE_ROLES)[number];

export type PeersetMember = {
  sail_code: string;
  weight: number;
  in_reason: string;
  ship_code?: string | null;
  sail_date_from?: string | null;
  end_lf?: number | null;
};

export type DecisionMoment = {
  weeks_until_sailing: number;
  when_label: string;
  posture: string;
  actual_lf: number;
  prior_lf: number;
  supportable_alternate: string;
  material_delta_guests: number;
  revenue_delta: number;
  rationale: string;
};

export type CovariateRank = {
  feature: string;
  importance: number;
  direction: string;
  stability: number;
  partial_association?: number | null;
  note: string;
};

export type ScienceReason = {
  id: string;
  statement: string;
  historic_proof: string;
  forward_implication: string;
};

export type ScienceEvidence = {
  evidence_id: string;
  task_id: typeof SCIENCE_TASK_ID;
  method_version: string;
  role: EvidenceRole;
  as_of: string;
  scope: {
    type: string;
    ship_code?: string | null;
    season?: string | null;
    label?: string | null;
    [key: string]: unknown;
  };
  subject: {
    type: string;
    id: string;
    ship_code?: string | null;
    sail_date_from?: string | null;
    horizon?: 'historic' | 'forward_now';
    [key: string]: unknown;
  };
  peerset: {
    cluster_id: string;
    members: PeersetMember[];
    n: number;
    selection: string;
    manual_peer_sail_code?: string | null;
    manual_vs_learned?: Record<string, unknown> | null;
  };
  prior: {
    pace: {
      mean_lf: number;
      band_low: number;
      band_high: number;
      curve: Array<{
        weeks_until_sailing: number;
        lf: number;
        band_low?: number | null;
        band_high?: number | null;
      }>;
    };
    revenue: {
      mean_yield_per_guest: number;
      implied_end_revenue: number;
      currency?: string;
    };
  };
  decision_moments: DecisionMoment[];
  material_value: {
    guests_delta: number;
    lf_delta: number;
    cabins_delta?: number | null;
    unit: string;
    label?: string;
  };
  revenue_value: {
    amount: number;
    currency: string;
    basis: string;
    label?: string;
  };
  covariate_ranks: CovariateRank[];
  forward_now: {
    weeks_until_sailing: number;
    observed_lf: number;
    prior_lf: number;
    material_at_stake_guests: number;
    revenue_at_stake: number;
    groups_mr_context?: Record<string, unknown>;
    drivers_of_gap?: string[];
  } | null;
  reasons: ScienceReason[];
  diagnostics: {
    n_historic: number;
    n_forward: number;
    honesty: string;
    assumptions?: string[];
    missing_features?: string[];
  };
  run_id?: string | null;
  tenant_id?: string | null;
};

/** Citation shape RM Agents / consumers may attach without inventing scores. */
export type EvidenceCitation = {
  evidence_id: string;
  task_id: typeof SCIENCE_TASK_ID;
  role: EvidenceRole;
  subject_id: string;
  fields?: string[];
};

export function citeEvidence(
  evidence: Pick<ScienceEvidence, 'evidence_id' | 'task_id' | 'role' | 'subject'>,
  fields: string[] = ['prior', 'peerset', 'revenue_value']
): EvidenceCitation {
  return {
    evidence_id: evidence.evidence_id,
    task_id: evidence.task_id,
    role: evidence.role,
    subject_id: String(evidence.subject?.id || ''),
    fields,
  };
}

export function validateScienceEvidence(evidence: ScienceEvidence): string[] {
  const errors: string[] = [];
  if (!evidence?.evidence_id) errors.push('evidence_id required');
  if (evidence?.task_id !== SCIENCE_TASK_ID) {
    errors.push(`task_id must be ${SCIENCE_TASK_ID}`);
  }
  if (!evidence?.method_version) errors.push('method_version required');
  if (!EVIDENCE_ROLES.includes(evidence?.role)) errors.push('role must be advisory|source');
  if (!evidence?.as_of) errors.push('as_of required');
  if (!evidence?.scope?.type) errors.push('scope.type required');
  if (!evidence?.subject?.type || !evidence?.subject?.id) {
    errors.push('subject.type and subject.id required');
  }
  if (!evidence?.peerset || !Array.isArray(evidence.peerset.members)) {
    errors.push('peerset.members required');
  } else if (typeof evidence.peerset.n !== 'number') {
    errors.push('peerset.n required');
  }
  if (!evidence?.prior?.pace || !evidence?.prior?.revenue) {
    errors.push('prior.pace and prior.revenue required');
  }
  if (!Array.isArray(evidence?.decision_moments)) errors.push('decision_moments required');
  if (evidence?.material_value == null || typeof evidence.material_value.guests_delta !== 'number') {
    errors.push('material_value.guests_delta required');
  }
  if (evidence?.revenue_value == null || typeof evidence.revenue_value.amount !== 'number') {
    errors.push('revenue_value.amount required');
  }
  if (!Array.isArray(evidence?.covariate_ranks)) errors.push('covariate_ranks required');
  if (!Array.isArray(evidence?.reasons)) errors.push('reasons required');
  if (!evidence?.diagnostics?.honesty) errors.push('diagnostics.honesty required');

  // Hard rule: science evidence must never look like a Finding score/action.
  const banned = evidence as unknown as Record<string, unknown>;
  if ('score' in banned && banned.score != null) {
    errors.push('science evidence must not include Finding score');
  }
  if ('recommended_action' in banned && banned.recommended_action != null) {
    errors.push('science evidence must not include recommended_action');
  }
  return errors;
}

export function canPromoteToSource(evidence: ScienceEvidence): string[] {
  const blockers: string[] = [];
  if (evidence.role === 'source') return blockers;
  if ((evidence.peerset?.n || 0) < 3) blockers.push('peerset.n must be >= 3 to promote');
  if (!evidence.decision_moments?.length && !evidence.forward_now) {
    blockers.push('need decision_moments or forward_now before source promotion');
  }
  if (!evidence.reasons?.length) blockers.push('reasons required before source promotion');
  return blockers;
}
