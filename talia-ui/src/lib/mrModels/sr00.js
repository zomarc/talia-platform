/**
 * SR00 — source rate as a model. Expected = sourceMr × requested.
 */

import {
  isCancelledStatus,
  normalizeMr,
} from '../../components/focus-panels/GroupsExplorer/groupsMaterialisation.js';

export const SR00_ID = 'SR00';

export const sr00Model = {
  id: SR00_ID,
  label: 'SR00 · Source rate',
  description: 'Uses the held source probability as the materialisation rate.',
  version: 1,
  paramsSchema: null,
  scoreHold(ctx = {}) {
    const status = String(ctx.status || '').trim().toUpperCase();
    const requested = Math.round(Number(ctx.requested) || 0);
    const sourceMr = normalizeMr(ctx.probability ?? ctx.sourceMr);
    if (isCancelledStatus(status)) {
      return {
        modelId: SR00_ID,
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
    const rate = sourceMr == null ? 0 : sourceMr;
    const expected = Math.round(requested * rate);
    return {
      modelId: SR00_ID,
      rate,
      talia_mr: rate,
      source_mr: sourceMr,
      expectedGuests: expected,
      taliaExpectedGuests: expected,
      sourceExpectedGuests: expected,
      namedGuests: Math.round(Number(ctx.named) || 0),
      reasons: sourceMr == null
        ? ['SR00: no source rate stored — expected 0']
        : [`SR00 source rate ${(rate * 100).toFixed(0)}%`],
      steps: [{
        id: 'source',
        title: 'Source rate',
        rate,
        applied: true,
        sentence: sourceMr == null
          ? 'SR00 has no source probability on this hold, so expected guests are 0.'
          : `SR00 copies the held source rate (${(rate * 100).toFixed(0)}%). Expected guests are requested × that rate.`,
      }],
      cancelled: false,
    };
  },
};
