/**
 * useTableDataWithContext Hook
 * 
 * Reusable hook for fetching table data with server-side filtering based on event bus context.
 * Supports two-tier filtering:
 * - Tier 1: Server-side filters (from event bus context) - applied via GraphQL query
 * - Tier 2: Client-side filters (Tabulator header filters) - persist across context changes
 * 
 * @param {Object} options - Hook configuration
 * @param {string} options.tableName - Name of the table to query
 * @param {string|string[]} options.eventName - Event name(s) to listen to (e.g., SAIL_SELECT_EVENT)
 * @param {Function} options.contextMapper - Maps event detail to GraphQL filters object
 * @param {number} [options.limit=1000] - Maximum number of records to fetch
 * @param {boolean} [options.enabled=true] - Whether the hook is enabled
 * @param {boolean} [options.fetchWithoutContext=true] - Whether to auto-fetch when no event context is available
 * @param {number} [options.cacheTtlMs=15000] - Shared cache TTL for identical requests
 * @param {string[]} [options.columns] - Optional column projection (server allowlist)
 * @param {string|string[]} [options.requiredSources] - Framework source ids that must be YES before refresh
 * @returns {Object} { data, loading, error, refetch, context }
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import queryTracker from '../../services/data/queryTracker';
import { SAIL_SELECT_EVENT, SHIP_SELECT_EVENT } from '../../lib/eventBus';
import { REPORT_REFRESH_EVENT } from '../../components/dockview/eventConstants';
import { normalizeGlobalDateRangeKey } from '../../lib/globalDateRange';
import {
  ALL_DEPARTURE_MONTH_KEY,
  normalizeGlobalDepartureMonth,
  rowMatchesDepartureMonth,
} from '../../lib/globalDepartureMonth';
import { rowMatchesGlobalShip } from '../../lib/globalShipFilter';
import usePanelRefreshGate from '../usePanelRefreshGate';
import useReportPanelLoading from '../useReportPanelLoading';
import sourceAvailability, {
  DEFAULT_REQUIRED_SOURCES,
} from '../../services/sourceAvailabilityService';

const GRAPHQL_URL = '/api/graphql';
const DEFAULT_CACHE_TTL_MS = 15000;
const DASHBOARD_GLOBAL_CRITERIA_EVENT = 'talia:dashboard.globalCriteria';

/** Sail + departure window merged into GraphQL filters (bounded queries). */
const PUBLISHED_RATES_TABLES_SERVER_DATE_BOUNDS = new Set([
  'published_rates_changes',
  'published_rates_current_state'
]);
const inflightRequestCache = new Map();
const responseCache = new Map();

const stableStringify = (value) => {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const buildRequestKey = (tableName, limit, filters, columns = null) => (
  `${tableName || ''}|${String(limit || '')}|${stableStringify(filters || null)}|${stableStringify(columns || null)}`
);

const buildEffectiveFilters = (currentFilters, staticFilters) => ({
  ...(staticFilters || {}),
  ...(currentFilters || {}),
  ...getServerGlobalFilters(),
});

const buildEffectiveFiltersKey = (currentFilters, staticFilters) => {
  const effectiveFilters = buildEffectiveFilters(currentFilters, staticFilters);
  return effectiveFilters ? JSON.stringify(effectiveFilters) : 'null';
};

const mapContextToFilters = (context, contextMapper) => {
  if (!context || !contextMapper) return null;
  try {
    const mapped = contextMapper(context);
    if (!mapped || typeof mapped !== 'object') return null;
    const cleanFilters = Object.fromEntries(
      Object.entries(mapped).filter(([, v]) => v != null)
    );
    return Object.keys(cleanFilters).length > 0 ? cleanFilters : null;
  } catch {
    return null;
  }
};

const resolveExpectedFiltersKey = (context, contextMapper, fetchWithoutContext, staticFilters) => {
  const mapped = mapContextToFilters(context, contextMapper);
  if (mapped || fetchWithoutContext) {
    return buildEffectiveFiltersKey(mapped, staticFilters);
  }
  return null;
};

/** Stable key for the filters implied by an event context (for matching loaded data). */
export const buildContextFiltersKey = (context, contextMapper, staticFilters = null) => (
  resolveExpectedFiltersKey(context, contextMapper, true, staticFilters)
);

const getGlobalDateFilters = () => {
  const criteria = window.__taliaGlobalCriteria || null;
  if (!criteria || typeof criteria !== 'object') return null;
  const dateFrom = typeof criteria.dateFrom === 'string' ? criteria.dateFrom : null;
  const dateTo = typeof criteria.dateTo === 'string' ? criteria.dateTo : null;
  if (!dateFrom && !dateTo) return null;
  return {
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {})
  };
};

const getServerGlobalFilters = () => {
  const criteria = window.__taliaGlobalCriteria || null;
  if (!criteria || typeof criteria !== 'object') {
    return { include_non_real_sailings: false };
  }
  return {
    include_non_real_sailings: criteria.includeNonRealSailings === true
  };
};

const resolveSelectedSailCodeFromDetail = (detail) => {
  if (!detail) return null;
  if (typeof detail === 'string') {
    const normalized = detail.trim();
    return normalized || null;
  }
  if (typeof detail !== 'object') return null;
  const candidate = detail.sail_code || detail.Sail_Code || detail.row_data?.sail_code || detail.row_data?.Sail_Code || null;
  if (candidate == null) return null;
  const normalized = String(candidate).trim();
  return normalized || null;
};

export const resolveSelectedSailCode = (context, criteria = null) => {
  const fromContext = resolveSelectedSailCodeFromDetail(context);
  if (fromContext) return fromContext;
  const effectiveCriteria = criteria || null;
  const fromCriteria = resolveSelectedSailCodeFromDetail(effectiveCriteria?.selectedSailing?.detail || effectiveCriteria?.selectedSailing || effectiveCriteria?.selectedSailCode || null);
  return fromCriteria || null;
};

const normalizeSelectionContextDetail = (detail) => {
  if (!detail) return null;
  if (typeof detail === 'string') {
    const normalized = detail.trim();
    return normalized ? { sail_code: normalized } : null;
  }
  if (typeof detail !== 'object') return null;
  const sailCode = resolveSelectedSailCodeFromDetail(detail);
  if (!sailCode) return detail;
  if (detail.sail_code === sailCode) return detail;
  return {
    ...detail,
    sail_code: sailCode
  };
};

const DATE_FIELD_CANDIDATES = [
  'sail_date_from',
  'sail_date',
  'departure_date',
  'start_date',
  'from_date',
  'vacation_date',
  'master_voyage_departure_date'
];
const END_DATE_FIELD_CANDIDATES = [
  'sail_date_to',
  'end_date',
  'to_date',
  'return_date',
  'disembark_date',
  'master_voyage_end_date'
];
const DURATION_FIELD_CANDIDATES = [
  'sail_days',
  'sail_itinerary_night',
  'duration',
  'duration_days',
  'duration_nights',
  'nights',
  'night_count',
  'cruise_nights',
  'itinerary_duration',
  'itinerary_duration_nights',
  'sail_duration',
  'sail_duration_nights',
  'Duration',
  'sailing',
  'itinerary',
  'package_name'
];

const getRowDateValue = (row) => {
  if (!row || typeof row !== 'object') return null;
  for (const field of DATE_FIELD_CANDIDATES) {
    const value = row[field];
    if (!value) continue;
    const parsed = Date.parse(String(value));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const getRowDateValueFromCandidates = (row, candidates) => {
  if (!row || typeof row !== 'object') return null;
  for (const field of candidates) {
    const value = row[field];
    if (!value) continue;
    const parsed = Date.parse(String(value));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const getRowDateRange = (row) => {
  const startTs = getRowDateValueFromCandidates(row, DATE_FIELD_CANDIDATES);
  if (!Number.isFinite(startTs)) return null;
  const endCandidate = getRowDateValueFromCandidates(row, END_DATE_FIELD_CANDIDATES);
  return {
    startTs,
    endTs: Number.isFinite(endCandidate) ? endCandidate : startTs
  };
};

const getRangeModeFromCriteria = (criteria) => {
  if (!criteria || typeof criteria !== 'object') return 'future';
  if (criteria.rangeMode === 'future' || criteria.rangeMode === 'past') {
    return criteria.rangeMode;
  }
  const normalizedKey = normalizeGlobalDateRangeKey(criteria.rangeKey);
  if (normalizedKey.startsWith('-') || normalizedKey === 'all_past') return 'past';
  return 'future';
};

const getDurationSet = (durationKey) => {
  switch (durationKey) {
    case '7':
      return new Set([7]);
    case '14':
      return new Set([14]);
    case '7-14':
      return new Set([7, 14]);
    case '3':
      return new Set([3]);
    case '4':
      return new Set([4]);
    case '3-4':
      return new Set([3, 4]);
    default:
      return null;
  }
};

const getRowDurationValue = (row) => {
  if (!row || typeof row !== 'object') return null;
  for (const field of DURATION_FIELD_CANDIDATES) {
    const value = row[field];
    if (value == null || value === '') continue;
    const text = String(value);
    const explicitNightMatch = text.match(/(\d{1,2})\s*(n|night|nights)\b/i);
    const match = explicitNightMatch || text.match(/\d+/);
    const parsed = Number.parseInt(match?.[0] || '', 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const applyGlobalDateCriteria = (rows, context = null) => {
  // Explicit sail selection should always win over global date windows.
  if (resolveSelectedSailCode(context)) {
    return rows;
  }
  const criteria = window.__taliaGlobalCriteria || null;
  const globalDateFilters = getGlobalDateFilters();
  if (!globalDateFilters) return rows;

  const minTs = globalDateFilters.dateFrom ? Date.parse(`${globalDateFilters.dateFrom}T00:00:00Z`) : null;
  const maxTs = globalDateFilters.dateTo ? Date.parse(`${globalDateFilters.dateTo}T23:59:59Z`) : null;
  const hasMin = Number.isFinite(minTs);
  const hasMax = Number.isFinite(maxTs);
  if (!hasMin && !hasMax) return rows;
  const todayStartTs = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const todayEndTs = Date.parse(`${new Date().toISOString().slice(0, 10)}T23:59:59Z`);
  const rangeMode = getRangeModeFromCriteria(criteria);
  const includeInProgress = criteria?.includeInProgress === true && rangeMode === 'future';

  return (rows || []).filter((row) => {
    const rowTs = getRowDateValue(row);
    // Keep rows with no recognized date field to avoid over-filtering non-date datasets.
    if (!Number.isFinite(rowTs)) return true;
    const inWindow = (!hasMin || rowTs >= minTs) && (!hasMax || rowTs <= maxTs);
    if (inWindow) return true;
    if (!includeInProgress) return false;
    const rowRange = getRowDateRange(row);
    if (!rowRange) return false;
    return rowRange.startTs <= todayEndTs && rowRange.endTs >= todayStartTs;
  });
};

const applyGlobalDurationCriteria = (rows) => {
  const criteria = window.__taliaGlobalCriteria || null;
  const durationKey = typeof criteria?.durationKey === 'string' ? criteria.durationKey : 'all';
  const allowedDurations = getDurationSet(durationKey);
  if (!allowedDurations) return rows;

  return (rows || []).filter((row) => {
    const rowDuration = getRowDurationValue(row);
    // Keep rows with no recognized duration field to avoid over-filtering unrelated datasets.
    if (!Number.isFinite(rowDuration)) return true;
    return allowedDurations.has(rowDuration);
  });
};

const ACTIVE_FIELD_CANDIDATES = ['active', 'is_active', 'ACTIVE'];
const FAKE_FIELD_CANDIDATES = ['fake', 'is_fake', 'FAKE'];

const isExplicitNo = (value) => {
  if (value == null) return false;
  const normalized = String(value).trim().toUpperCase();
  return normalized === 'N' || normalized === 'NO' || normalized === 'FALSE' || normalized === '0';
};

const isExplicitYes = (value) => {
  if (value == null) return false;
  const normalized = String(value).trim().toUpperCase();
  return normalized === 'Y' || normalized === 'YES' || normalized === 'TRUE' || normalized === '1';
};

const getFieldValueFromCandidates = (row, candidates) => {
  if (!row || typeof row !== 'object') return undefined;
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      return row[key];
    }
  }
  return undefined;
};

const applyRealSailingCriteria = (rows) => {
  const criteria = window.__taliaGlobalCriteria || null;
  if (criteria?.includeNonRealSailings === true) return rows;

  return (rows || []).filter((row) => {
    const activeValue = getFieldValueFromCandidates(row, ACTIVE_FIELD_CANDIDATES);
    const fakeValue = getFieldValueFromCandidates(row, FAKE_FIELD_CANDIDATES);
    if (isExplicitNo(activeValue)) return false;
    if (isExplicitYes(fakeValue)) return false;
    return true;
  });
};

const sameRowRefs = (prev, next) => (
  Array.isArray(prev)
  && Array.isArray(next)
  && prev.length === next.length
  && prev.every((row, index) => row === next[index])
);

const applyGlobalDepartureMonthCriteria = (rows, context = null) => {
  // Explicit sail selection should always win over global month.
  if (resolveSelectedSailCode(context)) {
    return rows;
  }
  const criteria = window.__taliaGlobalCriteria || null;
  const monthKey = normalizeGlobalDepartureMonth(criteria?.departureMonth);
  if (monthKey === ALL_DEPARTURE_MONTH_KEY) return rows;
  return (rows || []).filter((row) => rowMatchesDepartureMonth(row, monthKey));
};

const applyGlobalShipCriteria = (rows, context = null, tableName = null) => {
  // Explicit sail selection should always win over global ship filter.
  if (resolveSelectedSailCode(context)) {
    return rows;
  }
  // Never filter the ship dimension itself — StatusBar / panels need the full list.
  if (tableName === 'ship') return rows;
  const criteria = window.__taliaGlobalCriteria || null;
  return (rows || []).filter((row) => rowMatchesGlobalShip(row, criteria?.shipCode));
};

const applyGlobalCriteria = (rows, context = null, tableName = null) => (
  applyGlobalShipCriteria(
    applyRealSailingCriteria(
      applyGlobalDurationCriteria(
        applyGlobalDepartureMonthCriteria(
          applyGlobalDateCriteria(rows, context),
          context
        )
      )
    ),
    context,
    tableName
  )
);

const BACKGROUND_FETCH_DELAY_MS = 75;

/**
 * Schedule a context-driven fetch.
 * Focused panel runs immediately (after a microtask so selection paint wins);
 * background panels defer slightly so the focused panel's network starts first.
 */
const scheduleContextFetch = (fetchFn, filters, options = null, panelInstanceId = null) => {
  const run = () => {
    fetchFn(filters, options || undefined);
  };
  const activeId = typeof window !== 'undefined' ? window.__taliaActivePanelId : null;
  const isFocused = Boolean(panelInstanceId && activeId && panelInstanceId === activeId);
  if (isFocused) {
    queueMicrotask(run);
    return;
  }
  window.setTimeout(run, BACKGROUND_FETCH_DELAY_MS);
};

export const useTableDataWithContext = ({
  tableName,
  eventName,
  contextMapper,
  panelInstanceId = null,
  panelComponentId = null,
  limit = 1000,
  enabled = true,
  fetchWithoutContext = true,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  filters: staticFilters = null,
  columns = null,
  requiredSources = DEFAULT_REQUIRED_SOURCES,
}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [context, setContext] = useState(null);
  const [loadedFiltersKey, setLoadedFiltersKey] = useState(null);
  const rawDataRef = useRef([]);
  const contextRef = useRef(null);
  
  // Use refs to prevent infinite loops and store latest values
  const fetchingRef = useRef(false);
  const lastFiltersRef = useRef(null);
  const pendingRef = useRef({ hasPending: false, filters: null, options: null });
  const contextMapperRef = useRef(contextMapper);
  const tableNameRef = useRef(tableName);
  const limitRef = useRef(limit);
  const enabledRef = useRef(enabled);
  const eventNameRef = useRef(eventName);
  const panelInstanceIdRef = useRef(panelInstanceId);
  const panelComponentIdRef = useRef(panelComponentId);
  const fetchWithoutContextRef = useRef(fetchWithoutContext);
  const cacheTtlMsRef = useRef(cacheTtlMs);
  const staticFiltersRef = useRef(staticFilters);
  const columnsRef = useRef(columns);
  const requiredSourcesRef = useRef(requiredSources);
  const hasCheckedContextRef = useRef(false);
  const lastIncludeNonRealRef = useRef(window.__taliaGlobalCriteria?.includeNonRealSailings === true);
  const { isPausedRef, shouldSkipRefresh, onResume } = usePanelRefreshGate(
    panelInstanceId,
    panelComponentId
  );
  const fetchGenerationRef = useRef(0);

  useReportPanelLoading(panelInstanceId, panelComponentId, loading);
  
  // Keep refs up to date
  useEffect(() => {
    contextMapperRef.current = contextMapper;
    tableNameRef.current = tableName;
    limitRef.current = limit;
    enabledRef.current = enabled;
    eventNameRef.current = eventName;
    panelInstanceIdRef.current = panelInstanceId;
    panelComponentIdRef.current = panelComponentId;
    fetchWithoutContextRef.current = fetchWithoutContext;
    cacheTtlMsRef.current = cacheTtlMs;
    staticFiltersRef.current = staticFilters;
    columnsRef.current = columns;
    requiredSourcesRef.current = requiredSources;
  }, [contextMapper, tableName, limit, enabled, eventName, panelInstanceId, panelComponentId, fetchWithoutContext, cacheTtlMs, staticFilters, columns, requiredSources]);

  const wasEnabledRef = useRef(enabled);

  // enabled gates network only — never tear down bus listeners (that remount race
  // re-hydrates from stale persisted sail.select and spins loading forever).
  useEffect(() => {
    const wasEnabled = wasEnabledRef.current;
    wasEnabledRef.current = enabled;
    if (!enabled) {
      setLoading(false);
      return;
    }
    // Refetch only on false → true when a selection is already on the bus.
    if (wasEnabled) return;
    const currentContext = contextRef.current;
    if (!currentContext && !fetchWithoutContextRef.current) return;
    const filters = currentContext ? extractFiltersRef.current(currentContext) : null;
    if (!filters && !fetchWithoutContextRef.current) {
      setLoading(false);
      return;
    }
    lastFiltersRef.current = null;
    fetchDataRef.current(filters);
  }, [enabled]);

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  // Extract context from event and map to GraphQL filters - store in ref
  const extractFiltersRef = useRef(null);
  extractFiltersRef.current = (eventDetail) => (
    mapContextToFilters(eventDetail, contextMapperRef.current)
  );

  const commitLoadedData = (rows, filtersKey) => {
    rawDataRef.current = rows || [];
    setData(applyGlobalCriteria(rawDataRef.current, contextRef.current, tableNameRef.current));
    setLoadedFiltersKey(filtersKey);
  };

  // Fetch data from GraphQL
  const fetchDataRef = useRef(null);
  fetchDataRef.current = async (currentFilters = null, options = {}) => {
    if (shouldSkipRefresh()) {
      return;
    }
    const forceFetch = options?.force === true;
    const bypassCache = options?.bypassCache === true;
    const effectiveFilters = buildEffectiveFilters(currentFilters, staticFiltersRef.current);
    const requestedFiltersKey = buildEffectiveFiltersKey(currentFilters, staticFiltersRef.current);
    const generation = ++fetchGenerationRef.current;

    const hasExplicitSailSelection = Boolean(
      resolveSelectedSailCode(currentFilters) || resolveSelectedSailCode(contextRef.current)
    );

    if (PUBLISHED_RATES_TABLES_SERVER_DATE_BOUNDS.has(tableNameRef.current) && !hasExplicitSailSelection) {
      const globalDates = getGlobalDateFilters();
      if (globalDates?.dateFrom && effectiveFilters.departure_date_from == null) {
        effectiveFilters.departure_date_from = globalDates.dateFrom;
      }
      if (globalDates?.dateTo && effectiveFilters.departure_date_to == null) {
        effectiveFilters.departure_date_to = globalDates.dateTo;
      }
    }

    // Prevent concurrent fetches
    if (fetchingRef.current) {
      pendingRef.current = { hasPending: true, filters: currentFilters, options };
      setLoading(true);
      return;
    }

    // Filters unchanged — reuse in-memory rows but still clear loading (event may have set it).
    if (!forceFetch && lastFiltersRef.current === requestedFiltersKey) {
      const expectedFiltersKey = resolveExpectedFiltersKey(
        contextRef.current,
        contextMapperRef.current,
        fetchWithoutContextRef.current,
        staticFiltersRef.current
      );
      if (expectedFiltersKey === requestedFiltersKey) {
        commitLoadedData(rawDataRef.current, requestedFiltersKey);
      }
      setLoading(false);
      setError(null);
      return;
    }

    if (!enabledRef.current) {
      setLoading(false);
      return;
    }

    // Selection-driven hooks must not fetch unfiltered when the mapper cannot
    // yet resolve filters (e.g. alloc waiting on sail_date_from).
    if (!currentFilters && !fetchWithoutContextRef.current) {
      setLoading(false);
      setError(null);
      rawDataRef.current = [];
      setData([]);
      setLoadedFiltersKey(null);
      lastFiltersRef.current = null;
      return;
    }

    // Framework source gate: YES → refresh, NO → fail immediately (no hang).
    const sources = requiredSourcesRef.current || DEFAULT_REQUIRED_SOURCES;
    if (!sourceAvailability.canRefresh(sources)) {
      setLoading(false);
      setError(new Error(
        sourceAvailability.getUnavailableMessage(sources)
        || 'Required data source unavailable — refresh skipped.'
      ));
      return;
    }

    fetchingRef.current = true;
    lastFiltersRef.current = requestedFiltersKey;
    setLoading(true);
    setError(null);

    const requestKey = buildRequestKey(
      tableNameRef.current,
      limitRef.current,
      effectiveFilters || null,
      columnsRef.current
    );
    const now = Date.now();
    const ttl = Number(cacheTtlMsRef.current || 0);
    if (!bypassCache && ttl > 0) {
      const cached = responseCache.get(requestKey);
      if (cached && cached.expiresAt > now) {
        commitLoadedData(cached.data || [], requestedFiltersKey);
        setLoading(false);
        setError(null);
        fetchingRef.current = false;
        return;
      }
    }

    try {
      let requestPromise = inflightRequestCache.get(requestKey);
      if (!requestPromise) {
        requestPromise = (async () => {
          let trackQueryFn = null;
          const query = `
        query GetTableData($tableName: String!, $limit: Int, $filters: TableDataFilters, $columns: [String!]) {
          tableData(tableName: $tableName, limit: $limit, filters: $filters, columns: $columns)
        }
      `;

          const columnsArg = Array.isArray(columnsRef.current) && columnsRef.current.length > 0
            ? columnsRef.current
            : undefined;
          const variables = {
            tableName: tableNameRef.current,
            limit: limitRef.current,
            filters: effectiveFilters || undefined,
            columns: columnsArg,
          };

          console.log(
            `[useTableDataWithContext] Fetching ${tableNameRef.current}`,
            effectiveFilters ? `with filters: ${JSON.stringify(effectiveFilters)}` : 'without filters'
          );

          // Track query for InformationPanel
          trackQueryFn = queryTracker.trackQuery({
            query,
            variables,
            component: tableNameRef.current.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), // Convert table_name to Table Name
            purpose: `Fetch ${tableNameRef.current} data`
          });

          try {
            const response = await fetch(GRAPHQL_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query, variables })
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.errors) {
              console.error('[useTableDataWithContext] GraphQL errors:', result.errors);
              throw new Error(result.errors[0].message);
            }

            const loadedData = result.data?.tableData || [];
            if (trackQueryFn) {
              trackQueryFn({ data: loadedData });
            }
            const currentTtl = Number(cacheTtlMsRef.current || 0);
            if (currentTtl > 0) {
              responseCache.set(requestKey, {
                data: loadedData,
                expiresAt: Date.now() + currentTtl
              });
            }
            return loadedData;
          } catch (error) {
            if (trackQueryFn) {
              trackQueryFn({ error });
            }
            throw error;
          } finally {
            inflightRequestCache.delete(requestKey);
          }
        })();
        inflightRequestCache.set(requestKey, requestPromise);
      }

      const loadedData = await requestPromise;
      const expectedFiltersKey = resolveExpectedFiltersKey(
        contextRef.current,
        contextMapperRef.current,
        fetchWithoutContextRef.current,
        staticFiltersRef.current
      );
      if (generation !== fetchGenerationRef.current || expectedFiltersKey !== requestedFiltersKey) {
        console.log(`[useTableDataWithContext] Ignoring stale ${tableNameRef.current} response`);
        return;
      }
      console.log(`[useTableDataWithContext] Loaded ${loadedData.length} records from ${tableNameRef.current}`);
      if (shouldSkipRefresh()) {
        return;
      }
      commitLoadedData(loadedData || [], requestedFiltersKey);
    } catch (err) {
      console.error('[useTableDataWithContext] Error:', err);
      setError(err);
      rawDataRef.current = [];
      setData([]);
      setLoadedFiltersKey(null);
    } finally {
      if (generation === fetchGenerationRef.current) {
        setLoading(false);
      }
      fetchingRef.current = false;
      if (pendingRef.current.hasPending) {
        const nextFilters = pendingRef.current.filters;
        const nextOptions = pendingRef.current.options || null;
        pendingRef.current = { hasPending: false, filters: null, options: null };
        // Trigger the latest pending fetch (if any)
        fetchDataRef.current(nextFilters, nextOptions);
      }
    }
  };

  const applyMountContext = (detail, sourceLabel) => {
    const normalizedDetail = eventNameRef.current === SAIL_SELECT_EVENT
      ? normalizeSelectionContextDetail(detail)
      : detail;
    const newFilters = extractFiltersRef.current(normalizedDetail);
    if (!normalizedDetail) return false;
    console.log(`[useTableDataWithContext] Found ${sourceLabel} on mount:`, newFilters);
    contextRef.current = normalizedDetail;
    setContext(normalizedDetail);
    if (newFilters || fetchWithoutContextRef.current) {
      fetchDataRef.current(newFilters);
    } else {
      setLoading(false);
      setError(null);
      setData([]);
      setLoadedFiltersKey(null);
    }
    return true;
  };

  // Check for existing context on mount (live bus first, then persisted disk)
  useEffect(() => {
    if (!eventName || hasCheckedContextRef.current) {
      return;
    }

    const checkExistingContext = () => {
      try {
        // Live message-bus state wins over disk — avoids remount restoring a stale sail.
        if (eventNameRef.current === SAIL_SELECT_EVENT) {
          const lastSailEvent = window.lastSailSelectEvent || null;
          if (lastSailEvent?.detail && applyMountContext(lastSailEvent.detail, 'lastSailSelectEvent')) {
            hasCheckedContextRef.current = true;
            return;
          }
        }

        if (eventNameRef.current === SHIP_SELECT_EVENT) {
          const lastShipEvent = window.lastShipSelectEvent || null;
          if (lastShipEvent?.detail && applyMountContext(lastShipEvent.detail, 'lastShipSelectEvent')) {
            hasCheckedContextRef.current = true;
            return;
          }
        }

        const testPageEvent = window.latestEvent || null;
        if (testPageEvent && testPageEvent.name === eventNameRef.current && testPageEvent.detail) {
          if (applyMountContext(testPageEvent.detail, 'window.latestEvent')) {
            hasCheckedContextRef.current = true;
            return;
          }
        }

        const persistedStores = ['talia:test:lastEvent', 'talia:persisted:lastEvent'];
        for (const storageKey of persistedStores) {
          const persistedEventStr = localStorage.getItem(storageKey);
          if (!persistedEventStr) continue;
          try {
            const persistedEvent = JSON.parse(persistedEventStr);
            if (persistedEvent && persistedEvent.name === eventNameRef.current && persistedEvent.detail) {
              if (applyMountContext(persistedEvent.detail, `persisted:${storageKey}`)) {
                hasCheckedContextRef.current = true;
                return;
              }
            }
          } catch (e) {
            console.warn('[useTableDataWithContext] Error parsing persisted event:', e);
          }
        }
      } catch (err) {
        console.warn('[useTableDataWithContext] Error checking existing context:', err);
      }
      // No prior context found.
      if (fetchWithoutContextRef.current) {
        fetchDataRef.current(null);
      } else {
        setLoading(false);
        setError(null);
        setData([]);
        setLoadedFiltersKey(null);
      }
      hasCheckedContextRef.current = true;
    };

    checkExistingContext();
  }, [eventName]);

  // Listen to event bus — stay subscribed even when enabled=false so selects are not dropped.
  useEffect(() => {
    const currentEventName = eventNameRef.current;

    // Create handlers that use refs
    const handleEvent = (event) => {
      const eventDetail = event.detail;
      const contextDetail = event.type === SHIP_SELECT_EVENT
        ? eventDetail
        : normalizeSelectionContextDetail(eventDetail);
      if (isPausedRef.current) {
        contextRef.current = contextDetail;
        setContext(contextDetail);
        shouldSkipRefresh();
        if (event.type === SAIL_SELECT_EVENT) {
          window.lastSailSelectEvent = { type: SAIL_SELECT_EVENT, detail: contextDetail };
        }
        if (event.type === SHIP_SELECT_EVENT) {
          window.lastShipSelectEvent = { type: SHIP_SELECT_EVENT, detail: eventDetail };
        }
        return;
      }
      console.log(`[useTableDataWithContext] Received event: ${event.type}`, eventDetail);

      const newFilters = extractFiltersRef.current(contextDetail);
      contextRef.current = contextDetail;
      setContext(contextDetail);
      if (newFilters || fetchWithoutContextRef.current) {
        setLoading(true);
        scheduleContextFetch(
          fetchDataRef.current,
          newFilters,
          null,
          panelInstanceIdRef.current
        );
      } else {
        // Mapper cannot resolve filters yet — keep selection, do not fetch unfiltered.
        setLoading(false);
        setError(null);
        rawDataRef.current = [];
        setData([]);
        setLoadedFiltersKey(null);
        lastFiltersRef.current = null;
      }

      if (event.type === SAIL_SELECT_EVENT) {
        window.lastSailSelectEvent = { type: SAIL_SELECT_EVENT, detail: contextDetail };
      }
      if (event.type === SHIP_SELECT_EVENT) {
        window.lastShipSelectEvent = { type: SHIP_SELECT_EVENT, detail: eventDetail };
      }
    };

    const handleClearEvent = () => {
      fetchGenerationRef.current += 1;
      if (isPausedRef.current) {
        contextRef.current = null;
        setContext(null);
        shouldSkipRefresh();
        if (currentEventName === SAIL_SELECT_EVENT) {
          window.lastSailSelectEvent = null;
        }
        if (currentEventName === SHIP_SELECT_EVENT) {
          window.lastShipSelectEvent = null;
        }
        return;
      }
      console.log(`[useTableDataWithContext] Received clear event`);
      contextRef.current = null;
      setContext(null);
      lastFiltersRef.current = null; // Reset filters so we can fetch again
      if (fetchWithoutContextRef.current) {
        setLoading(true);
        scheduleContextFetch(
          fetchDataRef.current,
          null,
          null,
          panelInstanceIdRef.current
        );
      } else {
        setLoading(false);
        setError(null);
        setData([]);
        setLoadedFiltersKey(null);
      }
      
      // Clear stored event
      if (currentEventName === SAIL_SELECT_EVENT) {
        window.lastSailSelectEvent = null;
      }
      if (currentEventName === SHIP_SELECT_EVENT) {
        window.lastShipSelectEvent = null;
      }
    };

    if (!currentEventName) {
      // If no event name, fetch with optional static filters once
      if (!hasCheckedContextRef.current) {
        fetchDataRef.current(staticFiltersRef.current);
        hasCheckedContextRef.current = true;
      }
      return;
    }

    const eventNames = Array.isArray(currentEventName) ? currentEventName : [currentEventName];

    // Listen to all specified events
    eventNames.forEach(name => {
      window.addEventListener(name, handleEvent);
      // Also listen to corresponding clear events
      const clearEventName = name.replace('.select', '.clear').replace('.select', '.clear');
      if (clearEventName !== name) {
        window.addEventListener(clearEventName, handleClearEvent);
      }
    });

    // Race cover: event may have landed between mount-hydration and listener attach.
    if (!hasCheckedContextRef.current) {
      if (eventNameRef.current === SAIL_SELECT_EVENT && window.lastSailSelectEvent?.detail) {
        applyMountContext(window.lastSailSelectEvent.detail, 'lastSailSelectEvent(listener)');
        hasCheckedContextRef.current = true;
      } else if (eventNameRef.current === SHIP_SELECT_EVENT && window.lastShipSelectEvent?.detail) {
        applyMountContext(window.lastShipSelectEvent.detail, 'lastShipSelectEvent(listener)');
        hasCheckedContextRef.current = true;
      } else if (fetchWithoutContextRef.current) {
        fetchDataRef.current(null);
        hasCheckedContextRef.current = true;
      } else {
        setLoading(false);
        setError(null);
        setData([]);
        setLoadedFiltersKey(null);
        hasCheckedContextRef.current = true;
      }
    }

    return () => {
      eventNames.forEach(name => {
        window.removeEventListener(name, handleEvent);
        const clearEventName = name.replace('.select', '.clear').replace('.select', '.clear');
        if (clearEventName !== name) {
          window.removeEventListener(clearEventName, handleClearEvent);
        }
      });
      lastFiltersRef.current = null;
      hasCheckedContextRef.current = false;
    };
  }, [eventName, fetchWithoutContext]);

  // Global criteria handling:
  // - Date/duration apply immediately client-side on current dataset.
  // - includeNonRealSailings triggers server re-fetch because it's enforced in GraphQL.
  useEffect(() => {
    const handleGlobalCriteriaChange = (event) => {
      if (shouldSkipRefresh()) {
        return;
      }
      // Re-apply client filters. Keep previous array identity when the visible
      // row set is unchanged — sail.select republishes criteria and must not
      // force every panel through replaceData (MSE scroll jump).
      setData((prev) => {
        const next = applyGlobalCriteria(rawDataRef.current, contextRef.current, tableNameRef.current);
        return sameRowRefs(prev, next) ? prev : next;
      });

      const includeNonRealNext = event?.detail?.includeNonRealSailings === true;

      if (PUBLISHED_RATES_TABLES_SERVER_DATE_BOUNDS.has(tableNameRef.current)) {
        // Sail selection used to republish criteria and force a refetch here.
        // Only refetch when the non-real flag actually changes (date bounds are
        // already applied inside fetchData from window.__taliaGlobalCriteria).
        if (includeNonRealNext === lastIncludeNonRealRef.current) {
          return;
        }
        lastIncludeNonRealRef.current = includeNonRealNext;
        lastFiltersRef.current = null;
        const currentContext = contextRef.current;
        const currentFilters = currentContext ? extractFiltersRef.current(currentContext) : null;
        fetchDataRef.current(currentFilters);
        return;
      }

      if (includeNonRealNext === lastIncludeNonRealRef.current) {
        return;
      }
      lastIncludeNonRealRef.current = includeNonRealNext;
      // Force a refetch so the backend non-real filter is applied/removed.
      lastFiltersRef.current = null;
      const currentContext = contextRef.current;
      const currentFilters = currentContext ? extractFiltersRef.current(currentContext) : null;
      fetchDataRef.current(currentFilters);
    };
    window.addEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, handleGlobalCriteriaChange);
    return () => window.removeEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, handleGlobalCriteriaChange);
  }, []);

  useEffect(() => {
    const handlePanelRefresh = (event) => {
      if (shouldSkipRefresh()) {
        return;
      }
      const targetPanel = event?.detail?.panelId;
      const targetInstance = event?.detail?.panelInstanceId;
      const targetComponent = event?.detail?.panelComponent;
      const scope = event?.detail?.scope;
      const thisInstance = panelInstanceIdRef.current;
      const thisComponent = panelComponentIdRef.current;
      const isGlobal = scope === 'all' || (!targetPanel && !targetInstance && !targetComponent);
      const isMatch = (
        (thisComponent && (targetPanel === thisComponent || targetComponent === thisComponent)) ||
        (thisInstance && targetInstance === thisInstance)
      );
      if (!isGlobal && !isMatch) return;
      const currentContext = contextRef.current;
      const currentFilters = currentContext ? extractFiltersRef.current(currentContext) : null;
      lastFiltersRef.current = null;
      fetchDataRef.current(currentFilters, { force: true, bypassCache: true });
    };
    window.addEventListener(REPORT_REFRESH_EVENT, handlePanelRefresh);
    return () => window.removeEventListener(REPORT_REFRESH_EVENT, handlePanelRefresh);
  }, []);

  useEffect(() => {
    const unsubscribe = onResume(() => {
      lastFiltersRef.current = null;
      const currentFilters = contextRef.current ? extractFiltersRef.current(contextRef.current) : null;
      fetchDataRef.current(currentFilters, { force: true, bypassCache: true });
    });
    return typeof unsubscribe === 'function' ? unsubscribe : undefined;
  }, [onResume]);


  const refetch = useCallback(() => {
    if (shouldSkipRefresh()) {
      return;
    }
    const currentContext = contextRef.current;
    const currentFilters = currentContext ? extractFiltersRef.current(currentContext) : null;
    lastFiltersRef.current = null;
    fetchDataRef.current(currentFilters, { force: true, bypassCache: true });
  }, []);

  return {
    data,
    loading,
    error,
    refetch,
    context,
    loadedFiltersKey,
  };
};

export default useTableDataWithContext;
