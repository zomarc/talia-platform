/** Citation shape for Science Evidence — safe to attach to Finding.evidence. */

export type ScienceEvidenceCitation = {
  evidence_id: string;
  task_id: string;
  role: string;
  subject_id: string;
  fields: string[];
};

export function scienceEvidenceCitationFromRow(row: any): ScienceEvidenceCitation {
  return {
    evidence_id: row.evidence_id || row.evidenceId,
    task_id: row.task_id || row.taskId || 'science.driver_analysis.v0',
    role: row.role,
    subject_id: row.subject_id || row.subjectId,
    fields: ['prior', 'peerset', 'revenue_value', 'forward_now'],
  };
}

export function attachScienceCitation(
  findingEvidence: Record<string, unknown> | null | undefined,
  citation: ScienceEvidenceCitation | null
): Record<string, unknown> {
  const base = { ...(findingEvidence || {}) };
  if (!citation) return base;
  const existing = Array.isArray(base.science_citations) ? base.science_citations : [];
  return {
    ...base,
    science_citations: [...existing, citation],
  };
}
