import React from 'react';
import GameScoreSummary from './GameScoreSummary';
import { ARCADE_COMMON_CONTROLS } from './arcadeGameUi';

/**
 * Golden path for new arcade panels: mount inside `talia-game-canvas-shell` over the canvas.
 * Scores + meta on row 1; row 2 is pause only (control details are on the idle overlay).
 */
const ArcadeGameScoreHud = ({
  currentScore,
  userHighScore,
  totalHighScore,
  meta = null,
  doubleScoreSeconds = 0,
}) => (
  <div className="talia-game-score-overlay" aria-hidden="true">
    <div className="talia-game-score-overlay__row">
      <GameScoreSummary
        currentScore={currentScore}
        userHighScore={userHighScore}
        totalHighScore={totalHighScore}
      />
      {meta != null && meta !== '' && (
        <span className="talia-game-score-overlay__meta">{meta}</span>
      )}
      {doubleScoreSeconds > 0 && (
        <span className="talia-game-score-overlay__double" title="Bonus: double score">
          2× {doubleScoreSeconds}s
        </span>
      )}
    </div>
    <span className="talia-game-score-overlay__controls">{ARCADE_COMMON_CONTROLS}</span>
  </div>
);

export default ArcadeGameScoreHud;
