import { formatActionLabel } from './rmChecklistHeatmapTransform.js';

const formatPct = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${(Number(value) * 100).toFixed(1)}%`;
};

export const memoTypeForFinding = (row) => {
  const action = String(row?.actionType || '').toLowerCase();
  if (action.includes('pric')) return 'pricing';
  const severity = String(row?.severity || '').toLowerCase();
  if (severity === 'critical' || severity === 'action') return 'risk';
  if (severity === 'watch' || severity === 'warning') return 'ops';
  return 'note';
};

export const buildRmChecklistMemoText = (row, { createdBy, createdAt } = {}) => {
  const when = createdAt ? new Date(createdAt) : new Date();
  const whenLabel = Number.isNaN(when.getTime()) ? String(createdAt || '') : when.toLocaleString();
  const sail = row?.subjectId || row?.subject?.sail_code || '—';
  return [
    `RM Checklist memo for ${sail}`,
    `Recorded ${whenLabel} by ${createdBy || 'unknown'}`,
    `Severity: ${row?.severity || '—'}`,
    `Urgency: ${row?.score == null ? '—' : Number(row.score).toFixed(2)}`,
    `Recommended action: ${formatActionLabel(row?.actionType)}`,
    `Rationale: ${row?.rationale || '—'}`,
    `Load factor: ${formatPct(row?.loadFactor)} · Target: ${formatPct(row?.targetLoadFactor)} · Days to sail: ${row?.daysToSail ?? '—'}`,
    `RM Agent: ${row?.agentId || '—'}`,
    row?.findingId ? `Finding: ${row.findingId}` : null,
  ].filter(Boolean).join('\n');
};

export const memoCreateDetailFromFinding = (row, user) => {
  const createdAt = new Date().toISOString();
  const createdBy = user?.name || user?.email || 'unknown';
  return {
    createdAt,
    createdBy,
    memoType: memoTypeForFinding(row),
    memoText: buildRmChecklistMemoText(row, { createdBy, createdAt }),
    sailCode: row?.subjectId || row?.subject?.sail_code || '',
    shipCode: row?.subject?.ship_code || '',
    shipName: row?.subject?.ship_name || '',
    sourceTable: 'rm_findings',
    sourceRowId: row?.findingId ? String(row.findingId) : '',
  };
};
