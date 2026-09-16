import { findingSailCode, findingSailDate } from './rmChecklistScope.js';

export const SEVERITY_RANK = {
  critical: 4,
  action: 3,
  warning: 2,
  warn: 2,
  info: 1,
};

const ACTION_LABELS = {
  REVIEW_PRICING: 'Pricing',
  REVIEW_TARGET: 'Target',
  REVIEW_INVENTORY: 'Inventory',
  ESCALATE_SAILING: 'Escalate',
};

export const severityRank = (severity) => (
  SEVERITY_RANK[String(severity || '').trim().toLowerCase()] || 0
);

export const normalizeActionType = (value) => {
  const raw = String(value || '').trim();
  return raw || 'UNSET';
};

export const formatActionLabel = (actionType) => {
  const key = normalizeActionType(actionType);
  if (ACTION_LABELS[key]) return ACTION_LABELS[key];
  return key
    .replace(/^REVIEW_/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
};

export const condenseRationale = (text, max = 120) => {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const sentence = clean.split(/(?<=[.!?])\s/)[0] || clean;
  if (sentence.length <= max) return sentence;
  return `${sentence.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
};

const formatPct = (value) => {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${(Number(value) * 100).toFixed(1)}%`;
};

const formatSignedPp = (value) => {
  if (value == null || Number.isNaN(Number(value))) return null;
  const pp = Number(value) * 100;
  const sign = pp > 0 ? '+' : '';
  return `${sign}${pp.toFixed(1)}pp`;
};

/** Longer hover text for checklist table cells (action + rationale + evidence). */
export const buildFindingExplanation = (row = {}) => {
  const action = formatActionLabel(
    row.actionType
    || row.recommendedAction?.action_type
    || row.recommended_action?.action_type
  );
  const rationale = String(
    row.rationale
    || row.recommendedAction?.rationale
    || row.recommended_action?.rationale
    || ''
  ).replace(/\s+/g, ' ').trim();
  const evidenceBits = [
    row.loadFactor != null ? `LF ${formatPct(row.loadFactor)}` : null,
    row.targetLoadFactor != null ? `Target ${formatPct(row.targetLoadFactor)}` : null,
    formatSignedPp(row.gapSigned) ? `Gap ${formatSignedPp(row.gapSigned)}` : null,
    row.daysToSail != null && Number.isFinite(Number(row.daysToSail))
      ? `${Number(row.daysToSail)} days to sail`
      : null,
    row.subjectId || row.subject?.id
      ? `Sailing ${row.subjectId || row.subject?.id}`
      : null,
    row.agentId ? `RM Agent ${row.agentId}` : null,
  ].filter(Boolean);

  return [
    action ? `Action: ${action}` : null,
    rationale || null,
    evidenceBits.length ? evidenceBits.join(' · ') : null,
  ].filter(Boolean).join('\n');
};

const findingActionType = (finding) => normalizeActionType(
  finding?.actionType
  || finding?.recommendedAction?.action_type
  || finding?.recommended_action?.action_type
);

const findingRationale = (finding) => (
  finding?.rationale
  || finding?.recommendedAction?.rationale
  || finding?.recommended_action?.rationale
  || ''
);

const pickWorse = (current, finding) => {
  if (!current) return finding;
  const currentRank = severityRank(current.severity);
  const nextRank = severityRank(finding?.severity);
  if (nextRank !== currentRank) return nextRank > currentRank ? finding : current;
  return Number(finding?.score || 0) > Number(current?.score || 0) ? finding : current;
};

/**
 * Date × recommended action grid. Cell color is the worst severity in that bucket.
 */
export const buildChecklistHeatmap = (findings = []) => {
  const dateKeys = new Set();
  const actionKeys = new Set();
  const buckets = new Map();

  (findings || []).forEach((finding) => {
    const date = findingSailDate(finding);
    if (!date) return;
    const action = findingActionType(finding);
    dateKeys.add(date);
    actionKeys.add(action);
    const key = `${date}::${action}`;
    const existing = buckets.get(key) || { findings: [] };
    existing.findings.push(finding);
    existing.primary = pickWorse(existing.primary, finding);
    buckets.set(key, existing);
  });

  const dates = [...dateKeys].sort((a, b) => a.localeCompare(b));
  const actions = [...actionKeys].sort((a, b) => (
    formatActionLabel(a).localeCompare(formatActionLabel(b))
  ));

  const rows = dates.map((date) => {
    const cells = actions.map((action) => {
      const bucket = buckets.get(`${date}::${action}`);
      if (!bucket?.findings?.length) {
        return {
          date,
          action,
          empty: true,
          count: 0,
          severity: null,
          primary: null,
          findings: [],
          tooltip: '',
        };
      }
      const primary = bucket.primary;
      const sailCodes = [...new Set(bucket.findings.map(findingSailCode).filter(Boolean))];
      const rationale = condenseRationale(findingRationale(primary));
      const tooltip = [
        sailCodes.join(' · '),
        formatActionLabel(action),
        primary?.severity ? String(primary.severity) : '',
        rationale,
      ].filter(Boolean).join(' — ');
      return {
        date,
        action,
        empty: false,
        count: bucket.findings.length,
        severity: String(primary?.severity || '').toLowerCase() || null,
        primary,
        findings: bucket.findings,
        sailCodes,
        tooltip,
        rationale,
      };
    });
    const rowFindings = cells.flatMap((cell) => cell.findings);
    const sailCodes = [...new Set(rowFindings.map(findingSailCode).filter(Boolean))];
    return {
      date,
      sailCodes,
      cells,
    };
  });

  return {
    dates,
    actions: actions.map((id) => ({ id, label: formatActionLabel(id) })),
    rows,
  };
};
