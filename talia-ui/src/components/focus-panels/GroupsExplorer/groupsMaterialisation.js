/**
 * Groups Explorer — Talia materialisation rate (independent of source probability).
 * Source MR is display-only; Talia MR is never copied from source.
 */

export const DISTRESSED_REMAINING_PCT = 0.2;
export const DEFAULT_TALIA_PRIOR = 0.5;
export const LARGE_GROUP_PAX = 50;
export const WEAK_MR_THRESHOLD = 0.35;
export const SOURCE_GAP_FLAG = 0.15;

const clamp01 = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(1, Math.max(0, n));
};

/** Normalize probability to 0–1 (accepts 0–1 or 0–100). */
export const normalizeMr = (raw) => {
  let n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n > 1 && n <= 100) n /= 100;
  return clamp01(n);
};

export const formatMrPct = (value) => {
  const mr = normalizeMr(value);
  if (mr == null) return '—';
  return `${(mr * 100).toFixed(0)}%`;
};

/**
 * @param {{
 *   requestedPax?: number,
 *   reservedPax?: number,
 *   requestedCabins?: number,
 *   reservedCabins?: number,
 *   sourceMr?: number|null,
 *   hasNamedBooked?: boolean,
 *   offerHeavy?: boolean,
 *   distressedSailing?: boolean,
 *   prior?: number,
 * }} input
 * @returns {{ talia_mr: number, source_mr: number|null, reasons: string[] }}
 */
export const computeTaliaMaterialisation = (input = {}) => {
  const reasons = [];
  const prior = normalizeMr(input.prior) ?? DEFAULT_TALIA_PRIOR;
  let mr = prior;
  reasons.push(`Prior ${formatMrPct(prior)}`);

  const requested = Number(input.requestedPax || input.requestedCabins || 0);
  const reserved = Number(input.reservedPax || input.reservedCabins || 0);
  if (requested > 0 && reserved >= 0) {
    const ratio = clamp01(reserved / requested);
    if (ratio != null) {
      // Blend reserved/request with prior (more weight on observed hold).
      mr = (mr * 0.35) + (ratio * 0.65);
      reasons.push(`Reserved/requested ${(ratio * 100).toFixed(0)}%`);
    }
  }

  if (input.offerHeavy && !input.hasNamedBooked) {
    mr *= 0.85;
    reasons.push('Mostly open offer, little named booked');
  }

  if (input.hasNamedBooked) {
    mr = Math.min(1, mr + 0.08);
    reasons.push('Has named booked volume');
  }

  const sourceMr = normalizeMr(input.sourceMr);
  if (sourceMr != null) {
    // Soft feature only — never replace output with source.
    const delta = sourceMr - mr;
    if (Math.abs(delta) >= 0.05) {
      mr = clamp01(mr + (delta * 0.15));
      reasons.push(
        delta > 0
          ? `Source MR higher (${formatMrPct(sourceMr)}); mild uplift`
          : `Source MR lower (${formatMrPct(sourceMr)}); mild temper`
      );
    }
  }

  if (input.distressedSailing && requested >= LARGE_GROUP_PAX) {
    mr *= 0.9;
    reasons.push('Large commitment on distressed sailing');
  }

  mr = clamp01(mr) ?? prior;
  return {
    talia_mr: mr,
    source_mr: sourceMr,
    reasons,
  };
};

/**
 * @param {{
 *   talia_mr: number,
 *   source_mr?: number|null,
 *   requestedPax?: number,
 *   groupValueEur?: number,
 *   distressedSailing?: boolean,
 *   sellableRemainingPct?: number|null,
 * }} row
 */
export const evaluateGroupPerformance = (row = {}) => {
  const flags = [];
  const talia = normalizeMr(row.talia_mr) ?? 0;
  const source = normalizeMr(row.source_mr);
  const requested = Number(row.requestedPax || 0);
  const value = Number(row.groupValueEur || 0);

  if (talia <= WEAK_MR_THRESHOLD && requested >= 25) {
    flags.push('weak_mr');
  }
  if (source != null && (source - talia) >= SOURCE_GAP_FLAG) {
    flags.push('below_source');
  }
  if (row.distressedSailing && requested >= LARGE_GROUP_PAX) {
    flags.push('distress_pressure');
  }
  if (value >= 25000 && talia < 0.45) {
    flags.push('value_at_risk');
  }

  const cabinsAtRisk = Math.max(0, Number(row.requestedCabins || requested / 2 || 0) * (1 - talia));
  const valueAtRisk = Math.max(0, value * (1 - talia));
  const potentialPax = requested * talia;

  return {
    non_performant: flags.length > 0,
    flags,
    cabins_at_risk: cabinsAtRisk,
    value_at_risk: valueAtRisk,
    potential_pax: potentialPax,
  };
};

export const isDistressedRemaining = (remainingPct) => {
  const n = Number(remainingPct);
  if (!Number.isFinite(n)) return false;
  const pct = n > 1 ? n / 100 : n;
  return pct >= 0 && pct < DISTRESSED_REMAINING_PCT;
};

export default {
  computeTaliaMaterialisation,
  evaluateGroupPerformance,
  normalizeMr,
  formatMrPct,
  isDistressedRemaining,
};
