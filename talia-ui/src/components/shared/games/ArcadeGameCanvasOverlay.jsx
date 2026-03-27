import React from 'react';
import GameScorePopover from './GameScorePopover';

/**
 * Full-screen canvas overlay: pause / ready / game over / resume.
 * Golden path for new arcade panels: render inside `talia-game-canvas-shell` when `open` is true;
 * pair with {@link ArcadeGameScoreHud} and {@link formatArcadeOverlaySubtitle} + {@link buildArcadeIdleSubtitle}.
 * Styling: `talia-game-arcade-backdrop`, `talia-game-overlay`, `talia-game-arcade`, tone classes.
 */
const ArcadeGameCanvasOverlay = ({
  open,
  tone,
  title,
  subtitle,
  showStartButton,
  startLabel,
  onStartClick,
  onOverlayPointer,
  arcadeOverlayClickable,
  gameState,
  leaderboardLoading,
  topRows,
  recentRows,
}) => {
  if (!open) return null;

  return (
    <div
      className={`talia-game-arcade-backdrop talia-game-overlay talia-game-arcade talia-game-overlay--${tone}${arcadeOverlayClickable ? ' talia-game-arcade--clickable' : ''}`}
      role="status"
      aria-live="polite"
      onClick={onOverlayPointer}
    >
      <div className={`talia-game-overlay__panel talia-game-overlay__panel--${tone}`}>
        <div className={`talia-game-overlay__title talia-game-overlay__title--${tone}`}>{title}</div>
        {subtitle ? (
          <div className={`talia-game-overlay__subtitle talia-game-overlay__subtitle--${tone}`}>{subtitle}</div>
        ) : null}
        {showStartButton ? (
          <button
            type="button"
            className="talia-btn talia-btn--primary talia-game-start-overlay-btn"
            onClick={onStartClick}
          >
            {startLabel}
          </button>
        ) : null}
        {gameState === 'over' ? (
          <GameScorePopover
            open
            title="HI SCORES"
            loading={leaderboardLoading}
            top={topRows}
            recent={recentRows}
            variant="overlay"
          />
        ) : null}
      </div>
    </div>
  );
};

export default ArcadeGameCanvasOverlay;
