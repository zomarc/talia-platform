export const filterRowsByGame = (rows, gameId) => {
  const list = Array.isArray(rows) ? rows : [];
  if (!gameId) return list;
  const normalizedGameId = String(gameId).toLowerCase();
  return list.filter((row) => String(row?.gameId || '').toLowerCase() === normalizedGameId);
};

export const getMaxHighScore = (rows) => {
  const list = Array.isArray(rows) ? rows : [];
  return list.reduce((maxValue, row) => Math.max(maxValue, Number(row?.highScore || 0)), 0);
};
