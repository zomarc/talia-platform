/**
 * MR00 — flat 50% baseline. No named/source/status inputs (cancels still 0).
 */

import {
  isCancelledStatus,
  normalizeMr,
} from '../../components/focus-panels/GroupsExplorer/groupsMaterialisation.js';

export const MR00_ID = 'MR00';

export const mr00Model = {
  id: MR00_ID,
  label: 'MR00 · Flat 50%',
  description: 'Baseline: always 50% of requested guests. Ignores named guests and source rate.',
  version: 1,
  paramsSchema: null,
  scoreHold(ctx = {}) {
    const status = String(ctx.status || '').trim().toUpperCase();
    const requested = Math.round(Number(ctx.requested) || 0);
    const sourceMr = normalizeMr(ctx.probability ?? ctx.sourceMr);
    if (isCancelledStatus(status)) {
      return {
        modelId: MR00_ID,
        rate: 0,
        talia_mr: 0,
        source_mr: sourceMr,
        expectedGuests: 0,
        taliaExpectedGuests: 0,
        sourceExpectedGuests: 0,
        namedGuests: Math.round(Number(ctx.named) || 0),
        reasons: ['Cancelled — forward expected guests are 0'],
        steps: [],
        cancelled: true,
      };
    }
    const rate = 0.5;
    const expected = Math.round(requested * rate);
    return {
      modelId: MR00_ID,
      rate,
      talia_mr: rate,
      source_mr: sourceMr,
      expectedGuests: expected,
      taliaExpectedGuests: expected,
      sourceExpectedGuests: sourceMr == null ? 0 : Math.round(requested * sourceMr),
      namedGuests: Math.round(Number(ctx.named) || 0),
      reasons: ['MR00 flat prior 50%'],
      steps: [{
        id: 'prior',
        title: 'Flat prior',
        rate,
        applied: true,
        sentence: 'MR00 always uses 50%. It ignores named guests and the source rate.',
      }],
      cancelled: false,
    };
  },
};
