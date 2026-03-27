import React from 'react';
import PongPresenter from './PongPresenter';
import useArcadeGameScores from '../../shared/games/useArcadeGameScores';
import { useTheme } from '../../../contexts/ThemeContext';

const GAME_ID = 'pong';

const PongContainer = ({ panelInstanceId = null }) => {
  const { gameSoundEnabled } = useTheme();
  const {
    loading,
    error,
    saveError,
    saving,
    leaderboardLoading,
    scoreState,
    leaderboard,
    reloadScore,
    saveScore,
  } = useArcadeGameScores({
    gameId: GAME_ID,
    componentLabel: 'Pong',
  });

  return (
    <PongPresenter
      panelInstanceId={panelInstanceId}
      loading={loading}
      loadError={error}
      saveError={saveError}
      saving={saving}
      userId={scoreState.userId}
      gameId={GAME_ID}
      gameSoundEnabled={gameSoundEnabled}
      highScore={scoreState.highScore}
      lastScore={scoreState.lastScore}
      updatedAt={scoreState.updatedAt}
      onReloadScore={reloadScore}
      onSaveScore={saveScore}
      leaderboard={leaderboard}
      leaderboardLoading={leaderboardLoading}
    />
  );
};

export default PongContainer;
