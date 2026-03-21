import { trackedFetchGraphql } from './trackedGraphql';
import { saveUserProfileState } from './userProfileState';

const GAME_SCORE_QUERY = `
  query GameScore($gameId: String!, $userId: String) {
    gameScore(gameId: $gameId, userId: $userId) {
      gameId
      userId
      highScore
      lastScore
      updatedAt
    }
  }
`;

const SAVE_GAME_SCORE_MUTATION = `
  mutation SaveGameScore($gameId: String!, $score: Int!, $userId: String) {
    saveGameScore(gameId: $gameId, score: $score, userId: $userId) {
      gameId
      userId
      highScore
      lastScore
      updatedAt
    }
  }
`;

const GAME_SCORE_BOARD_QUERY = `
  query GameScoreBoard($gameId: String, $limitTop: Int, $limitRecent: Int) {
    gameScoreBoard(gameId: $gameId, limitTop: $limitTop, limitRecent: $limitRecent) {
      top {
        gameId
        userId
        highScore
        lastScore
        updatedAt
      }
      recent {
        gameId
        userId
        highScore
        lastScore
        updatedAt
      }
    }
  }
`;

const buildCompactScoreSnapshot = ({ gameId, board }) => {
  const safeBoard = board && typeof board === 'object' ? board : {};
  const mapEntries = (rows) => (Array.isArray(rows) ? rows : [])
    .slice(0, 5)
    .map((row) => ({
      gameId: row?.gameId || '',
      userId: row?.userId || '',
      highScore: Number(row?.highScore || 0),
      lastScore: Number(row?.lastScore || 0),
      updatedAt: row?.updatedAt || null,
    }));
  return {
    gameId: gameId || null,
    top: mapEntries(safeBoard.top),
    recent: mapEntries(safeBoard.recent),
    updatedAt: new Date().toISOString(),
  };
};

export const loadGameScore = async ({ gameId, userId, component = 'Game' }) => {
  const data = await trackedFetchGraphql({
    query: GAME_SCORE_QUERY,
    variables: { gameId, userId },
    component,
    purpose: `Load ${gameId} score for ${userId}`,
    tableName: 'config_setting',
  });
  return data?.gameScore || null;
};

export const saveGameScore = async ({ gameId, score, userId, component = 'Game' }) => {
  const data = await trackedFetchGraphql({
    query: SAVE_GAME_SCORE_MUTATION,
    variables: { gameId, score, userId },
    component,
    purpose: `Save ${gameId} score for ${userId}`,
    tableName: 'config_setting',
  });
  return data?.saveGameScore || null;
};

export const loadGameScoreBoard = async ({
  gameId = null,
  limitTop = 5,
  limitRecent = 5,
  component = 'Game'
} = {}) => {
  const data = await trackedFetchGraphql({
    query: GAME_SCORE_BOARD_QUERY,
    variables: { gameId, limitTop, limitRecent },
    component,
    purpose: gameId ? `Load score board for ${gameId}` : 'Load score board for all games',
    tableName: 'config_setting',
  });
  const board = data?.gameScoreBoard || { top: [], recent: [] };
  saveUserProfileState({
    patch: {
      lastHighScores: buildCompactScoreSnapshot({ gameId, board }),
    },
    component,
  }).catch(() => {
    // best effort only
  });
  return board;
};

