/**
 * Dockview `component` / report `panelId` values for built-in arcade games.
 * Used by Dashboard (P/W shortcuts) and ReportShell (avoid duplicate pause chrome).
 */
export const ARCADE_GAME_PANEL_COMPONENTS = new Set([
  'pong',
  'breakout-game',
  'pac-man',
  'space-invaders',
  'asteroids',
  'moon-lander',
]);

export const isArcadeGamePanelComponent = (panelComponentId) =>
  Boolean(panelComponentId) && ARCADE_GAME_PANEL_COMPONENTS.has(String(panelComponentId));
