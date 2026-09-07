export const DATE_ROLES = {
  SAILING_INTERVAL: 'sailing_interval',
  RECORD_VALIDITY: 'record_validity',
  EVENT: 'event',
  LOAD: 'load',
};

const LOAD_DATE_COLUMNS = new Set([
  'created_at',
  'updated_at',
  'last_sync_at',
  'last_run_at',
  'last_refreshed_at',
  'imported_at',
]);

export const findIntervalPair = (dateColumns = []) => {
  for (const fromCol of dateColumns) {
    const toCol = fromCol.replace(/from/i, 'to');
    if (toCol !== fromCol && dateColumns.includes(toCol)) {
      return { intervalFrom: fromCol, intervalTo: toCol };
    }
  }
  return { intervalFrom: null, intervalTo: null };
};

export const inferDateRole = (dateColumns = []) => {
  if (!dateColumns.length) return DATE_ROLES.LOAD;
  if (dateColumns.every((column) => LOAD_DATE_COLUMNS.has(column))) return DATE_ROLES.LOAD;
  const { intervalFrom, intervalTo } = findIntervalPair(dateColumns);
  if (intervalFrom && intervalTo) {
    if (/^effective_from$/.test(intervalFrom) && !/sail/.test(intervalFrom)) {
      return DATE_ROLES.RECORD_VALIDITY;
    }
    return DATE_ROLES.SAILING_INTERVAL;
  }
  return DATE_ROLES.EVENT;
};

export const resolveDateProfile = (config = {}, tableName = '') => {
  const dateColumns = config.dateColumns || [];
  const inferredPair = findIntervalPair(dateColumns);
  const dateRole = config.dateRole || inferDateRole(dateColumns);
  const usesInterval = dateRole === DATE_ROLES.SAILING_INTERVAL || dateRole === DATE_ROLES.RECORD_VALIDITY;
  return {
    tableName,
    dateColumns,
    dateRole,
    intervalFrom: usesInterval ? (config.intervalFrom || inferredPair.intervalFrom) : null,
    intervalTo: usesInterval ? (config.intervalTo || inferredPair.intervalTo) : null,
    sailCoverage: config.sailCoverage === true,
  };
};
