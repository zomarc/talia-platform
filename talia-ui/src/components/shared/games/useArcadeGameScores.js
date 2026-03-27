import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadGameScore, loadGameScoreBoard, saveGameScore } from '../../../services/data/gameScores';

const getCurrentUserId = () => {
  try {
    return localStorage.getItem('devUserId')
      || localStorage.getItem('userId')
      || 'dev-user-1';
  } catch {
    return 'dev-user-1';
  }
};

const useArcadeGameScores = ({ gameId, componentLabel }) => {
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
  const [leaderboard, setLeaderboard] = useState({ top: [], recent: [] });

  const userId = useMemo(() => getCurrentUserId(), []);

  const loadLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const payload = await loadGameScoreBoard({
        gameId,
        limitTop: 20,
        limitRecent: 20,
        component: componentLabel,
      });
      setLeaderboard({
        top: Array.isArray(payload?.top) ? payload.top : [],
        recent: Array.isArray(payload?.recent) ? payload.recent : [],
      });
    } catch {
      setLeaderboard({ top: [], recent: [] });
    } finally {
      setLeaderboardLoading(false);
    }
  }, [componentLabel, gameId]);

  const loadScore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await loadGameScore({
        gameId,
        userId,
        component: componentLabel,
      });
      setScoreState({
        userId: payload?.userId || userId,
        highScore: Number(payload?.highScore || 0),
        lastScore: Number(payload?.lastScore || 0),
        updatedAt: payload?.updatedAt || null,
      });
    } catch (loadErr) {
      setError(loadErr);
    } finally {
      setLoading(false);
    }
    await loadLeaderboard();
  }, [componentLabel, gameId, loadLeaderboard, userId]);

  useEffect(() => {
    loadScore();
  }, [loadScore]);

  const saveScore = useCallback(async (score) => {
    const parsedScore = Math.max(0, Number(score) || 0);
    setSaving(true);
    setSaveError(null);
    try {
      const payload = await saveGameScore({
        gameId,
        score: parsedScore,
        userId,
        component: componentLabel,
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
  }, [componentLabel, gameId, loadLeaderboard, userId]);

  return {
    loading,
    error,
    saveError,
    saving,
    leaderboardLoading,
    scoreState,
    leaderboard,
    reloadScore: loadScore,
    saveScore,
  };
};

export default useArcadeGameScores;
