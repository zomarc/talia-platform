import React from 'react';

const formatGameLabel = (value) => {
  const raw = String(value || 'unknown');
  return raw
    .split(/[-_]/g)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
};

const GameScoreboard = ({ title = 'Game Scores', loading = false, top = [], recent = [] }) => (
  <div className="game-scoreboard">
    <h3 className="game-scoreboard__title">{title}</h3>
    {loading ? (
      <div className="game-scoreboard__empty">Loading leaderboard...</div>
    ) : (
      <div className="game-scoreboard__grid">
        <div className="game-scoreboard__panel">
          <h4 className="game-scoreboard__panel-title">Top 5</h4>
          {top.length === 0 ? (
            <div className="game-scoreboard__empty">No scores yet.</div>
          ) : (
            <ol className="game-scoreboard__list">
              {top.map((row, index) => (
                <li key={`top-${row.gameId}-${row.userId}-${index}`} className="game-scoreboard__item">
                  <span className="game-scoreboard__user">{row.userId}</span>
                  <span className="game-scoreboard__game">{formatGameLabel(row.gameId)}</span>
                  <span className="game-scoreboard__score">{row.highScore}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="game-scoreboard__panel">
          <h4 className="game-scoreboard__panel-title">Last 5</h4>
          {recent.length === 0 ? (
            <div className="game-scoreboard__empty">No recent saves.</div>
          ) : (
            <ol className="game-scoreboard__list">
              {recent.map((row, index) => (
                <li key={`recent-${row.gameId}-${row.userId}-${index}`} className="game-scoreboard__item">
                  <span className="game-scoreboard__user">{row.userId}</span>
                  <span className="game-scoreboard__game">{formatGameLabel(row.gameId)}</span>
                  <span className="game-scoreboard__score">{row.lastScore}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    )}
  </div>
);

export default GameScoreboard;
