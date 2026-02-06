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
 * @returns {Object} { data, loading, error, refetch, context }
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import queryTracker from '../../services/data/queryTracker';
import { SAIL_SELECT_EVENT } from '../../lib/eventBus';

const GRAPHQL_URL = '/api/graphql';

export const useTableDataWithContext = ({
  tableName,
  eventName,
  contextMapper,
  limit = 1000,
  enabled = true
}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [context, setContext] = useState(null);
  
  // Use refs to prevent infinite loops and store latest values
  const fetchingRef = useRef(false);
  const lastFiltersRef = useRef(null);
  const pendingRef = useRef({ hasPending: false, filters: null });
  const contextMapperRef = useRef(contextMapper);
  const tableNameRef = useRef(tableName);
  const limitRef = useRef(limit);
  const enabledRef = useRef(enabled);
  const eventNameRef = useRef(eventName);
  const hasCheckedContextRef = useRef(false);
  
  // Keep refs up to date
  useEffect(() => {
    contextMapperRef.current = contextMapper;
    tableNameRef.current = tableName;
    limitRef.current = limit;
    enabledRef.current = enabled;
    eventNameRef.current = eventName;
  }, [contextMapper, tableName, limit, enabled, eventName]);

  // Extract context from event and map to GraphQL filters - store in ref
  const extractFiltersRef = useRef(null);
  extractFiltersRef.current = (eventDetail) => {
    if (!contextMapperRef.current) {
      return null;
    }
    try {
      const mappedFilters = contextMapperRef.current(eventDetail);
      // Remove null/undefined values
      const cleanFilters = Object.fromEntries(
        Object.entries(mappedFilters).filter(([_, v]) => v != null)
      );
      return Object.keys(cleanFilters).length > 0 ? cleanFilters : null;
    } catch (err) {
      console.error('[useTableDataWithContext] Error mapping context:', err);
      return null;
    }
  };

  // Fetch data from GraphQL
  const fetchDataRef = useRef(null);
  fetchDataRef.current = async (currentFilters = null) => {
    // Prevent concurrent fetches
    if (fetchingRef.current) {
      pendingRef.current = { hasPending: true, filters: currentFilters };
      return;
    }

    // Check if filters actually changed - this is the key fix!
    const filtersKey = currentFilters ? JSON.stringify(currentFilters) : 'null';
    if (lastFiltersRef.current === filtersKey) {
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

    let trackQueryFn = null;

    try {
      const query = `
        query GetTableData($tableName: String!, $limit: Int, $filters: TableDataFilters) {
          tableData(tableName: $tableName, limit: $limit, filters: $filters)
        }
      `;

      const variables = {
        tableName: tableNameRef.current,
        limit: limitRef.current,
        filters: currentFilters || undefined
      };

      console.log(`[useTableDataWithContext] Fetching ${tableNameRef.current}`, currentFilters ? `with filters: ${JSON.stringify(currentFilters)}` : 'without filters');

      // Track query for InformationPanel
      trackQueryFn = queryTracker.trackQuery({
        query,
        variables,
        component: tableNameRef.current.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), // Convert table_name to Table Name
        purpose: `Fetch ${tableNameRef.current} data`
      });

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
      console.log(`[useTableDataWithContext] Loaded ${loadedData.length} records from ${tableNameRef.current}`);

      // Complete query tracking
      if (trackQueryFn) {
        trackQueryFn({ data: loadedData });
      }

      setData(loadedData);
    } catch (err) {
      console.error('[useTableDataWithContext] Error:', err);
      // Track error in query tracker
      if (trackQueryFn) {
        trackQueryFn({ error: err });
      }
      setError(err);
      setData([]);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
      if (pendingRef.current.hasPending) {
        const nextFilters = pendingRef.current.filters;
        pendingRef.current = { hasPending: false, filters: null };
        // Trigger the latest pending fetch (if any)
        fetchDataRef.current(nextFilters);
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
            const newFilters = extractFiltersRef.current(lastSailEvent.detail);
            if (newFilters) {
              console.log('[useTableDataWithContext] Found lastSailSelectEvent on mount:', newFilters);
              setContext(lastSailEvent.detail);
              fetchDataRef.current(newFilters);
              hasCheckedContextRef.current = true;
              return;
            }
          }
        }
      } catch (err) {
        console.warn('[useTableDataWithContext] Error checking existing context:', err);
      }
      // Mark as checked even if no context found - event listener will handle initial fetch
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
      console.log(`[useTableDataWithContext] Received event: ${event.type}`, eventDetail);

      const newFilters = extractFiltersRef.current(eventDetail);
      setContext(eventDetail);
      fetchDataRef.current(newFilters);
      
      // Store for context restoration (for sail events)
      if (event.type === SAIL_SELECT_EVENT) {
        window.lastSailSelectEvent = event;
      }
    };

    const handleClearEvent = () => {
      console.log(`[useTableDataWithContext] Received clear event`);
      setContext(null);
      lastFiltersRef.current = null; // Reset filters so we can fetch again
      fetchDataRef.current(null);
      
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
              const newFilters = extractFiltersRef.current(lastSailEvent.detail);
              if (newFilters) {
                console.log('[useTableDataWithContext] Found lastSailSelectEvent in listener setup:', newFilters);
                setContext(lastSailEvent.detail);
                fetchDataRef.current(newFilters);
                hasCheckedContextRef.current = true;
                return;
              }
            }
          }
        } catch (err) {
          console.warn('[useTableDataWithContext] Error rechecking context:', err);
        }
        // No context found, fetch without filters
        fetchDataRef.current(null);
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
  }, [eventName, enabled]); // Only re-run if eventName or enabled changes

  const refetch = useCallback(() => {
    const currentFilters = context ? extractFiltersRef.current(context) : null;
    fetchDataRef.current(currentFilters);
  }, [context]);

  return {
    data,
    loading,
    error,
    refetch,
    context
  };
};

export default useTableDataWithContext;
