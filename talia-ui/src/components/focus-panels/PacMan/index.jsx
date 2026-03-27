import React from 'react';
import PacManPresenter from './PacManPresenter';
import useArcadeGameScores from '../../shared/games/useArcadeGameScores';
import { useTheme } from '../../../contexts/ThemeContext';

const GAME_ID = 'pac-man';

const PacManContainer = ({ panelInstanceId = null }) => {
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
    componentLabel: 'Pac-Man',
  });

  return (
    <PacManPresenter
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

export default PacManContainer;
