/**
 * Collecting a bonus “extra” arms 10s of 2× points on all score gains.
 * Store `doubleScoreUntil` (performance.now() ms) on each game model.
 */

export const ARCADE_DOUBLE_SCORE_MS = 10000;

export function resetArcadeDoubleScore(model) {
  model.doubleScoreUntil = 0;
}

export function armArcadeDoubleScore(model) {
  model.doubleScoreUntil = performance.now() + ARCADE_DOUBLE_SCORE_MS;
}

export function isArcadeDoubleScoreActive(model) {
  return performance.now() < (model.doubleScoreUntil || 0);
}

/** Add points; doubled while {@link isArcadeDoubleScoreActive}. */
export function addArcadeScore(model, delta) {
  if (delta <= 0) return;
  const mult = isArcadeDoubleScoreActive(model) ? 2 : 1;
  model.score += Math.floor(delta * mult);
}

export function getArcadeDoubleScoreSecondsLeft(model) {
  const until = model.doubleScoreUntil || 0;
  if (until <= performance.now()) return 0;
  return Math.max(0, Math.ceil((until - performance.now()) / 1000));
}
