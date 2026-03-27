import React from 'react';
import GameScoreboard from './GameScoreboard';

const GameScorePopover = ({
  open,
  onClose,
  title = 'Game Scores',
  loading = false,
  top = [],
  recent = [],
  variant = 'floating',
}) => {
  if (!open) return null;
  const isOverlayVariant = variant === 'overlay';
  return (
    <div className={`game-score-popover ${isOverlayVariant ? 'game-score-popover--overlay' : ''}`} role="dialog" aria-label="Game score leaderboard">
      <div className="game-score-popover__header">
        <strong className="game-score-popover__title">{title}</strong>
        {!isOverlayVariant && (
          <button type="button" className="talia-btn talia-btn--small" onClick={onClose}>
            Close
          </button>
        )}
      </div>
      <GameScoreboard title={title} loading={loading} top={top} recent={recent} mode={isOverlayVariant ? 'flat' : 'grid'} />
    </div>
  );
};

export default GameScorePopover;
