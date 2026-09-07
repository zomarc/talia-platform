import { getTableSource } from '../config/tableSources.js';
import { DATE_ROLES, resolveDateProfile } from './integrationDateProfile.js';

const dayMs = 1000 * 60 * 60 * 24;
const OPEN_ENDED_YEAR = 2090;

export const toTimestamp = (value) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

export const isOpenEndedDate = (value) => {
  const timestamp = toTimestamp(value);
  if (timestamp == null) return false;
  return new Date(timestamp).getUTCFullYear() >= OPEN_ENDED_YEAR;
};

const getSpanDays = (startTs, endTs) => {
  if (startTs == null || endTs == null) return null;
  return Math.max(0, Math.round((endTs - startTs) / dayMs) + 1);
};

const overlapCoverage = (expectedStartTs, expectedEndTs, actualStartTs, actualEndTs) => {
  if (expectedStartTs == null || expectedEndTs == null || actualStartTs == null || actualEndTs == null) {
    return { coverageRatio: null, overlapDays: null };
  }
  const expectedSpan = Math.max(expectedEndTs - expectedStartTs, dayMs);
  const overlapStart = Math.max(expectedStartTs, actualStartTs);
  const overlapEnd = Math.min(expectedEndTs, actualEndTs);
  const overlapSpan = Math.max(0, overlapEnd - overlapStart);
  return {
    coverageRatio: Math.min(1, overlapSpan / expectedSpan),
    overlapDays: Math.round(overlapSpan / dayMs) + (overlapSpan > 0 ? 1 : 0),
  };
};

const formatLag = (lagDaysRaw) => {
  if (lagDaysRaw == null) return 'N/A';
  if (lagDaysRaw <= -0.1) return `${Math.abs(lagDaysRaw).toFixed(1)}d ahead`;
  if (lagDaysRaw > 0.1) return `${lagDaysRaw.toFixed(1)}d behind`;
  return 'On time';
};

export const computeIntegrationHealth = (table, configuredRange) => {
  const tableConfig = getTableSource(table?.tableName);
  const profile = resolveDateProfile({
    ...tableConfig,
    dateRole: table?.dateRole || tableConfig.dateRole,
    sailCoverage: tableConfig.sailCoverage,
  }, table?.tableName);
  const coverage = table?.coverage || {};
  const expectedRange = configuredRange || table?.dateRange || null;
  const actualRange = table?.actualDataRange || null;
  const expectedStartTs = toTimestamp(expectedRange?.min);
  const expectedEndTs = toTimestamp(expectedRange?.max);
  const actualStartTs = toTimestamp(actualRange?.min);
  const actualEndTs = toTimestamp(actualRange?.max);
  const todayTs = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const usesFeedFreshness = profile.dateRole === DATE_ROLES.SAILING_INTERVAL
    || profile.dateRole === DATE_ROLES.RECORD_VALIDITY
    || profile.dateRole === DATE_ROLES.LOAD;
  const freshnessClock = usesFeedFreshness ? 'last_sync' : 'latest_data';
  const freshnessValue = usesFeedFreshness
    ? (table?.lastSync || table?.latestAvailableData)
    : table?.latestAvailableData;
  const freshnessTargetTs = usesFeedFreshness
    ? todayTs
    : (expectedEndTs == null ? null : Math.min(expectedEndTs, todayTs));
  const currentTs = toTimestamp(freshnessValue);
  const windowOverlap = overlapCoverage(expectedStartTs, expectedEndTs, actualStartTs, actualEndTs);
  const openEnded = coverage.openEnded === true || isOpenEndedDate(actualRange?.max);

  let coverageRatio = windowOverlap.coverageRatio;
  let coverageKind = 'window';
  if (coverage.sailCoveragePct != null) {
    coverageRatio = coverage.sailCoveragePct / 100;
    coverageKind = 'sails';
  } else if (usesFeedFreshness && coverage.rowCoveragePct != null && windowOverlap.coverageRatio == null) {
    coverageRatio = coverage.rowCoveragePct / 100;
    coverageKind = 'rows';
  }

  const coveragePct = coverageRatio != null ? Math.round(coverageRatio * 100) : null;
  let lagDaysRaw = freshnessTargetTs != null && currentTs != null
    ? (freshnessTargetTs - currentTs) / dayMs
    : null;
  if (usesFeedFreshness && currentTs != null && freshnessTargetTs != null) {
    const currentDay = new Date(currentTs).toISOString().slice(0, 10);
    const targetDay = new Date(freshnessTargetTs).toISOString().slice(0, 10);
    if (currentDay === targetDay) lagDaysRaw = 0;
  }
  const lagLabel = formatLag(lagDaysRaw);
  const variant = (coverageRatio == null && lagDaysRaw == null)
    ? 'unknown'
    : (coverageRatio != null && coverageRatio < 0.75) || (lagDaysRaw != null && lagDaysRaw > 7)
      ? 'mismatch'
      : (coverageRatio != null && coverageRatio < 0.9) || (lagDaysRaw != null && lagDaysRaw > 3)
        ? 'warn'
        : 'ok';
  const label = variant === 'ok' ? 'OK' : variant === 'warn' ? 'Warn' : variant === 'mismatch' ? 'Mismatch' : 'Unknown';
  const qualityLabel = variant === 'ok' ? 'Good'
    : variant === 'warn' ? 'Partial'
      : variant === 'mismatch' ? 'Limited'
        : 'Unknown';

  const coveragePhrase = coveragePct == null
    ? 'N/A'
    : coverageKind === 'sails'
      ? `Applies to ${coveragePct}% of sailings`
      : profile.dateRole === DATE_ROLES.SAILING_INTERVAL
        ? `Applies to ${coveragePct}% of window`
        : profile.dateRole === DATE_ROLES.RECORD_VALIDITY
          ? `Current ${coveragePct}%`
          : `Cov ${coveragePct}%`;

  const gridMeta = coveragePct == null
    ? `N/A | ${lagLabel}`
    : profile.dateRole === DATE_ROLES.SAILING_INTERVAL
      ? `Applies ${coveragePct}% ${coverageKind === 'sails' ? 'sails' : 'window'}${openEnded ? ', open-ended' : ''} | ${lagLabel}`
      : profile.dateRole === DATE_ROLES.RECORD_VALIDITY
        ? `Current ${coveragePct}% | ${lagLabel}`
        : `Cov ${coveragePct}% | ${lagLabel}`;

  return {
    dateRole: profile.dateRole,
    profile,
    coverage,
    expectedRange,
    actualRange,
    expectedStartTs,
    expectedEndTs,
    actualStartTs,
    actualEndTs,
    requestedSpanDays: getSpanDays(expectedStartTs, expectedEndTs),
    loadedSpanDays: getSpanDays(actualStartTs, actualEndTs),
    overlapDays: windowOverlap.overlapDays,
    coveragePct,
    coverageKind,
    coveragePhrase,
    overlappingRows: coverage.overlappingRows ?? null,
    rowCoveragePct: coverage.rowCoveragePct ?? null,
    coveredSails: coverage.coveredSails ?? null,
    totalSails: coverage.totalSails ?? null,
    sailCoveragePct: coverage.sailCoveragePct ?? null,
    openEnded,
    lagDaysRaw,
    lagLabel,
    freshnessClock,
    freshnessValue,
    freshnessTargetTs,
    variant,
    label,
    qualityLabel,
    qualityState: variant,
    freshnessState: lagDaysRaw == null
      ? 'unknown'
      : lagDaysRaw <= 1
        ? 'ok'
        : lagDaysRaw <= 7
          ? 'warn'
          : 'mismatch',
    freshnessAlignmentPct: lagDaysRaw == null
      ? 0
      : lagDaysRaw <= 0
        ? 100
        : Math.max(0, 100 - Math.min(100, Math.round(lagDaysRaw * (100 / 60)))),
    beforeRequestedDays: (expectedStartTs != null && actualStartTs != null && actualStartTs < expectedStartTs)
      ? Math.round((expectedStartTs - actualStartTs) / dayMs)
      : 0,
    afterRequestedDays: (expectedEndTs != null && actualEndTs != null && actualEndTs > expectedEndTs && !openEnded)
      ? Math.round((actualEndTs - expectedEndTs) / dayMs)
      : 0,
    gridMeta,
  };
};
