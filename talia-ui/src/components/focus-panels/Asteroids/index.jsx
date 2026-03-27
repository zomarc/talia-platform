import React from 'react';
import AsteroidsPresenter from './AsteroidsPresenter';
import useArcadeGameScores from '../../shared/games/useArcadeGameScores';
import { useTheme } from '../../../contexts/ThemeContext';

const GAME_ID = 'asteroids';

const AsteroidsContainer = ({ panelInstanceId = null }) => {
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
    componentLabel: 'Asteroids',
  });

  return (
    <AsteroidsPresenter
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

export default AsteroidsContainer;
