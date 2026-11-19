/**
 * Pure view helpers for Driver Analysis — historic prior → now projection.
 */

export const weeksToDtd = (weeks) => Math.round(Number(weeks) * 7);

export const fmtEuro = (n) => {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `€${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

export const fmtPct = (n) => {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `${(Number(n) * 100).toFixed(1)}%`;
};

/** Prefer a historic proof sail; else first forward; else first row. */
export function pickDefaultEvidence(rows = []) {
  const historic = rows.find((r) => r?.subject?.horizon === 'historic' && (r.decisionMoments || []).length);
  if (historic) return historic.evidenceId;
  const anyHistoric = rows.find((r) => r?.subject?.horizon === 'historic');
  if (anyHistoric) return anyHistoric.evidenceId;
  const forward = rows.find((r) => r?.subject?.horizon === 'forward_now');
  if (forward) return forward.evidenceId;
  return rows[0]?.evidenceId || null;
}

export function pairForwardFor(selected, rows = []) {
  if (!selected) return null;
  if (selected.subject?.horizon === 'forward_now') return selected;
  const ship = selected.subject?.ship_code || selected.subject?.shipCode;
  return rows.find((r) => (
    r?.subject?.horizon === 'forward_now'
    && (!ship || r.subject?.ship_code === ship || r.subject?.shipCode === ship)
  )) || null;
}

/**
 * Build a weeks-to-sail axis (descending) for Chart.js.
 * Points carry prior/actual LF and optional decision/revenue annotations.
 */
export function buildHorizonSeries(evidence, forwardPair = null) {
  const priorCurve = evidence?.prior?.pace?.curve || [];
  const moments = evidence?.decisionMoments || [];
  const forward = evidence?.forwardNow || forwardPair?.forwardNow || null;
  const endLf = Number(evidence?.prior?.pace?.mean_lf);
  const observedEnd = evidence?.subject?.horizon === 'historic'
    ? Number(evidence?.materialValue?.lf_delta != null
      ? endLf + Number(evidence.materialValue.lf_delta)
      : endLf)
    : null;

  const weekSet = new Set();
  priorCurve.forEach((p) => weekSet.add(Number(p.weeks_until_sailing)));
  moments.forEach((m) => weekSet.add(Number(m.weeks_until_sailing)));
  if (forward?.weeks_until_sailing != null) weekSet.add(Number(forward.weeks_until_sailing));
  weekSet.add(0);

  const weeks = [...weekSet].filter((w) => Number.isFinite(w)).sort((a, b) => b - a);
  const momentByWeek = new Map(moments.map((m) => [Number(m.weeks_until_sailing), m]));
  const priorByWeek = new Map(priorCurve.map((p) => [Number(p.weeks_until_sailing), p]));

  const interpolatePrior = (w) => {
    const hit = priorByWeek.get(w);
    if (hit) return hit;
    if (!priorCurve.length) return null;
    const ordered = [...priorCurve].sort((a, b) => Number(b.weeks_until_sailing) - Number(a.weeks_until_sailing));
    let left = ordered[0];
    let right = ordered[ordered.length - 1];
    for (let i = 0; i < ordered.length - 1; i += 1) {
      const a = ordered[i];
      const b = ordered[i + 1];
      if (w <= Number(a.weeks_until_sailing) && w >= Number(b.weeks_until_sailing)) {
        left = a;
        right = b;
        break;
      }
    }
    const aw = Number(left.weeks_until_sailing);
    const bw = Number(right.weeks_until_sailing);
    const t = aw === bw ? 0 : (aw - w) / (aw - bw);
    const mix = (lo, hi) => Number(lo) + (Number(hi) - Number(lo)) * t;
    return {
      weeks_until_sailing: w,
      lf: mix(left.lf, right.lf),
      band_low: mix(left.band_low ?? left.lf, right.band_low ?? right.lf),
      band_high: mix(left.band_high ?? left.lf, right.band_high ?? right.lf),
    };
  };

  const points = weeks.map((w) => {
    const prior = interpolatePrior(w);
    const moment = momentByWeek.get(w);
    let actualLf = null;
    if (moment) actualLf = Number(moment.actual_lf);
    else if (w === 0 && Number.isFinite(observedEnd)) actualLf = observedEnd;
    else if (momentByWeek.size) {
      // reconstruct between moments toward end
      const pathFrac = 1.0 - (w / 26) ** 0.85;
      if (Number.isFinite(observedEnd)) actualLf = Math.max(0, Math.min(1, observedEnd * pathFrac));
    }

    const isNow = forward && Number(forward.weeks_until_sailing) === w;
    return {
      weeks: w,
      dtd: weeksToDtd(w),
      priorLf: prior ? Number(prior.lf) : null,
      bandLow: prior ? Number(prior.band_low ?? prior.lf) : null,
      bandHigh: prior ? Number(prior.band_high ?? prior.lf) : null,
      actualLf,
      decision: moment || null,
      isNow: Boolean(isNow),
      observedNow: isNow ? Number(forward.observed_lf) : null,
      priorNow: isNow ? Number(forward.prior_lf) : null,
    };
  });

  return {
    points,
    forward,
    peersetN: evidence?.peerset?.n ?? 0,
    clusterId: evidence?.peerset?.cluster_id || '—',
    revenueHistoric: Number(evidence?.revenueValue?.amount) || 0,
    revenueForward: Number(forward?.revenue_at_stake) || 0,
    materialHistoric: Number(evidence?.materialValue?.guests_delta) || 0,
    materialForward: Number(forward?.material_at_stake_guests) || 0,
  };
}

export function portfolioTotals(rows = []) {
  let historicEuro = 0;
  let forwardEuro = 0;
  let historicN = 0;
  let forwardN = 0;
  rows.forEach((r) => {
    const amt = Number(r?.revenueValue?.amount) || 0;
    if (r?.subject?.horizon === 'forward_now') {
      forwardEuro += Math.abs(Number(r?.forwardNow?.revenue_at_stake) || amt);
      forwardN += 1;
    } else {
      historicEuro += Math.abs(amt);
      historicN += 1;
    }
  });
  return { historicEuro, forwardEuro, historicN, forwardN };
}
