import React, { useMemo } from 'react';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';

const formatGameLabel = (value) => {
  const raw = String(value || 'unknown');
  return raw
    .split(/[-_]/g)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
};

const GameScoreboard = ({ title = 'Game Scores', loading = false, top = [], recent = [], mode = 'grid' }) => {
  const { devUsers = [] } = useSupabaseAuth();
  const userLabelMap = useMemo(() => {
    const map = new Map();
    (Array.isArray(devUsers) ? devUsers : []).forEach((entry) => {
      if (!entry) return;
      const label = String(entry.name || entry.email || entry.id || '').trim();
      if (!label) return;
      const id = String(entry.id || '').trim().toLowerCase();
      const email = String(entry.email || '').trim().toLowerCase();
      if (id) map.set(id, label);
      if (email) map.set(email, label);
    });
    return map;
  }, [devUsers]);

  const resolveUserLabel = (userId) => {
    const key = String(userId || '').trim().toLowerCase();
    if (!key) return 'Unknown User';
    return userLabelMap.get(key) || String(userId);
  };

  if (mode === 'flat') {
    const rows = (Array.isArray(top) ? top : []).slice(0, 20);
    return (
      <div className="game-scoreboard game-scoreboard--flat">
        <h3 className="game-scoreboard__title">{title}</h3>
        {loading ? (
          <div className="game-scoreboard__empty">Loading leaderboard...</div>
        ) : rows.length === 0 ? (
          <div className="game-scoreboard__empty">No scores yet.</div>
        ) : (
          <ol className="game-scoreboard__list game-scoreboard__list--flat">
            {rows.map((row, index) => (
              <li key={`flat-${row.gameId}-${row.userId}-${index}`} className="game-scoreboard__item game-scoreboard__item--flat">
                <span className="game-scoreboard__rank">{index + 1}</span>
                <span className="game-scoreboard__user">{resolveUserLabel(row.userId)}</span>
                <span className="game-scoreboard__score">{Number(row?.highScore || 0)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  return (
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
                  <span className="game-scoreboard__user">{resolveUserLabel(row.userId)}</span>
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
                  <span className="game-scoreboard__user">{resolveUserLabel(row.userId)}</span>
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
};

export default GameScoreboard;
