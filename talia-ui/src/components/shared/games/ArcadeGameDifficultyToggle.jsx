import React from 'react';
import {
  ARCADE_DIFFICULTY_EASY,
  ARCADE_DIFFICULTY_NORMAL,
} from './arcadeDifficulty';

/**
 * Standard Easy / Normal control for all canvas arcade panels.
 */
const ArcadeGameDifficultyToggle = ({ value, onChange, disabled = false }) => (
  <div
    className="talia-arcade-difficulty-toggle"
    role="group"
    aria-label="Difficulty"
  >
    <button
      type="button"
      className={`talia-arcade-difficulty-toggle__btn${value === ARCADE_DIFFICULTY_EASY ? ' talia-arcade-difficulty-toggle__btn--active' : ''}`}
      disabled={disabled}
      onClick={() => onChange(ARCADE_DIFFICULTY_EASY)}
    >
      Easy
    </button>
    <button
      type="button"
      className={`talia-arcade-difficulty-toggle__btn${value === ARCADE_DIFFICULTY_NORMAL ? ' talia-arcade-difficulty-toggle__btn--active' : ''}`}
      disabled={disabled}
      onClick={() => onChange(ARCADE_DIFFICULTY_NORMAL)}
    >
      Normal
    </button>
  </div>
);

export default ArcadeGameDifficultyToggle;
