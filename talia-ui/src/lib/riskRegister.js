/**
 * Risk register — bands, labels, reference codes, and JSON export.
 * Likelihood and impact are 1–5. The band is the cell, not a weighted index.
 */

export const RISK_CATEGORIES = ['supplier', 'people', 'process', 'benefits', 'technical', 'external'];
export const RISK_STATUSES = ['open', 'treating', 'accepted', 'closed', 'occurred'];
export const RISK_RESPONSES = ['avoid', 'reduce', 'transfer', 'accept'];
export const RISK_PROXIMITIES = ['immediate', 'phase', 'later'];
export const RISK_SCALE = [1, 2, 3, 4, 5];

export const RISK_CATEGORY_LABELS = {
  supplier: 'Supplier',
  people: 'People',
  process: 'Process',
  benefits: 'Benefits',
  technical: 'Technical',
  external: 'External',
};

export const RISK_STATUS_LABELS = {
  open: 'Open',
  treating: 'Treating',
  accepted: 'Accepted',
  closed: 'Closed',
  occurred: 'Occurred',
};

export const RISK_RESPONSE_LABELS = {
  avoid: 'Avoid',
  reduce: 'Reduce',
  transfer: 'Transfer',
  accept: 'Accept',
};

export const RISK_PROXIMITY_LABELS = {
  immediate: 'Immediate',
  phase: 'This phase',
  later: 'Later',
};

export const RISK_LIKELIHOOD_LABELS = {
  1: 'Rare',
  2: 'Unlikely',
  3: 'Possible',
  4: 'Likely',
  5: 'Almost certain',
};

export const RISK_IMPACT_LABELS = {
  1: 'Negligible',
  2: 'Minor',
  3: 'Moderate',
  4: 'High',
  5: 'Severe',
};

export const RISK_BAND_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

const clampScore = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const rounded = Math.round(number);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
};

/** Band for one likelihood × impact cell. */
export function riskBand(likelihood, impact) {
  const l = clampScore(likelihood);
  const i = clampScore(impact);
  if (!l || !i) return 'low';
  const score = l * i;
  if (score >= 17) return 'critical';
  if (score >= 10) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}

export function nextRiskReference(items) {
  let max = 0;
  (items || []).forEach((item) => {
    const match = /^RK(\d+)$/i.exec(String(item?.referenceCode || '').trim());
    if (match) max = Math.max(max, Number(match[1]));
  });
  return `RK${String(max + 1).padStart(3, '0')}`;
}

const scrubLink = (link) => ({
  targetKind: link?.targetKind || null,
  targetId: link?.targetId != null ? String(link.targetId) : null,
  label: link?.label || null,
});

export function buildRiskRegisterExport(items) {
  return {
    RiskRegisterExport: {
      version: 1,
      exportedAt: new Date().toISOString(),
      risks: (items || []).map((item) => ({
        referenceCode: item.referenceCode,
        title: item.title,
        statement: item.statement || null,
        category: item.category,
        likelihood: Number(item.likelihood) || null,
        impact: Number(item.impact) || null,
        band: riskBand(item.likelihood, item.impact),
        residualLikelihood: item.residualLikelihood != null ? Number(item.residualLikelihood) : null,
        residualImpact: item.residualImpact != null ? Number(item.residualImpact) : null,
        residualBand: item.residualLikelihood != null && item.residualImpact != null
          ? riskBand(item.residualLikelihood, item.residualImpact)
          : null,
        proximity: item.proximity,
        status: item.status,
        response: item.response,
        treatment: item.treatment || null,
        owner: item.owner || null,
        reviewOn: item.reviewOn || null,
        links: (item.links || []).map(scrubLink),
      })),
    },
  };
}

export function downloadJson(pack, filename) {
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
