/**
 * Multi-model MR framework — public exports.
 */

export {
  listMrModels,
  getMrModel,
  scoreWithModel,
  DEFAULT_MR_MODEL_ID,
  COMPARE_MR_MODEL_IDS,
  MR_MODEL_CHOICES,
  MR_MODEL_CHOICE_LABELS,
  MR00_ID,
  MR01_ID,
  SR00_ID,
  MR01_DEFAULT_PARAMS,
  MR01_PRESETS,
  mergeMr01Params,
} from './registry.js';

export {
  DEFAULT_ACCURACY_TOLERANCE,
  absGapAtDtd,
  signedBiasAtDtd,
  pathError,
  earliestAccurateDtd,
  summarizeModelAccuracy,
  buildAccuracyLeaderboard,
} from './accuracy.js';
