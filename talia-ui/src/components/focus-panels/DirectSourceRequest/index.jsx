/**
 * Direct Source Request Container Component
 * 
 * Queries external GraphQL endpoints directly based on the current persisted event context.
 * This component displays real-time data from the Celestyal B2B GraphQL API.
 * 
 * Source: https://thaliatest.b2b.celestyal.com:3000/graphql
 * Query: availableVoyages
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import DirectSourceRequestPresenter from './DirectSourceRequestPresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';
import { SAIL_SELECT_EVENT } from '../../../lib/eventBus';
import { trackedFetchGraphql } from '../../../services/data/trackedGraphql';
import {
  DIRECT_B2B_AVAILABILITY_QUERY,
  DIRECT_B2B_DEFAULT_ENDPOINT,
  DIRECT_B2B_FAIL_FAST_MS,
  DIRECT_B2B_SOURCE_NAMES,
  fetchDirectB2bAvailability,
} from '../../../lib/directB2bClient';

const DEFAULT_GRAPHQL_ENDPOINT = DIRECT_B2B_DEFAULT_ENDPOINT;

const DATA_SOURCE_QUERY = `
  query DirectSourceDataSources {
    dataSources {
      sourceName
      displayName
      connectionConfig
    }
  }
`;

const LOCAL_PARITY_QUERY = `
  query DirectSourceParity($sailCode: String!) {
    tableData(tableName: "cabin_availability", limit: 5000, filters: { sail_code: $sailCode })
  }
`;

// Default query template - availableVoyages
// Note: The Celestyal B2B API expects DateTime type for effectiveDate and Date type for date ranges
const buildQueryKey = (variables) => {
  if (!variables) return null;
  const ctx = variables._context || {};
  if (ctx.testMode) {
    return `test|${variables.startDateFrom || ''}|${variables.startDateTo || ''}|${variables.effectiveDate || ''}`;
  }
  return [
    ctx.sailCode || '',
    variables.startDateFrom || '',
    variables.startDateTo || '',
    ctx.source || 'default',
  ].join('|');
};

const buildPersistedEventKey = (event) => {
  if (!event?.detail) return null;
  const detail = event.detail;
  const rowData = detail.row_data || detail;
  const sailCode = rowData.sail_code || rowData.Sail_Code || detail.sail_code || null;
  const sailDate =
    rowData.sail_date_from
    || rowData.sail_date
    || rowData.sailDate
    || rowData.depart
    || rowData.departure_date
    || rowData.Sail_Date_From
    || null;
  return `${sailCode || ''}|${sailDate || ''}`;
};

const DEFAULT_QUERY = DIRECT_B2B_AVAILABILITY_QUERY;

const DirectSourceRequestContainer = ({ panelInstanceId, panelComponentId }) => {

  // Get today's date in ISO format for defaults
  const getTodayISO = () => new Date().toISOString().split('T')[0];
  const toISODate = (date) => new Date(date).toISOString().split('T')[0];
  const shiftDate = (date, days) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  };
  const getDefaultEndDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 28); // 4 weeks
    return date.toISOString().split('T')[0];
  };

  const RANGE_DAYS_BEFORE = 14;
  const RANGE_DAYS_AFTER = 14;

  const toIsoDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  };

  const normalizeDirectSourceVariables = useCallback((input) => {
    const now = new Date();
    const from = toIsoDate(input?.startDateFrom) || toIsoDate(now);
    const to = toIsoDate(input?.startDateTo) || toIsoDate(shiftDate(now, 28));
    return {
      ...input,
      effectiveDate: input?.effectiveDate || now.toISOString(),
      startDateFrom: from,
      startDateTo: to
    };
  }, []);

  // State
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [persistedEvent, setPersistedEvent] = useState(null);
  const [queryInfo, setQueryInfo] = useState({
    endpoint: DEFAULT_GRAPHQL_ENDPOINT,
    query: DEFAULT_QUERY,
    variables: null,
    lastExecuted: null
  });

  // Test mode state - manual date controls
  const [testMode, setTestMode] = useState(false);
  const [manualDates, setManualDates] = useState({
    effectiveDate: getTodayISO(),
    startDate: getTodayISO(),
    endDate: getDefaultEndDate()
  });

  // Refs to prevent stale closures and duplicate fetches
  const mountedRef = useRef(true);
  const endpointRef = useRef(DEFAULT_GRAPHQL_ENDPOINT);
  const fetchDataRef = useRef(null);
  const lastFetchedQueryKeyRef = useRef(null);
  const inFlightQueryKeyRef = useRef(null);
  const hasHydratedRef = useRef(false);
  const lastPersistedEventKeyRef = useRef(null);
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Extract parameters from persisted event - DATE RANGES ONLY
  const extractQueryParams = useCallback((event) => {
    if (!event || !event.detail) {
      return null;
    }

    const detail = event.detail;
    const rowData = detail.row_data || detail;
    const sailCode = rowData.sail_code || rowData.Sail_Code || detail.sail_code || null;

    // Try to extract date information from various possible field names
    const sailDate = rowData.sail_date_from || 
                     rowData.sail_date || 
                     rowData.sailDate ||
                     rowData.depart ||
                     rowData.departure_date ||
                     rowData.Sail_Date_From ||
                     null;

    // Calculate date range based on sail date
    let startDateFrom = null;
    let startDateTo = null;

    if (sailDate) {
      const date = new Date(sailDate);
      if (!isNaN(date.getTime())) {
        // Use a window around the sail date (before + after)
        startDateFrom = toISODate(shiftDate(date, -RANGE_DAYS_BEFORE));
        startDateTo = toISODate(shiftDate(date, RANGE_DAYS_AFTER));
      }
    }

    // Default to next 4 weeks if no sail date found
    if (!startDateFrom) {
      const today = new Date();
      startDateFrom = toISODate(today);
      startDateTo = toISODate(shiftDate(today, 28));
    }

    // Effective date is now
    const effectiveDate = new Date().toISOString();

    // Include context info for display only (not filtering)
    const shipName = rowData.ship_name || rowData.Ship_Name || rowData.ship || null;
    const packageName = rowData.package_name || rowData.Package_Name || rowData.sailing || rowData.package || null;

    return {
      effectiveDate,
      startDateFrom,
      startDateTo,
      // Context info for display only
      _context: {
        sailCode,
        shipName,
        packageName,
        sailDate,
        rangeDaysBefore: RANGE_DAYS_BEFORE,
        rangeDaysAfter: RANGE_DAYS_AFTER,
        source: 'persisted-event'
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadEndpoint = async () => {
      try {
        const data = await trackedFetchGraphql({
          query: DATA_SOURCE_QUERY,
          component: 'DirectSourceRequest',
          purpose: 'Load direct source endpoint',
          tableName: 'data_source',
        });
        const sources = data?.dataSources || [];
        const directSource =
          DIRECT_B2B_SOURCE_NAMES
            .map((name) => sources.find((source) => source.sourceName === name))
            .find(Boolean) || null;
        const endpoint = directSource?.connectionConfig?.endpoint || DEFAULT_GRAPHQL_ENDPOINT;
        endpointRef.current = endpoint;
        if (!cancelled) {
          setQueryInfo((prev) => ({
            ...prev,
            endpoint,
            endpointSource: directSource?.sourceName || 'default',
          }));
        }
      } catch (err) {
        console.warn('[DirectSourceRequest] Failed to load data source config:', err?.message || err);
      }
    };
    loadEndpoint();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch data from external GraphQL endpoint
  const fetchData = useCallback(async (variables, { force = false } = {}) => {
    if (!mountedRef.current) return;

    const normalizedVariables = normalizeDirectSourceVariables(variables);
    const queryKey = buildQueryKey(normalizedVariables);
    if (!force && queryKey) {
      if (inFlightQueryKeyRef.current === queryKey) return;
      if (lastFetchedQueryKeyRef.current === queryKey) return;
    }
    inFlightQueryKeyRef.current = queryKey;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const requestId = ++requestIdRef.current;
    const isCurrentRequest = () => (
      mountedRef.current
      && requestIdRef.current === requestId
      && abortControllerRef.current === abortController
    );

    setLoading(true);
    setError(null);

    const startTime = Date.now();
    const endpoint = endpointRef.current || DEFAULT_GRAPHQL_ENDPOINT;
    let succeeded = false;

    try {
      console.log('[DirectSourceRequest] Fetching from:', endpoint);
      console.log('[DirectSourceRequest] Variables:', normalizedVariables);

      const result = await fetchDirectB2bAvailability({
        endpoint,
        variables: normalizedVariables,
        component: 'DirectSourceRequest',
        purpose: 'Fetch external availability',
        signal: abortController.signal,
        timeoutMs: DIRECT_B2B_FAIL_FAST_MS,
      });

      if (!isCurrentRequest()) return;

      const voyages = result?.availableVoyages || [];
      console.log('[DirectSourceRequest] Received', voyages.length, 'voyages');

      // Flatten the data for table display
      const flattenedData = flattenVoyageData(voyages, normalizedVariables?._context?.sailCode);
      console.log('[DirectSourceRequest] Flattened to', flattenedData.length, 'records');
      const selectedSailCode = normalizedVariables?._context?.sailCode || null;
      const matchedRows = selectedSailCode
        ? flattenedData.filter((row) => row?.isSelectedSail)
        : flattenedData;
      const displayRows = selectedSailCode ? matchedRows : flattenedData;
      const validation = selectedSailCode
        ? {
            status: matchedRows.length > 0 ? 'matched' : 'no_match',
            selectedSailCode,
            matchedRows: matchedRows.length,
            totalRows: flattenedData.length
          }
        : {
            status: 'no_selection',
            selectedSailCode: null,
            matchedRows: flattenedData.length,
            totalRows: flattenedData.length
          };

      // If no data and this wasn't already a fallback query, retry with next 4 weeks
      // Only fallback if no selected sail code is present; otherwise keep strict sail validation.
      if (
        flattenedData.length === 0 &&
        !normalizedVariables._isFallback &&
        normalizedVariables._context?.source === 'persisted-event' &&
        !selectedSailCode
      ) {
        console.log('[DirectSourceRequest] No data for context dates, falling back to next 4 weeks');
        const today = new Date();
        const fourWeeksLater = new Date(today);
        fourWeeksLater.setDate(fourWeeksLater.getDate() + 28);
        
        const fallbackVariables = {
          effectiveDate: today.toISOString(),
          startDateFrom: today.toISOString().split('T')[0],
          startDateTo: fourWeeksLater.toISOString().split('T')[0],
          _context: {
            ...(normalizedVariables._context || {}),
            fallbackReason: 'No data for original date range - showing next 4 weeks',
            rangeDaysBefore: 0,
            rangeDaysAfter: 28,
            source: 'fallback'
          },
          _isFallback: true
        };
        
        // Retry with fallback dates
        if (mountedRef.current) {
          inFlightQueryKeyRef.current = null;
          fetchData(fallbackVariables);
        }
        return;
      }

      let parity = null;
      const paritySailCode = normalizedVariables?._context?.sailCode || null;
      if (paritySailCode) {
        try {
          const parityPayload = await trackedFetchGraphql({
            query: LOCAL_PARITY_QUERY,
            variables: { sailCode: paritySailCode },
            component: 'DirectSourceRequest',
            purpose: 'Parity check against synced availability',
            tableName: 'cabin_availability'
          });
          const rows = Array.isArray(parityPayload?.tableData) ? parityPayload.tableData : [];
          const localAvailable = rows.reduce((sum, row) => sum + Number(row?.available_cabins || 0), 0);
          const directAvailable = displayRows.reduce((sum, row) => sum + Number(row?.availableCabins || 0), 0);
          parity = {
            sailCode: paritySailCode,
            directRows: displayRows.length,
            localRows: rows.length,
            directAvailable,
            localAvailable,
            availableDelta: directAvailable - localAvailable
          };
        } catch (parityError) {
          parity = { sailCode: paritySailCode, error: parityError?.message || String(parityError) };
        }
      }

      setData(displayRows);
      setQueryInfo(prev => ({
        ...prev,
        variables: normalizedVariables,
        lastExecuted: new Date().toISOString(),
        executionTime: Date.now() - startTime,
        recordCount: displayRows.length,
        retryCount: 0,
        parity,
        validation
      }));
      succeeded = true;

    } catch (err) {
      if (!isCurrentRequest()) return;
      const message = String(err?.message || err || '');
      if (message === 'Request cancelled') return;
      console.error('[DirectSourceRequest] Error:', err);
      setError(err);
      setData(null);
    } finally {
      if (!isCurrentRequest()) return;
      abortControllerRef.current = null;
      if (queryKey && inFlightQueryKeyRef.current === queryKey) {
        inFlightQueryKeyRef.current = null;
      }
      setLoading(false);
      if (queryKey && succeeded) {
        lastFetchedQueryKeyRef.current = queryKey;
      }
    }
  }, [normalizeDirectSourceVariables]);

  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  // Flatten nested voyage data for Tabulator display
  const matchesSelectedSail = (selectedSailCode, record) => {
    if (!selectedSailCode) return false;
    const normalized = String(selectedSailCode).toLowerCase();
    const packageCode = record.packageCode ? String(record.packageCode).toLowerCase() : '';
    const sailRefIdent = record.sailRefIdent ? String(record.sailRefIdent) : '';
    const sailIdent = record.sailIdent ? String(record.sailIdent) : '';
    if (packageCode === normalized || packageCode.includes(normalized)) return true;
    if (sailRefIdent && sailRefIdent === String(selectedSailCode)) return true;
    if (sailIdent && sailIdent === String(selectedSailCode)) return true;
    return false;
  };

  const flattenVoyageData = (voyages, selectedSailCode) => {
    const flattened = [];

    voyages.forEach((voyage, voyageIndex) => {
      const pkg = voyage.pkg || {};
      const sailFrom = voyage.sail?.from?.dateTime || null;
      const sailRefIdent = voyage.sail?.from?.sailRefIdent || null;
      const categories = voyage.availableCategories || [];

      if (categories.length === 0) {
        // If no categories, still show the package info
        const baseRecord = {
          id: `${voyageIndex}-0`,
          packageCode: pkg.code || 'N/A',
          packageName: pkg.name || 'N/A',
          sailDays: pkg.sailDays || 0,
          sailDate: sailFrom,
          sailRefIdent: sailRefIdent || null,
          sailIdent: pkg.sailIdent || null,
          cabinCategoryCode: 'N/A',
          availabilityResult: 'N/A',
          canBookNestedCabins: false,
          canBookCabins: false,
          totalCabins: 0,
          availableCabins: 0,
          totalAvailableAbsolute: 0,
          totalAvailableWeighted: 0
        };
        baseRecord.isSelectedSail = matchesSelectedSail(selectedSailCode, baseRecord);
        flattened.push(baseRecord);
      } else {
        categories.forEach((cat, catIndex) => {
          const availability = cat.availability || {};
          const record = {
            id: `${voyageIndex}-${catIndex}`,
            packageCode: pkg.code || 'N/A',
            packageName: pkg.name || 'N/A',
            sailDays: pkg.sailDays || 0,
            sailDate: sailFrom,
            sailRefIdent: sailRefIdent || null,
            sailIdent: pkg.sailIdent || null,
            cabinCategoryCode: cat.cabinCategory?.code || 'N/A',
            availabilityResult: cat.availabilityResult || 'N/A',
            canBookNestedCabins: cat.canBookNestedCabins || false,
            canBookCabins: cat.canBookCabins || false,
            totalCabins: availability.totalCabins || 0,
            availableCabins: availability.availableCabins || 0,
            totalAvailableAbsolute: availability.totalAvailableAbsolute || 0,
            totalAvailableWeighted: availability.totalAvailableWeighted || 0
          };
          record.isSelectedSail = matchesSelectedSail(selectedSailCode, record);
          flattened.push(record);
        });
      }
    });

    return flattened;
  };

  // Subscribe to sail selection changes (not every status-bar tick)
  useEffect(() => {
    const applyPersistedEvent = (event, { fetch = true } = {}) => {
      if (!event?.detail) return false;

      const eventKey = buildPersistedEventKey(event);
      if (eventKey && eventKey === lastPersistedEventKeyRef.current) {
        return false;
      }
      if (eventKey) {
        lastPersistedEventKeyRef.current = eventKey;
      }

      setPersistedEvent(event);
      const params = extractQueryParams(event);
      if (!params) return false;

      setManualDates({
        effectiveDate: getTodayISO(),
        startDate: params.startDateFrom,
        endDate: params.startDateTo,
      });

      if (fetch) {
        fetchDataRef.current?.(params);
      }
      return true;
    };

    const hydrateFromPersistedSources = () => {
      if (hasHydratedRef.current) return false;
      hasHydratedRef.current = true;

      if (window.__taliaStatus) {
        const state = window.__taliaStatus.getState();
        if (state.persistedEvent?.detail) {
          console.log('[DirectSourceRequest] Found persisted event on mount:', state.persistedEvent);
          return applyPersistedEvent(state.persistedEvent);
        }
      }

      if (window.lastSailSelectEvent?.detail) {
        console.log('[DirectSourceRequest] Found lastSailSelectEvent on mount:', window.lastSailSelectEvent);
        return applyPersistedEvent(window.lastSailSelectEvent);
      }

      try {
        const persistedEventStr = localStorage.getItem('talia:persisted:lastEvent');
        if (persistedEventStr) {
          const persistedEvent = JSON.parse(persistedEventStr);
          if (persistedEvent?.detail) {
            console.log('[DirectSourceRequest] Found localStorage persisted event:', persistedEvent);
            return applyPersistedEvent(persistedEvent);
          }
        }
      } catch (e) {
        console.warn('[DirectSourceRequest] Error checking localStorage:', e);
      }

      return false;
    };

    let unsubscribe = null;
    if (window.__taliaStatus?.subscribe) {
      unsubscribe = window.__taliaStatus.subscribe(() => {
        const state = window.__taliaStatus.getState();
        if (state.persistedEvent?.detail) {
          applyPersistedEvent(state.persistedEvent);
        }
      });
    }

    const handleSailSelect = (event) => {
      console.log('[DirectSourceRequest] Received sail.select event:', event.detail);
      applyPersistedEvent({ detail: event.detail });
    };

    window.addEventListener(SAIL_SELECT_EVENT, handleSailSelect);

    const foundContext = hydrateFromPersistedSources();
    if (!foundContext) {
      console.log('[DirectSourceRequest] No context found on mount - waiting for selection');
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      window.removeEventListener(SAIL_SELECT_EVENT, handleSailSelect);
    };
  }, [extractQueryParams]);

  // Manual refresh handler
  const handleRefresh = useCallback(() => {
    if (testMode) {
      const effectiveDateTime = new Date(manualDates.effectiveDate).toISOString();
      fetchData({
        effectiveDate: effectiveDateTime,
        startDateFrom: manualDates.startDate,
        startDateTo: manualDates.endDate,
        _context: {
          testMode: true,
          manualSelection: true,
          rangeDaysBefore: null,
          rangeDaysAfter: null,
        },
      }, { force: true });
    } else if (persistedEvent) {
      const params = extractQueryParams(persistedEvent);
      if (params) {
        fetchData(params, { force: true });
      }
    } else {
      const today = new Date();
      const fourWeeksLater = new Date(today);
      fourWeeksLater.setDate(fourWeeksLater.getDate() + 28);

      fetchData({
        effectiveDate: today.toISOString(),
        startDateFrom: today.toISOString().split('T')[0],
        startDateTo: fourWeeksLater.toISOString().split('T')[0],
        _context: {
          source: 'default',
          range: 'next-4-weeks',
          rangeDaysBefore: 0,
          rangeDaysAfter: 28,
        },
      }, { force: true });
    }
  }, [persistedEvent, extractQueryParams, fetchData, testMode, manualDates]);

  // Handle test query with manual dates
  const handleTestQuery = useCallback(() => {
    const effectiveDateTime = new Date(manualDates.effectiveDate).toISOString();

    fetchData({
      effectiveDate: effectiveDateTime,
      startDateFrom: manualDates.startDate,
      startDateTo: manualDates.endDate,
      _context: {
        testMode: true,
        manualSelection: true,
        rangeDaysBefore: null,
        rangeDaysAfter: null,
      },
    }, { force: true });
  }, [manualDates, fetchData]);

  // Handle manual date changes
  const handleDateChange = useCallback((field, value) => {
    setManualDates(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Toggle test mode
  const handleToggleTestMode = useCallback(() => {
    setTestMode(prev => !prev);
  }, []);

  // Handle loading state
  if (loading && !data) {
    return <LoadingSpinner message="Querying external source..." fullScreen={false} />;
  }

  // Handle error state
  if (error && !data) {
    return (
      <ErrorMessage 
        error={error} 
        title="Failed to query external source"
        onRetry={handleRefresh}
      />
    );
  }

  // Handle no context state
  if (!persistedEvent && !data && !loading) {
    return (
      <div className="direct-source-empty">
        <div className="direct-source-empty__icon">🔗</div>
        <h3 className="direct-source-empty__title">Direct Source Request</h3>
        <p className="direct-source-empty__message">
          Waiting for context... Select a sailing from another panel
        </p>
        
        <div className="direct-source-empty__card">
          <div className="direct-source-empty__card-title">
            <strong>How it works:</strong>
          </div>
          <ul className="direct-source-empty__list">
            <li>Select a sailing to set the date range automatically</li>
            <li>Or click below to load availability for the next 4 weeks</li>
          </ul>
          <div className="direct-source-empty__card-footer">
            <strong>Source:</strong> {DEFAULT_GRAPHQL_ENDPOINT}
          </div>
        </div>
        
        <div className="direct-source-empty__actions">
          <button 
            onClick={handleRefresh}
            className="direct-source-empty__button"
          >
            Load Availability (Next 4 Weeks)
          </button>
        </div>
      </div>
    );
  }

  // Render presenter with data
  return (
    <DirectSourceRequestPresenter
      data={data || []}
      onRefresh={handleRefresh}
      loading={loading}
      queryInfo={queryInfo}
      testMode={testMode}
      onToggleTestMode={handleToggleTestMode}
      manualDates={manualDates}
      onDateChange={handleDateChange}
      onTestQuery={handleTestQuery}
      panelInstanceId={panelInstanceId}
      panelComponentId={panelComponentId}
    />
  );
};

export default DirectSourceRequestContainer;
