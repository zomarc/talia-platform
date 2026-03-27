/** Shared copy + formatting for arcade panel overlays (pause, game over, idle). */

export const ARCADE_DEFAULT_IDLE_SUBTITLE = 'Press Start to play.';

export { buildArcadeIdleSubtitle, getArcadeControlHint } from './arcadeGameControlHints';

/**
 * @param {object} opts
 * @param {string|null|undefined} opts.overlaySubtitle — explicit subtitle from game (e.g. pause hook)
 * @param {boolean} opts.isGameOverHoldActive
 * @param {number} opts.score
 * @param {number} opts.restartInSeconds
 * @param {string} [opts.defaultIdle] — when not playing and no overlay subtitle
 */
export function formatArcadeOverlaySubtitle({
  overlaySubtitle,
  isGameOverHoldActive,
  score,
  restartInSeconds,
  defaultIdle = ARCADE_DEFAULT_IDLE_SUBTITLE,
}) {
  const base = overlaySubtitle || (isGameOverHoldActive ? `Final score: ${score}` : defaultIdle);
  if (isGameOverHoldActive && restartInSeconds > 0) {
    return `${base} - Continue in ${restartInSeconds}...`;
  }
  return base;
}

/** Shown on every arcade HUD (full per-game hints live on the idle overlay only). */
export const ARCADE_COMMON_CONTROLS = 'P — pause';

/**
 * Overlay chrome tone; pass `overlay.tone === 'win'` for celebration panels.
 */
export function getArcadeOverlayTone({
  explicitTone,
  overlayTitle,
  isGameOverHoldActive,
  isLifeLossMessage,
}) {
  if (explicitTone === 'win') return 'win';
  if (overlayTitle === 'Paused') return 'paused';
  if (isGameOverHoldActive) return 'danger';
  if (isLifeLossMessage) return 'warning';
  return 'default';
}
