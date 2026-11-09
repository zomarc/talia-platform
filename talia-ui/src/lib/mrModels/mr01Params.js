/**
 * MR01 (Talia formula) tunable parameters — defaults match today's shipped method.
 */

export const MR01_DEFAULT_PARAMS = Object.freeze({
  prior: 0.5,
  priorWeight: 0.35,
  namedWeight: 0.65,
  offerCut: 0.85,
  namedLift: 0.08,
  useSourceNudge: true,
  sourceNudgeStrength: 0.15,
  sourceNudgeMinGap: 0.05,
  distressCut: 0.9,
  largeGroupPax: 50,
});

/** Named presets for Views / Method strip. */
export const MR01_PRESETS = Object.freeze({
  default: { id: 'default', label: 'MR01 default', params: { ...MR01_DEFAULT_PARAMS } },
  noNudge: {
    id: 'noNudge',
    label: 'MR01 · no source nudge',
    params: { ...MR01_DEFAULT_PARAMS, useSourceNudge: false },
  },
  strictPrior: {
    id: 'strictPrior',
    label: 'MR01 · stronger prior',
    params: { ...MR01_DEFAULT_PARAMS, priorWeight: 0.5, namedWeight: 0.5 },
  },
});

export const mergeMr01Params = (overrides = {}) => ({
  ...MR01_DEFAULT_PARAMS,
  ...(overrides && typeof overrides === 'object' ? overrides : {}),
});
