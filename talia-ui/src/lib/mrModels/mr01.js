/**
 * MR01 — current Talia materialisation formula (parameterised).
 */

import {
  explainTaliaMaterialisation,
  isCancelledStatus,
  normalizeMr,
  resolveAsOfNamed,
} from '../../components/focus-panels/GroupsExplorer/groupsMaterialisation.js';
import { mergeMr01Params } from './mr01Params.js';

export const MR01_ID = 'MR01';

export const mr01Model = {
  id: MR01_ID,
  label: 'MR01 · Talia',
  description: 'Talia materialisation: prior, named blend, offer/named adjustments, optional source nudge.',
  version: 1,
  paramsSchema: 'MR01',
  scoreHold(ctx = {}, params = {}) {
    const p = mergeMr01Params(params);
    const status = String(ctx.status || '').trim().toUpperCase();
    const requested = Math.round(Number(ctx.requested) || 0);
    const named = resolveAsOfNamed({
      status,
      requested,
      named: ctx.named,
    });
    const sourceMr = normalizeMr(ctx.probability ?? ctx.sourceMr);
    if (isCancelledStatus(status)) {
      return {
        modelId: MR01_ID,
        rate: 0,
        talia_mr: 0,
        source_mr: sourceMr,
        expectedGuests: 0,
        taliaExpectedGuests: 0,
        sourceExpectedGuests: 0,
        namedGuests: named,
        reasons: ['Cancelled — forward expected guests are 0'],
        steps: [],
        cancelled: true,
        params: p,
      };
    }
    const explained = explainTaliaMaterialisation({
      requestedPax: requested,
      reservedPax: named,
      sourceMr: ctx.probability ?? ctx.sourceMr,
      hasNamedBooked: named > 0,
      offerHeavy: (status === 'QT' || status === 'OF') && named === 0,
      distressedSailing: Boolean(ctx.distressedSailing),
      prior: p.prior,
      priorWeight: p.priorWeight,
      namedWeight: p.namedWeight,
      offerCut: p.offerCut,
      namedLift: p.namedLift,
      useSourceNudge: p.useSourceNudge !== false,
      sourceNudgeStrength: p.sourceNudgeStrength,
      sourceNudgeMinGap: p.sourceNudgeMinGap,
      distressCut: p.distressCut,
      largeGroupPax: p.largeGroupPax,
    });
    const rate = explained.talia_mr;
    const expected = Math.round(requested * (rate || 0));
    return {
      modelId: MR01_ID,
      rate,
      talia_mr: rate,
      source_mr: explained.source_mr,
      expectedGuests: expected,
      taliaExpectedGuests: expected,
      sourceExpectedGuests: sourceMr == null ? 0 : Math.round(requested * sourceMr),
      namedGuests: named,
      reasons: explained.reasons,
      steps: explained.steps,
      cancelled: false,
      params: p,
    };
  },
};
