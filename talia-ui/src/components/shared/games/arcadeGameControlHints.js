/**
 * Per-panel control hints (idle overlay only). HUD shows only “P — pause”.
 * Keys match `ARCADE_GAME_PANEL_COMPONENTS` in arcadeGamePanelIds.js.
 */
export const ARCADE_CONTROL_HINTS_BY_PANEL = {
  'breakout-game': '←/→ move · click / keys launch',
  pong: '↑/↓ move · click / move to serve',
  'pac-man': 'arrow keys move',
  'space-invaders': '←/→ move · Space / click fire',
  asteroids: '←/→ rotate · ↑ thrust · Space fire',
  'moon-lander': '←/→ rotate · Space / ↑ thrust',
};

export function getArcadeControlHint(panelComponentId) {
  return ARCADE_CONTROL_HINTS_BY_PANEL[String(panelComponentId)] || '';
}

/** Idle overlay subtitle: start copy + controls for this game. */
export function buildArcadeIdleSubtitle(panelComponentId) {
  const hint = getArcadeControlHint(panelComponentId);
  return hint ? `Press Start to play. ${hint}` : 'Press Start to play.';
}
