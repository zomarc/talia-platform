/**
 * MR model registry — MR00 / MR01 / SR00 (+ future models).
 */

import { mr00Model, MR00_ID } from './mr00.js';
import { mr01Model, MR01_ID } from './mr01.js';
import { sr00Model, SR00_ID } from './sr00.js';
import { mergeMr01Params } from './mr01Params.js';

export { MR00_ID, MR01_ID, SR00_ID };
export { MR01_DEFAULT_PARAMS, MR01_PRESETS, mergeMr01Params } from './mr01Params.js';

const MODELS = Object.freeze([mr00Model, mr01Model, sr00Model]);
const BY_ID = Object.freeze(Object.fromEntries(MODELS.map((m) => [m.id, m])));

export const DEFAULT_MR_MODEL_ID = MR01_ID;

export const COMPARE_MR_MODEL_IDS = Object.freeze([MR00_ID, MR01_ID, SR00_ID]);

export function listMrModels() {
  return MODELS.map((m) => ({
    id: m.id,
    label: m.label,
    description: m.description,
    version: m.version,
    paramsSchema: m.paramsSchema,
  }));
}

export function getMrModel(modelId) {
  const id = String(modelId || DEFAULT_MR_MODEL_ID).trim().toUpperCase();
  return BY_ID[id] || BY_ID[DEFAULT_MR_MODEL_ID];
}

/**
 * Score a hold/day with the named model.
 * @param {string} modelId
 * @param {{
 *   status?: string,
 *   requested?: number,
 *   named?: number|null,
 *   probability?: number|null,
 *   sourceMr?: number|null,
 *   distressedSailing?: boolean,
 * }} ctx
 * @param {object} [params] model-specific params (MR01)
 */
export function scoreWithModel(modelId, ctx = {}, params = {}) {
  const model = getMrModel(modelId);
  const resolvedParams = model.id === MR01_ID ? mergeMr01Params(params) : params;
  return model.scoreHold(ctx, resolvedParams);
}

/** Choice labels for Views catalog. */
export const MR_MODEL_CHOICE_LABELS = Object.freeze(
  Object.fromEntries(MODELS.map((m) => [m.id, m.label]))
);

export const MR_MODEL_CHOICES = Object.freeze(MODELS.map((m) => m.id));
