import React from 'react';
import GameScoreboard from './GameScoreboard';

const GameScorePopover = ({
  open,
  onClose,
  title = 'Game Scores',
  loading = false,
  top = [],
  recent = [],
}) => {
  if (!open) return null;
  return (
    <div className="game-score-popover" role="dialog" aria-label="Game score leaderboard">
      <div className="game-score-popover__header">
        <strong className="game-score-popover__title">{title}</strong>
        <button type="button" className="talia-btn talia-btn--small" onClick={onClose}>
          Close
        </button>
      </div>
      <GameScoreboard title={title} loading={loading} top={top} recent={recent} />
    </div>
  );
};

export default GameScorePopover;
