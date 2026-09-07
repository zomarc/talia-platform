export const FINDING_SEVERITIES = ['info', 'watch', 'action', 'critical'] as const;
export const FINDING_STATUSES = ['open', 'acknowledged', 'dismissed', 'applied', 'expired'] as const;

export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export type FindingSubject = {
  type: string;
  id: string;
  [key: string]: unknown;
};

export type RecommendedAction = {
  action_type: string;
  params: Record<string, unknown>;
  rationale: string;
};

export type Finding = {
  finding_id: string;
  agent_id: string;
  subject: FindingSubject;
  as_of: string;
  score: number;
  severity: FindingSeverity;
  recommended_action: RecommendedAction;
  evidence: Record<string, unknown>;
  confidence?: number | null;
  status: FindingStatus;
  tenant_id?: string;
};

const AGENT_ID_RE = /^rm\.[a-z0-9_]+\.[a-z0-9_]+$/;

export function severityFromScore(score: number): FindingSeverity {
  if (score >= 0.85) return 'critical';
  if (score >= 0.6) return 'action';
  if (score >= 0.3) return 'watch';
  return 'info';
}

export function validateFinding(finding: Finding): string[] {
  const errors: string[] = [];
  if (!finding.finding_id) errors.push('finding_id required');
  if (!AGENT_ID_RE.test(String(finding.agent_id || ''))) {
    errors.push('agent_id must match rm.<family>.<name>');
  }
  if (!finding.subject?.type || !finding.subject?.id) errors.push('subject.type and subject.id required');
  if (!finding.as_of) errors.push('as_of required');
  if (typeof finding.score !== 'number' || finding.score < 0 || finding.score > 1) {
    errors.push('score must be in [0, 1]');
  }
  if (!FINDING_SEVERITIES.includes(finding.severity)) errors.push('invalid severity');
  if (!FINDING_STATUSES.includes(finding.status)) errors.push('invalid status');
  const action = finding.recommended_action;
  if (!action?.action_type || !action?.rationale || !action?.params || typeof action.params !== 'object') {
    errors.push('recommended_action requires action_type, params, rationale');
  }
  if (finding.evidence == null || typeof finding.evidence !== 'object') {
    errors.push('evidence required');
  }
  if (finding.confidence != null && (finding.confidence < 0 || finding.confidence > 1)) {
    errors.push('confidence must be in [0, 1] when set');
  }
  return errors;
}
