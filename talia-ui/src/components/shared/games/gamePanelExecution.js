/**
 * Single execution gate for focus-panel games: run only when the tab is active
 * and the user has not paused the panel (P). Losing tab focus and pressing P
 * both flow through this predicate via usePanelTabActive + usePanelPaused.
 */
export const isGamePanelExecutionActive = (isPanelActive, isPanelPaused) =>
  Boolean(isPanelActive) && isPanelPaused !== true;
