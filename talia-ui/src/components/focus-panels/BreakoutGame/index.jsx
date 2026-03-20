import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BreakoutGamePresenter from './BreakoutGamePresenter';
import { loadGameScore, loadGameScoreBoard, saveGameScore } from '../../../services/data/gameScores';

const GAME_ID = 'breakout';

const getCurrentUserId = () => {
  try {
    return localStorage.getItem('devUserId')
      || localStorage.getItem('userId')
      || 'dev-user-1';
  } catch {
    return 'dev-user-1';
  }
};

const BreakoutGameContainer = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [scoreState, setScoreState] = useState({
    userId: getCurrentUserId(),
    highScore: 0,
    lastScore: 0,
    updatedAt: null,
  });
  const [leaderboard, setLeaderboard] = useState({
    top: [],
    recent: [],
  });

  const userId = useMemo(() => getCurrentUserId(), []);

  const loadLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const payload = await loadGameScoreBoard({
        gameId: null,
        limitTop: 5,
        limitRecent: 5,
        component: 'Breakout Game',
      });
      setLeaderboard({
        top: Array.isArray(payload.top) ? payload.top : [],
        recent: Array.isArray(payload.recent) ? payload.recent : [],
      });
    } catch {
      setLeaderboard({ top: [], recent: [] });
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  const loadScore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await loadGameScore({
        gameId: GAME_ID,
        userId,
        component: 'Breakout Game',
      });
      setScoreState({
        userId: payload.userId || userId,
        highScore: Number(payload.highScore || 0),
        lastScore: Number(payload.lastScore || 0),
        updatedAt: payload.updatedAt || null,
      });
    } catch (loadErr) {
      setError(loadErr);
    } finally {
      setLoading(false);
    }
    await loadLeaderboard();
  }, [loadLeaderboard, userId]);

  useEffect(() => {
    loadScore();
  }, [loadScore]);

  const handleSaveScore = useCallback(async (score) => {
    const parsedScore = Math.max(0, Number(score) || 0);
    setSaving(true);
    setSaveError(null);
    try {
      const payload = await saveGameScore({
        gameId: GAME_ID,
        score: parsedScore,
        userId,
        component: 'Breakout Game',
      });
      if (!payload) return null;
      const nextState = {
        userId: payload.userId || userId,
        highScore: Number(payload.highScore || 0),
        lastScore: Number(payload.lastScore || 0),
        updatedAt: payload.updatedAt || null,
      };
      setScoreState(nextState);
      await loadLeaderboard();
      return nextState;
    } catch (saveErr) {
      setSaveError(saveErr);
      return null;
    } finally {
      setSaving(false);
    }
  }, [loadLeaderboard, userId]);

  return (
    <BreakoutGamePresenter
      loading={loading}
      loadError={error}
      saveError={saveError}
      saving={saving}
      userId={scoreState.userId}
      highScore={scoreState.highScore}
      lastScore={scoreState.lastScore}
      updatedAt={scoreState.updatedAt}
      onReloadScore={loadScore}
      onSaveScore={handleSaveScore}
      leaderboard={leaderboard}
      leaderboardLoading={leaderboardLoading}
    />
  );
};

export default BreakoutGameContainer;
