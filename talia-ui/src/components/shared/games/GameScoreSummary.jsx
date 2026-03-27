import React from 'react';

const safeNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

const GameScoreSummary = ({
  currentScore = 0,
  userHighScore = 0,
  totalHighScore = 0,
}) => (
  <div className="game-score-summary" role="status" aria-live="polite">
    <div className="game-score-summary__item">
      <span className="game-score-summary__label">Current</span>
      <span className="game-score-summary__value">{safeNumber(currentScore)}</span>
    </div>
    <div className="game-score-summary__item game-score-summary__item--accent">
      <span className="game-score-summary__label">Your Best</span>
      <span className="game-score-summary__value">{safeNumber(userHighScore)}</span>
    </div>
    <div className="game-score-summary__item game-score-summary__item--total">
      <span className="game-score-summary__label">Global Best</span>
      <span className="game-score-summary__value">{safeNumber(totalHighScore)}</span>
    </div>
  </div>
);

export default GameScoreSummary;
