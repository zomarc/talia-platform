import { DATE_ROLES, getDateProfileForTable } from '../config/table-mappings.js';

const OPEN_ENDED_YEAR = 2090;
const LOAD_CANDIDATES = ['created_at', 'updated_at', 'last_sync_at', 'last_run_at'];

const toDateString = (value) => {
  if (value == null || value === '') return null;
  return String(value);
};

const yearOf = (value) => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).getUTCFullYear();
};

const isOpenEnded = (value) => {
  const year = yearOf(value);
  return year != null && year >= OPEN_ENDED_YEAR;
};

const emptyCoverage = (dateRole) => ({
  dateRole,
  overlappingRows: null,
  rowCoveragePct: null,
  coveredSails: null,
  totalSails: null,
  sailCoveragePct: null,
  openEnded: false,
});

const fetchColumnBound = async (client, tableName, column, ascending) => {
  const { data, error } = await client
    .from(tableName)
    .select(column)
    .not(column, 'is', null)
    .order(column, { ascending })
    .limit(1);
  if (error) return null;
  return toDateString(data?.[0]?.[column]);
};

const fetchReservationLinkedDateRange = async (client) => {
  const min = await fetchColumnBound(client, 'reservation', 'sail_from_date', true);
  const max = await fetchColumnBound(client, 'reservation', 'sail_from_date', false);
  if (min && max) return { min, max };
  return { min: null, max: null };
};

const fetchIntervalRange = async (client, tableName, intervalFrom, intervalTo) => {
  const min = await fetchColumnBound(client, tableName, intervalFrom, true);
  const max = intervalTo
    ? await fetchColumnBound(client, tableName, intervalTo, false)
    : await fetchColumnBound(client, tableName, intervalFrom, false);
  if (min && max) return { min, max };
  return { min: null, max: null };
};

const fetchFirstColumnRange = async (client, tableName, dateColumns) => {
  for (const dateCol of dateColumns) {
    const min = await fetchColumnBound(client, tableName, dateCol, true);
    const max = await fetchColumnBound(client, tableName, dateCol, false);
    if (min && max) return { min, max };
  }
  return { min: null, max: null };
};

const fetchLatestFromColumns = async (client, tableName, columns) => {
  for (const dateCol of columns) {
    const value = await fetchColumnBound(client, tableName, dateCol, false);
    if (value) return value;
  }
  return null;
};

const fetchOverlappingRows = async (client, tableName, intervalFrom, intervalTo, rangeMin, rangeMax) => {
  if (!intervalFrom || !rangeMin || !rangeMax) return null;
  let query = client
    .from(tableName)
    .select('*', { count: 'exact', head: true })
    .lte(intervalFrom, rangeMax);
  if (intervalTo) {
    query = query.or(`${intervalTo}.gte.${rangeMin},${intervalTo}.is.null`);
  }
  const { count, error } = await query;
  if (error) return null;
  return count ?? 0;
};

const fetchSailCoverage = async (client, tableName, intervalFrom, intervalTo, rangeMin, rangeMax) => {
  if (!intervalFrom || !rangeMin || !rangeMax) return null;
  const { data: sails, error: sailError } = await client
    .from('master_sail')
    .select('ship_code, sail_date_from')
    .not('sail_date_from', 'is', null)
    .gte('sail_date_from', rangeMin)
    .lte('sail_date_from', rangeMax);
  if (sailError || !Array.isArray(sails)) return null;

  const totalSails = sails.length;
  if (totalSails === 0) {
    return { coveredSails: 0, totalSails: 0, sailCoveragePct: null };
  }

  let linkQuery = client
    .from(tableName)
    .select(`ship_code, ${intervalFrom}${intervalTo ? `, ${intervalTo}` : ''}`)
    .lte(intervalFrom, rangeMax);
  if (intervalTo) {
    linkQuery = linkQuery.or(`${intervalTo}.gte.${rangeMin},${intervalTo}.is.null`);
  }
  const { data: links, error: linkError } = await linkQuery;
  if (linkError || !Array.isArray(links)) {
    return { coveredSails: null, totalSails, sailCoveragePct: null };
  }

  const byShip = new Map();
  for (const link of links) {
    const shipCode = link.ship_code;
    if (!shipCode) continue;
    const list = byShip.get(shipCode) || [];
    list.push(link);
    byShip.set(shipCode, list);
  }

  let coveredSails = 0;
  for (const sail of sails) {
    const candidates = byShip.get(sail.ship_code) || [];
    const sailDate = String(sail.sail_date_from);
    const matches = candidates.some((link) => {
      const from = String(link[intervalFrom] || '');
      const to = intervalTo ? link[intervalTo] : null;
      return from && from <= sailDate && (to == null || to === '' || String(to) >= sailDate);
    });
    if (matches) coveredSails += 1;
  }

  return {
    coveredSails,
    totalSails,
    sailCoveragePct: Math.round((100 * coveredSails) / totalSails),
  };
};

export const fetchTableDateFacts = async (client, {
  tableName,
  rowCount,
  configuredRange = null,
  includeSailCoverage = false,
} = {}) => {
  const profile = getDateProfileForTable(tableName);
  const empty = {
    actualDataRange: { min: null, max: null },
    latestAvailableData: null,
    dateRole: profile.dateRole,
    coverage: emptyCoverage(profile.dateRole),
  };

  if (!rowCount || rowCount <= 0) {
    return empty;
  }

  let actualDataRange = { min: null, max: null };
  if (tableName === 'reservation_promotion') {
    actualDataRange = await fetchReservationLinkedDateRange(client);
  } else if (profile.intervalFrom) {
    actualDataRange = await fetchIntervalRange(client, tableName, profile.intervalFrom, profile.intervalTo);
  } else {
    actualDataRange = await fetchFirstColumnRange(client, tableName, profile.dateColumns);
  }

  const usesFeedFreshness = profile.dateRole === DATE_ROLES.SAILING_INTERVAL
    || profile.dateRole === DATE_ROLES.RECORD_VALIDITY
    || profile.dateRole === DATE_ROLES.LOAD;

  let latestAvailableData = null;
  if (tableName === 'reservation_promotion') {
    latestAvailableData = actualDataRange.max;
  } else if (usesFeedFreshness) {
    latestAvailableData = await fetchLatestFromColumns(client, tableName, LOAD_CANDIDATES);
  } else {
    const eventCandidates = [];
    if (profile.dateColumns.includes('snapshot_date')) eventCandidates.push('snapshot_date');
    profile.dateColumns.forEach((column) => {
      if (column !== 'snapshot_date' && !eventCandidates.includes(column)) {
        eventCandidates.push(column);
      }
    });
    LOAD_CANDIDATES.forEach((column) => {
      if (!eventCandidates.includes(column)) eventCandidates.push(column);
    });
    latestAvailableData = await fetchLatestFromColumns(client, tableName, eventCandidates);
  }

  const coverage = emptyCoverage(profile.dateRole);
  coverage.openEnded = isOpenEnded(actualDataRange.max);

  const rangeMin = configuredRange?.min || null;
  const rangeMax = configuredRange?.max || null;
  if (profile.intervalFrom && rangeMin && rangeMax) {
    const overlappingRows = await fetchOverlappingRows(
      client,
      tableName,
      profile.intervalFrom,
      profile.intervalTo,
      rangeMin,
      rangeMax
    );
    if (overlappingRows != null) {
      coverage.overlappingRows = overlappingRows;
      coverage.rowCoveragePct = Math.round((100 * overlappingRows) / rowCount);
    }
    if (includeSailCoverage && profile.sailCoverage) {
      const sailCoverage = await fetchSailCoverage(
        client,
        tableName,
        profile.intervalFrom,
        profile.intervalTo,
        rangeMin,
        rangeMax
      );
      if (sailCoverage) {
        coverage.coveredSails = sailCoverage.coveredSails;
        coverage.totalSails = sailCoverage.totalSails;
        coverage.sailCoveragePct = sailCoverage.sailCoveragePct;
      }
    }
  }

  return {
    actualDataRange,
    latestAvailableData,
    dateRole: profile.dateRole,
    coverage,
  };
};

export { DATE_ROLES };
