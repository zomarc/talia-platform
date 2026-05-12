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
 * @returns {Object} { data, loading, error, refetch, context }
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import queryTracker from '../../services/data/queryTracker';
import { SAIL_SELECT_EVENT } from '../../lib/eventBus';
import { REPORT_PANEL_PAUSE_EVENT, REPORT_REFRESH_EVENT } from '../../components/dockview/eventConstants';
import { normalizeGlobalDateRangeKey } from '../../lib/globalDateRange';

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

const buildRequestKey = (tableName, limit, filters) => (
  `${tableName || ''}|${String(limit || '')}|${stableStringify(filters || null)}`
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

const applyGlobalCriteria = (rows, context = null) => (
  applyRealSailingCriteria(applyGlobalDurationCriteria(applyGlobalDateCriteria(rows, context)))
);

const isPanelPaused = (panelInstanceId, panelComponentId) => {
  const state = window.__taliaPanelPauseState || {};
  if (panelInstanceId && Object.prototype.hasOwnProperty.call(state, panelInstanceId)) {
    return state[panelInstanceId] === true;
  }
  if (panelComponentId && Object.prototype.hasOwnProperty.call(state, panelComponentId)) {
    return state[panelComponentId] === true;
  }
  return false;
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
  cacheTtlMs = DEFAULT_CACHE_TTL_MS
}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [context, setContext] = useState(null);
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
  const hasCheckedContextRef = useRef(false);
  const lastIncludeNonRealRef = useRef(window.__taliaGlobalCriteria?.includeNonRealSailings === true);
  const pausedRef = useRef(isPanelPaused(panelInstanceId, panelComponentId));
  const pendingRefreshOnResumeRef = useRef(false);
  
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
  }, [contextMapper, tableName, limit, enabled, eventName, panelInstanceId, panelComponentId, fetchWithoutContext, cacheTtlMs]);

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  // Extract context from event and map to GraphQL filters - store in ref
  const extractFiltersRef = useRef(null);
  extractFiltersRef.current = (eventDetail) => {
    if (!contextMapperRef.current) {
      return null;
    }
    try {
      const mappedFilters = contextMapperRef.current(eventDetail);
      if (!mappedFilters || typeof mappedFilters !== 'object') {
        return null;
      }
      // Remove null/undefined values
      const cleanFilters = Object.fromEntries(
        Object.entries(mappedFilters).filter(([, v]) => v != null)
      );
      return Object.keys(cleanFilters).length > 0 ? cleanFilters : null;
    } catch (err) {
      console.error('[useTableDataWithContext] Error mapping context:', err);
      return null;
    }
  };

  // Fetch data from GraphQL
  const fetchDataRef = useRef(null);
  fetchDataRef.current = async (currentFilters = null, options = {}) => {
    if (pausedRef.current) {
      pendingRefreshOnResumeRef.current = true;
      return;
    }
    const forceFetch = options?.force === true;
    const bypassCache = options?.bypassCache === true;
    const effectiveFilters = {
      ...(currentFilters || {}),
      ...getServerGlobalFilters()
    };

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
      return;
    }

    // Check if filters actually changed - this is the key fix!
    const filtersKey = effectiveFilters ? JSON.stringify(effectiveFilters) : 'null';
    if (!forceFetch && lastFiltersRef.current === filtersKey) {
      // Filters haven't changed, skip fetch
      return;
    }

    if (!enabledRef.current) {
      setLoading(false);
      return;
    }

    fetchingRef.current = true;
    lastFiltersRef.current = filtersKey;
    setLoading(true);
    setError(null);

    const requestKey = buildRequestKey(tableNameRef.current, limitRef.current, effectiveFilters || null);
    const now = Date.now();
    const ttl = Number(cacheTtlMsRef.current || 0);
    if (!bypassCache && ttl > 0) {
      const cached = responseCache.get(requestKey);
      if (cached && cached.expiresAt > now) {
        rawDataRef.current = cached.data || [];
          setData(applyGlobalCriteria(rawDataRef.current, contextRef.current));
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
        query GetTableData($tableName: String!, $limit: Int, $filters: TableDataFilters) {
          tableData(tableName: $tableName, limit: $limit, filters: $filters)
        }
      `;

          const variables = {
            tableName: tableNameRef.current,
            limit: limitRef.current,
            filters: effectiveFilters || undefined
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
      console.log(`[useTableDataWithContext] Loaded ${loadedData.length} records from ${tableNameRef.current}`);
      if (pausedRef.current) {
        pendingRefreshOnResumeRef.current = true;
        return;
      }
      rawDataRef.current = loadedData || [];
      setData(applyGlobalCriteria(rawDataRef.current, contextRef.current));
    } catch (err) {
      console.error('[useTableDataWithContext] Error:', err);
      setError(err);
      rawDataRef.current = [];
      setData([]);
    } finally {
      setLoading(false);
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

  // Check for existing context on mount (from persisted events)
  useEffect(() => {
    if (!enabled || !eventName || hasCheckedContextRef.current) {
      return;
    }

    // Check for existing context from TestPage's latestEvent or window state
    const checkExistingContext = () => {
      try {
        const persistedStores = ['talia:test:lastEvent', 'talia:persisted:lastEvent'];
        for (const storageKey of persistedStores) {
          const persistedEventStr = localStorage.getItem(storageKey);
          if (!persistedEventStr) continue;
          try {
            const persistedEvent = JSON.parse(persistedEventStr);
            if (persistedEvent && persistedEvent.name === eventNameRef.current && persistedEvent.detail) {
              const newFilters = extractFiltersRef.current(persistedEvent.detail);
              if (newFilters) {
                console.log('[useTableDataWithContext] Found persisted context on mount:', newFilters);
                setContext(persistedEvent.detail);
                fetchDataRef.current(newFilters);
                hasCheckedContextRef.current = true;
                return;
              }
            }
          } catch (e) {
            console.warn('[useTableDataWithContext] Error parsing persisted event:', e);
          }
        }

        // Check TestPage's latestEvent (if available on window)
        const testPageEvent = window.latestEvent || null;
        if (testPageEvent && testPageEvent.name === eventNameRef.current && testPageEvent.detail) {
          const newFilters = extractFiltersRef.current(testPageEvent.detail);
          if (newFilters) {
            console.log('[useTableDataWithContext] Found window.latestEvent on mount:', newFilters);
            setContext(testPageEvent.detail);
            fetchDataRef.current(newFilters);
            hasCheckedContextRef.current = true;
            return;
          }
        }

        // Also check for lastSailSelectEvent (for sail events)
        if (eventNameRef.current === SAIL_SELECT_EVENT) {
          const lastSailEvent = window.lastSailSelectEvent || null;
          if (lastSailEvent && lastSailEvent.detail) {
            const normalizedDetail = normalizeSelectionContextDetail(lastSailEvent.detail);
            const newFilters = extractFiltersRef.current(normalizedDetail);
            if (newFilters) {
              console.log('[useTableDataWithContext] Found lastSailSelectEvent on mount:', newFilters);
              contextRef.current = normalizedDetail;
              setContext(normalizedDetail);
              fetchDataRef.current(newFilters);
              hasCheckedContextRef.current = true;
              return;
            }
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
      }
      hasCheckedContextRef.current = true;
    };

    checkExistingContext();
  }, [enabled, eventName]);

  // Listen to event bus - only re-run when eventName or enabled changes
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const currentEventName = eventNameRef.current;

    // Create handlers that use refs
    const handleEvent = (event) => {
      const eventDetail = event.detail;
      const normalizedDetail = normalizeSelectionContextDetail(eventDetail);
      if (pausedRef.current) {
        contextRef.current = normalizedDetail;
        setContext(normalizedDetail);
        pendingRefreshOnResumeRef.current = true;
        if (event.type === SAIL_SELECT_EVENT) {
          window.lastSailSelectEvent = { type: SAIL_SELECT_EVENT, detail: normalizedDetail };
        }
        return;
      }
      console.log(`[useTableDataWithContext] Received event: ${event.type}`, eventDetail);

      const newFilters = extractFiltersRef.current(normalizedDetail);
      contextRef.current = normalizedDetail;
      setContext(normalizedDetail);
      fetchDataRef.current(newFilters);
      
      // Store for context restoration (for sail events)
      if (event.type === SAIL_SELECT_EVENT) {
        window.lastSailSelectEvent = event;
      }
    };

    const handleClearEvent = () => {
      if (pausedRef.current) {
        contextRef.current = null;
        setContext(null);
        pendingRefreshOnResumeRef.current = true;
        if (currentEventName === SAIL_SELECT_EVENT) {
          window.lastSailSelectEvent = null;
        }
        return;
      }
      console.log(`[useTableDataWithContext] Received clear event`);
      contextRef.current = null;
      setContext(null);
      lastFiltersRef.current = null; // Reset filters so we can fetch again
      if (fetchWithoutContextRef.current) {
        fetchDataRef.current(null);
      } else {
        setLoading(false);
        setError(null);
        setData([]);
      }
      
      // Clear stored event
      if (currentEventName === SAIL_SELECT_EVENT) {
        window.lastSailSelectEvent = null;
      }
    };

    if (!currentEventName) {
      // If no event name, fetch without filters once (always fetch when eventName is null)
      if (!hasCheckedContextRef.current) {
        fetchDataRef.current(null);
        hasCheckedContextRef.current = true; // Mark as checked to prevent duplicate fetches
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

    // Initial fetch: if context was found, it was already fetched in checkExistingContext
    // If no context found, fetch without filters to show all data
    // But also check again here in case event was dispatched between context check and listener setup
    if (!hasCheckedContextRef.current) {
      // Re-check for context one more time (in case event was dispatched between checks)
      const recheckContext = () => {
        try {
          // Check window.latestEvent
          const testPageEvent = window.latestEvent || null;
          if (testPageEvent && testPageEvent.name === eventNameRef.current && testPageEvent.detail) {
            const newFilters = extractFiltersRef.current(testPageEvent.detail);
            if (newFilters) {
              console.log('[useTableDataWithContext] Found window.latestEvent in listener setup:', newFilters);
              setContext(testPageEvent.detail);
              fetchDataRef.current(newFilters);
              hasCheckedContextRef.current = true;
              return;
            }
          }
          // Check persisted app/test event
          const persistedStores = ['talia:test:lastEvent', 'talia:persisted:lastEvent'];
          for (const storageKey of persistedStores) {
            const persistedEventStr = localStorage.getItem(storageKey);
            if (!persistedEventStr) continue;
            try {
              const persistedEvent = JSON.parse(persistedEventStr);
              if (persistedEvent && persistedEvent.name === eventNameRef.current && persistedEvent.detail) {
                const newFilters = extractFiltersRef.current(persistedEvent.detail);
                if (newFilters) {
                  console.log('[useTableDataWithContext] Found persisted event in listener setup:', newFilters);
                  setContext(persistedEvent.detail);
                  fetchDataRef.current(newFilters);
                  hasCheckedContextRef.current = true;
                  return;
                }
              }
            } catch (e) {
              console.warn('[useTableDataWithContext] Error parsing persisted event:', e);
            }
          }
          // Check lastSailSelectEvent
          if (eventNameRef.current === SAIL_SELECT_EVENT) {
            const lastSailEvent = window.lastSailSelectEvent || null;
            if (lastSailEvent && lastSailEvent.detail) {
              const normalizedDetail = normalizeSelectionContextDetail(lastSailEvent.detail);
              const newFilters = extractFiltersRef.current(normalizedDetail);
              if (newFilters) {
                console.log('[useTableDataWithContext] Found lastSailSelectEvent in listener setup:', newFilters);
                contextRef.current = normalizedDetail;
                setContext(normalizedDetail);
                fetchDataRef.current(newFilters);
                hasCheckedContextRef.current = true;
                return;
              }
            }
          }
        } catch (err) {
          console.warn('[useTableDataWithContext] Error rechecking context:', err);
        }
        // No context found
        if (fetchWithoutContextRef.current) {
          fetchDataRef.current(null);
        } else {
          setLoading(false);
          setError(null);
          setData([]);
        }
        hasCheckedContextRef.current = true;
      };
      recheckContext();
    }

    return () => {
      // Cleanup listeners on unmount or when dependencies change
      eventNames.forEach(name => {
        window.removeEventListener(name, handleEvent);
        const clearEventName = name.replace('.select', '.clear').replace('.select', '.clear');
        if (clearEventName !== name) {
          window.removeEventListener(clearEventName, handleClearEvent);
        }
      });
      // Reset filters on cleanup so remount can fetch fresh
      lastFiltersRef.current = null;
      hasCheckedContextRef.current = false;
    };
  }, [eventName, enabled, fetchWithoutContext]); // Only re-run if eventName/enabled behavior changes

  // Global criteria handling:
  // - Date/duration apply immediately client-side on current dataset.
  // - includeNonRealSailings triggers server re-fetch because it's enforced in GraphQL.
  useEffect(() => {
    const handleGlobalCriteriaChange = (event) => {
      if (pausedRef.current) {
        pendingRefreshOnResumeRef.current = true;
        return;
      }
      setData(applyGlobalCriteria(rawDataRef.current, contextRef.current));

      const includeNonRealNext = event?.detail?.includeNonRealSailings === true;

      if (PUBLISHED_RATES_TABLES_SERVER_DATE_BOUNDS.has(tableNameRef.current)) {
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
      if (pausedRef.current) {
        pendingRefreshOnResumeRef.current = true;
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
    const handlePauseChanged = (event) => {
      const detail = event?.detail || {};
      const targetPanelId = detail.panelId || null;
      const targetPanelComponent = detail.panelComponent || null;
      const thisInstance = panelInstanceIdRef.current;
      const thisComponent = panelComponentIdRef.current;
      const isMatch = (
        (thisInstance && targetPanelId === thisInstance) ||
        (thisComponent && targetPanelComponent === thisComponent)
      );
      if (!isMatch) return;
      const nextPaused = detail.paused === true;
      pausedRef.current = nextPaused;
      if (!nextPaused && pendingRefreshOnResumeRef.current) {
        pendingRefreshOnResumeRef.current = false;
        lastFiltersRef.current = null;
        const currentFilters = contextRef.current ? extractFiltersRef.current(contextRef.current) : null;
        fetchDataRef.current(currentFilters, { force: true, bypassCache: true });
      }
    };
    window.addEventListener(REPORT_PANEL_PAUSE_EVENT, handlePauseChanged);
    return () => window.removeEventListener(REPORT_PANEL_PAUSE_EVENT, handlePauseChanged);
  }, []);

  const refetch = useCallback(() => {
    if (pausedRef.current) {
      pendingRefreshOnResumeRef.current = true;
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
    context
  };
};

export default useTableDataWithContext;
