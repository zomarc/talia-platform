/**
 * Optional bonus targets (“extras”) for canvas arcade games.
 *
 * Contract (each game implements its own `model.extra` shape):
 * - `model.extraSpawn` — scheduling only, from {@link createExtraSpawnState}.
 * - `model.extra` (or `extraUfo`, etc.) — active bonus; `null` when none.
 *
 * Each frame: if no active extra and {@link isExtraSpawnDue}, spawn your extra;
 * when it is cleared (eaten, shot, off-screen), call {@link armExtraSpawn}.
 * On pickup, call `armArcadeDoubleScore` from `arcadeDoubleScore.js` for the shared 10s double-score window.
 */

export function createExtraSpawnState() {
  return { nextAtFrame: 0 };
}

export function randomExtraDelayFrames(minInclusive, maxInclusive) {
  const lo = Math.min(minInclusive, maxInclusive);
  const hi = Math.max(minInclusive, maxInclusive);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

/** Schedule the next window when an extra may appear (in game frame/tick units). */
export function armExtraSpawn(spawnState, currentFrame, minDelayFrames, maxDelayFrames) {
  spawnState.nextAtFrame = currentFrame + randomExtraDelayFrames(minDelayFrames, maxDelayFrames);
}

/**
 * @param {ReturnType<createExtraSpawnState>} spawnState
 * @param {number} currentFrameOrTick — monotonic counter (e.g. model.frame or model.tick)
 * @param {boolean} hasActiveExtra
 */
export function isExtraSpawnDue(spawnState, currentFrameOrTick, hasActiveExtra) {
  return !hasActiveExtra && currentFrameOrTick >= spawnState.nextAtFrame;
}
