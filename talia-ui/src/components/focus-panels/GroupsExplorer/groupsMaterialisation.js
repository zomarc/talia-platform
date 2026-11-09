/**
 * Groups Explorer — Talia materialisation rate (independent of source probability).
 * Source MR is display-only unless useSourceNudge is on; Talia MR is never copied from source.
 */

export const DISTRESSED_REMAINING_PCT = 0.2;
export const DEFAULT_TALIA_PRIOR = 0.5;
export const LARGE_GROUP_PAX = 50;
export const WEAK_MR_THRESHOLD = 0.35;
export const SOURCE_GAP_FLAG = 0.15;

/** Extract + live reservation cancel codes. */
export const CANCELLED_STATUSES = new Set([
  'CX',
  'CA',
  'CANCELLED',
  'CANCELED',
  'X',
]);

export const isCancelledStatus = (status) => (
  CANCELLED_STATUSES.has(String(status || '').trim().toUpperCase())
);

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

/** One decimal when the step is not a whole percent. 0.175 → 17.5%. */
export const formatMrPctPrecise = (value) => {
  const mr = normalizeMr(value);
  if (mr == null) return '—';
  const pct = Math.round(mr * 1000) / 10;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
};

const step = (fields) => ({
  applied: false,
  delta: 0,
  ...fields,
});

/**
 * Same arithmetic as computeTaliaMaterialisation, with a sentence for each step.
 * @param {object} input
 */
export const explainTaliaMaterialisation = (input = {}) => {
  const reasons = [];
  const steps = [];
  const prior = normalizeMr(input.prior) ?? DEFAULT_TALIA_PRIOR;
  let mr = prior;
  reasons.push(`Prior ${formatMrPct(prior)}`);
  steps.push(step({
    id: 'prior',
    title: 'Prior',
    rate: mr,
    delta: mr,
    applied: true,
    sentence: `Start at ${formatMrPctPrecise(prior)}. A group with no better evidence begins at an even prior. The calculation does not start from the source rate.`,
  }));

  const priorWeight = Number.isFinite(Number(input.priorWeight)) ? Number(input.priorWeight) : 0.35;
  const namedWeight = Number.isFinite(Number(input.namedWeight)) ? Number(input.namedWeight) : 0.65;
  const offerCut = Number.isFinite(Number(input.offerCut)) ? Number(input.offerCut) : 0.85;
  const namedLift = Number.isFinite(Number(input.namedLift)) ? Number(input.namedLift) : 0.08;
  const sourceNudgeStrength = Number.isFinite(Number(input.sourceNudgeStrength))
    ? Number(input.sourceNudgeStrength)
    : 0.15;
  const sourceNudgeMinGap = Number.isFinite(Number(input.sourceNudgeMinGap))
    ? Number(input.sourceNudgeMinGap)
    : 0.05;
  const distressCut = Number.isFinite(Number(input.distressCut)) ? Number(input.distressCut) : 0.9;
  const largeGroupPax = Number.isFinite(Number(input.largeGroupPax))
    ? Number(input.largeGroupPax)
    : LARGE_GROUP_PAX;

  const requested = Number(input.requestedPax || input.requestedCabins || 0);
  const reserved = Number(input.reservedPax || input.reservedCabins || 0);
  if (requested > 0 && reserved >= 0) {
    const ratio = clamp01(reserved / requested);
    if (ratio != null) {
      const before = mr;
      mr = (mr * priorWeight) + (ratio * namedWeight);
      reasons.push(`Reserved/requested ${(ratio * 100).toFixed(0)}%`);
      steps.push(step({
        id: 'blend',
        title: 'Named guests',
        rate: mr,
        delta: mr - before,
        applied: true,
        sentence: `${Math.round(reserved)} of ${Math.round(requested)} requested guests are named (${formatMrPctPrecise(ratio)}). Named guests take ${Math.round(namedWeight * 100)}% of the weight and the prior keeps ${Math.round(priorWeight * 100)}%, so the rate moves from ${formatMrPctPrecise(before)} to ${formatMrPctPrecise(mr)}. Guests already named are the evidence. The prior is only the starting point.`,
      }));
    }
  } else {
    steps.push(step({
      id: 'blend',
      title: 'Named guests',
      rate: mr,
      sentence: 'There is no requested size to compare with named guests, so the prior stays in place.',
    }));
  }

  if (input.offerHeavy && !input.hasNamedBooked) {
    const before = mr;
    mr *= offerCut;
    reasons.push('Mostly open offer, little named booked');
    steps.push(step({
      id: 'offer',
      title: 'Empty offer',
      rate: mr,
      delta: mr - before,
      applied: true,
      sentence: `This is a quote or open offer without named bookings. It is a conversation, not a hold, so the rate is cut to ${Math.round(offerCut * 100)}% of itself, from ${formatMrPctPrecise(before)} to ${formatMrPctPrecise(mr)}.`,
    }));
  } else {
    steps.push(step({
      id: 'offer',
      title: 'Empty offer',
      rate: mr,
      sentence: input.hasNamedBooked
        ? 'Guests are already named, so the empty-offer cut does not apply.'
        : 'The empty-offer cut does not apply. The group is not an open quote or offer with nobody named.',
    }));
  }

  if (input.hasNamedBooked) {
    const before = mr;
    mr = Math.min(1, mr + namedLift);
    reasons.push('Has named booked volume');
    steps.push(step({
      id: 'named',
      title: 'Named lift',
      rate: mr,
      delta: mr - before,
      applied: true,
      sentence: `Guests are already named, so the rate is lifted by ${Math.round(namedLift * 1000) / 10} points, from ${formatMrPctPrecise(before)} to ${formatMrPctPrecise(mr)}. Naming is evidence the group has started to materialise.`,
    }));
  } else {
    steps.push(step({
      id: 'named',
      title: 'Named lift',
      rate: mr,
      sentence: 'Nobody is named yet, so there is no named-guest lift.',
    }));
  }

  const sourceMr = normalizeMr(input.sourceMr);
  const useSourceNudge = input.useSourceNudge !== false;
  if (!useSourceNudge) {
    steps.push(step({
      id: 'source',
      title: 'Source rate',
      rate: mr,
      sentence: sourceMr == null
        ? 'Source rate nudge is off. No source rate is applied.'
        : `Source rate nudge is off. The stored source rate (${formatMrPctPrecise(sourceMr)}) is shown for comparison only.`,
    }));
  } else if (sourceMr != null) {
    const gap = sourceMr - mr;
    if (Math.abs(gap) >= sourceNudgeMinGap) {
      const before = mr;
      mr = clamp01(mr + (gap * sourceNudgeStrength)) ?? mr;
      reasons.push(
        gap > 0
          ? `Source MR higher (${formatMrPct(sourceMr)}); mild uplift`
          : `Source MR lower (${formatMrPct(sourceMr)}); mild temper`
      );
      const direction = gap > 0 ? 'higher' : 'lower';
      steps.push(step({
        id: 'source',
        title: 'Source rate',
        rate: mr,
        delta: mr - before,
        applied: true,
        sentence: `The source rate is ${formatMrPctPrecise(sourceMr)}, ${formatMrPctPrecise(Math.abs(gap))} ${direction} than the rate so far. Only ${Math.round(sourceNudgeStrength * 100)}% of that gap is applied. The source rate can nudge the result. It is never copied. The rate moves from ${formatMrPctPrecise(before)} to ${formatMrPctPrecise(mr)}.`,
      }));
    } else {
      steps.push(step({
        id: 'source',
        title: 'Source rate',
        rate: mr,
        sentence: `The source rate is ${formatMrPctPrecise(sourceMr)}, within ${Math.round(sourceNudgeMinGap * 100)} points of the rate so far, so it does not move the result. A nudge that small would be noise.`,
      }));
    }
  } else {
    steps.push(step({
      id: 'source',
      title: 'Source rate',
      rate: mr,
      sentence: 'No source rate is stored on this group, so nothing is added from source.',
    }));
  }

  if (input.distressedSailing && requested >= largeGroupPax) {
    const before = mr;
    mr *= distressCut;
    reasons.push('Large commitment on distressed sailing');
    steps.push(step({
      id: 'distress',
      title: 'Tight sailing',
      rate: mr,
      delta: mr - before,
      applied: true,
      sentence: `The request is at least ${largeGroupPax} guests on a sailing with little space left, so the rate is cut to ${Math.round(distressCut * 100)}% of itself, from ${formatMrPctPrecise(before)} to ${formatMrPctPrecise(mr)}. A large hold is harder to place when the ship is already tight.`,
    }));
  } else if (input.distressedSailing) {
    steps.push(step({
      id: 'distress',
      title: 'Tight sailing',
      rate: mr,
      sentence: `The sailing has little space left, but the request is under ${largeGroupPax} guests, so the distress cut does not apply.`,
    }));
  } else {
    steps.push(step({
      id: 'distress',
      title: 'Tight sailing',
      rate: mr,
      sentence: `No distress cut. A request of ${largeGroupPax} guests or more is reduced only when the sailing has little space left. This example has no remaining-space signal.`,
    }));
  }

  mr = clamp01(mr) ?? prior;
  steps.forEach((item, index) => {
    if (index === steps.length - 1) item.rate = mr;
  });
  const sourceExpected = sourceMr == null ? null : Math.round(requested * sourceMr);
  const taliaExpected = Math.round(requested * mr);
  steps.push(step({
    id: 'result',
    title: 'Talia MR',
    rate: mr,
    delta: 0,
    applied: true,
    sentence: sourceMr == null
      ? `Talia MR is ${formatMrPctPrecise(mr)}. Expected guests are ${Math.round(requested)} requested × ${formatMrPctPrecise(mr)} = ${taliaExpected}. There is no source rate to compare.`
      : `Talia MR is ${formatMrPctPrecise(mr)}. Expected guests are ${Math.round(requested)} requested × ${formatMrPctPrecise(mr)} = ${taliaExpected}. The source rate would have expected ${sourceExpected}.`,
  }));

  return {
    talia_mr: mr,
    source_mr: sourceMr,
    reasons,
    steps,
    requested,
    reserved,
    sourceExpected,
    taliaExpected,
  };
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
 *   useSourceNudge?: boolean,
 * }} input
 * @returns {{ talia_mr: number, source_mr: number|null, reasons: string[] }}
 */
export const computeTaliaMaterialisation = (input = {}) => {
  const explained = explainTaliaMaterialisation(input);
  return {
    talia_mr: explained.talia_mr,
    source_mr: explained.source_mr,
    reasons: explained.reasons,
  };
};

/**
 * Point-in-time named evidence for a hold/day.
 * Explicit header named wins. When missing: BK uses requested (booked evidence);
 * quotes/offers stay at 0. Never uses final/outcome named.
 * @param {{ status?: string, requested?: number, named?: number|null }} input
 */
export const resolveAsOfNamed = ({ status, requested, named } = {}) => {
  if (named != null && named !== '') {
    const n = Number(named);
    if (Number.isFinite(n)) return Math.max(0, Math.round(n));
  }
  const code = String(status || '').trim().toUpperCase();
  if (code === 'BK') return Math.max(0, Math.round(Number(requested) || 0));
  return 0;
};

/**
 * Score one hold/day with MR01 arithmetic (compat facade).
 * Multi-model callers should use `scoreWithModel` from `lib/mrModels`.
 * Kept here (not delegated to the registry) to avoid a circular ESM import:
 * mrModels/mr01 → explainTaliaMaterialisation in this file.
 * @param {{
 *   status?: string,
 *   requested?: number,
 *   named?: number|null,
 *   probability?: number|null,
 *   useSourceNudge?: boolean,
 *   distressedSailing?: boolean,
 *   params?: object,
 * }} hold
 */
export const scoreTaliaHold = (hold = {}) => {
  const status = String(hold.status || '').trim().toUpperCase();
  const requested = Math.round(Number(hold.requested) || 0);
  const named = resolveAsOfNamed({
    status,
    requested,
    named: hold.named,
  });
  const sourceMr = normalizeMr(hold.probability);
  const params = hold.params && typeof hold.params === 'object' ? hold.params : {};
  const useSourceNudge = hold.useSourceNudge !== undefined
    ? hold.useSourceNudge !== false
    : params.useSourceNudge !== false;
  if (isCancelledStatus(status)) {
    return {
      modelId: 'MR01',
      rate: 0,
      talia_mr: 0,
      source_mr: sourceMr,
      expectedGuests: 0,
      reasons: ['Cancelled — forward expected guests are 0'],
      sourceExpectedGuests: 0,
      taliaExpectedGuests: 0,
      namedGuests: named,
      cancelled: true,
    };
  }
  const rates = computeTaliaMaterialisation({
    requestedPax: requested,
    reservedPax: named,
    sourceMr: hold.probability,
    hasNamedBooked: named > 0,
    offerHeavy: (status === 'QT' || status === 'OF') && named === 0,
    distressedSailing: Boolean(hold.distressedSailing),
    useSourceNudge,
    prior: params.prior,
    priorWeight: params.priorWeight,
    namedWeight: params.namedWeight,
    offerCut: params.offerCut,
    namedLift: params.namedLift,
    sourceNudgeStrength: params.sourceNudgeStrength,
    sourceNudgeMinGap: params.sourceNudgeMinGap,
    distressCut: params.distressCut,
    largeGroupPax: params.largeGroupPax,
  });
  const expected = Math.round(requested * (rates.talia_mr || 0));
  return {
    modelId: 'MR01',
    rate: rates.talia_mr,
    ...rates,
    namedGuests: named,
    sourceExpectedGuests: sourceMr == null ? 0 : Math.round(requested * sourceMr),
    taliaExpectedGuests: expected,
    expectedGuests: expected,
    cancelled: false,
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
  explainTaliaMaterialisation,
  evaluateGroupPerformance,
  resolveAsOfNamed,
  scoreTaliaHold,
  isCancelledStatus,
  normalizeMr,
  formatMrPct,
  formatMrPctPrecise,
  isDistressedRemaining,
};
