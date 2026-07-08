import React, { useCallback, useEffect, useRef, useState } from 'react';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';
import { CABIN_CLEAR_EVENT, SAIL_SELECT_EVENT } from '../../../lib/eventBus';
import { trackedFetchGraphql } from '../../../services/data/trackedGraphql';
import DirectAvailabilityPresenter from './DirectAvailabilityPresenter';

const DEFAULT_GRAPHQL_ENDPOINT = 'https://thaliatest.b2b.celestyal.com:3000/graphql';
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 700;

const DATA_SOURCE_QUERY = `
  query DirectAvailabilityDataSources {
    dataSources {
      sourceName
      displayName
      connectionConfig
    }
  }
`;

const DIRECT_SOURCE_READ_NAMES = [
  'celestyal_b2b_api_read',
  'celestyal_b2b_api',
];

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

const buildQueryKey = (variables) => {
  if (!variables) return null;
  const ctx = variables._context || {};
  return [
    ctx.sailCode || '',
    variables.startDateFrom || '',
    variables.startDateTo || '',
    ctx.source || 'default',
  ].join('|');
};

const DEFAULT_QUERY = `query Availability($effectiveDate: DateTime!, $startDateFrom: Date!, $startDateTo: Date!) {
  availableVoyages(
    params: {
      effectiveDate: $effectiveDate
      startDateRange: { from: $startDateFrom, to: $startDateTo }
    }
  ) {
    sail {
      from {
        dateTime
        sailRefIdent
      }
      to {
        dateTime
        sailRefIdent
      }
    }
    pkg {
      code
      name
      sailDays
      sailIdent
    }
    availableCategories {
      cabinCategory {
        code
      }
      availabilityResult
      canBookNestedCabins
      canBookCabins
      availability {
        totalCabins
        availableCabins
        totalAvailableAbsolute
        totalAvailableWeighted
      }
    }
  }
}`;

const toISODate = (date) => new Date(date).toISOString().split('T')[0];
const shiftDate = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const RANGE_DAYS_BEFORE = 14;
const RANGE_DAYS_AFTER = 14;

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

    if (!categories.length) {
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
      return;
    }

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
  });
  return flattened;
};

const extractQueryParams = (event) => {
  if (!event || !event.detail) return null;
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

  let startDateFrom = null;
  let startDateTo = null;
  if (sailDate) {
    const date = new Date(sailDate);
    if (!Number.isNaN(date.getTime())) {
      startDateFrom = toISODate(shiftDate(date, -RANGE_DAYS_BEFORE));
      startDateTo = toISODate(shiftDate(date, RANGE_DAYS_AFTER));
    }
  }
  if (!startDateFrom) {
    const today = new Date();
    startDateFrom = toISODate(today);
    startDateTo = toISODate(shiftDate(today, 28));
  }

  return {
    effectiveDate: new Date().toISOString(),
    startDateFrom,
    startDateTo,
    _context: {
      sailCode,
      sailDate,
      packageName: rowData.package_name || rowData.Package_Name || rowData.sailing || rowData.package || null,
      source: 'persisted-event'
    }
  };
};

const DirectAvailabilityContainer = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [persistedEvent, setPersistedEvent] = useState(null);
  const [queryInfo, setQueryInfo] = useState({
    endpoint: DEFAULT_GRAPHQL_ENDPOINT,
    endpointSource: 'default',
    query: DEFAULT_QUERY,
    variables: null,
    validation: null,
    lastExecuted: null,
    executionTime: null
  });
  const mountedRef = useRef(true);
  const endpointRef = useRef(DEFAULT_GRAPHQL_ENDPOINT);
  const fetchDataRef = useRef(null);
  const lastFetchedQueryKeyRef = useRef(null);
  const inFlightQueryKeyRef = useRef(null);
  const hasHydratedRef = useRef(false);
  const lastPersistedEventKeyRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadEndpoint = async () => {
      try {
        const data = await trackedFetchGraphql({
          query: DATA_SOURCE_QUERY,
          component: 'DirectAvailability',
          purpose: 'Load direct availability endpoint',
          tableName: 'data_source'
        });
        const sources = data?.dataSources || [];
        const directSource =
          DIRECT_SOURCE_READ_NAMES
            .map((name) => sources.find((source) => source.sourceName === name))
            .find(Boolean) || null;
        if (!cancelled) {
          const endpoint = directSource?.connectionConfig?.endpoint || DEFAULT_GRAPHQL_ENDPOINT;
          endpointRef.current = endpoint;
          setQueryInfo((prev) => ({
            ...prev,
            endpoint,
            endpointSource: directSource?.sourceName || 'default'
          }));
        }
      } catch (err) {
        console.warn('[DirectAvailability] Failed to load data source config:', err?.message || err);
      }
    };
    loadEndpoint();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchData = useCallback(async (variables, { force = false } = {}) => {
    if (!mountedRef.current || !variables?._context?.sailCode) return;

    const queryKey = buildQueryKey(variables);
    if (!force && queryKey) {
      if (inFlightQueryKeyRef.current === queryKey) return;
      if (lastFetchedQueryKeyRef.current === queryKey) return;
    }
    inFlightQueryKeyRef.current = queryKey;

    setLoading(true);
    setError(null);
    const startTime = Date.now();
    const endpoint = endpointRef.current || DEFAULT_GRAPHQL_ENDPOINT;
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let succeeded = false;

    try {
      let result = null;
      let lastError = null;
      let attempts = 0;
      while (attempts <= MAX_RETRIES) {
        try {
          attempts += 1;
          result = await Promise.race([
            trackedFetchGraphql({
              url: endpoint,
              query: DEFAULT_QUERY,
              variables: {
                effectiveDate: variables.effectiveDate,
                startDateFrom: variables.startDateFrom,
                startDateTo: variables.startDateTo
              },
              component: 'DirectAvailability',
              purpose: 'Fetch current direct availability',
              tableName: 'availableVoyages',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS))
          ]);
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (attempts > MAX_RETRIES) break;
          await delay(RETRY_DELAY_MS * attempts);
        }
      }
      if (lastError) throw lastError;
      if (!mountedRef.current) return;

      const voyages = result?.availableVoyages || [];
      const flattenedData = flattenVoyageData(voyages, variables?._context?.sailCode);
      const matchedRows = flattenedData.filter((row) => row?.isSelectedSail);
      const validation = {
        status: matchedRows.length > 0 ? 'matched' : 'no_match',
        selectedSailCode: variables?._context?.sailCode || null,
        matchedRows: matchedRows.length,
        totalRows: flattenedData.length
      };

      setData(matchedRows);
      setQueryInfo((prev) => ({
        ...prev,
        variables,
        validation,
        lastExecuted: new Date().toISOString(),
        executionTime: Date.now() - startTime
      }));
      succeeded = true;
    } catch (err) {
      console.error('[DirectAvailability] Error:', err);
      if (mountedRef.current) {
        setError(err);
        setData([]);
      }
    } finally {
      if (queryKey && inFlightQueryKeyRef.current === queryKey) {
        inFlightQueryKeyRef.current = null;
      }
      if (mountedRef.current) {
        setLoading(false);
        if (queryKey && succeeded) {
          lastFetchedQueryKeyRef.current = queryKey;
        }
      }
    }
  }, []);

  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  useEffect(() => {
    const applyPersistedEvent = (event) => {
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
      if (params?._context?.sailCode) {
        fetchDataRef.current?.(params);
        return true;
      }
      return false;
    };

    const hydrateFromPersistedSources = () => {
      if (hasHydratedRef.current) return false;
      hasHydratedRef.current = true;

      if (window.__taliaStatus) {
        const state = window.__taliaStatus.getState();
        if (state.persistedEvent?.detail) {
          return applyPersistedEvent(state.persistedEvent);
        }
      }
      if (window.lastSailSelectEvent?.detail) {
        return applyPersistedEvent(window.lastSailSelectEvent);
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
      window.dispatchEvent(new CustomEvent(CABIN_CLEAR_EVENT, {
        detail: { timestamp: new Date().toISOString() }
      }));
      applyPersistedEvent({ detail: event.detail });
    };
    window.addEventListener(SAIL_SELECT_EVENT, handleSailSelect);
    hydrateFromPersistedSources();

    return () => {
      if (unsubscribe) unsubscribe();
      window.removeEventListener(SAIL_SELECT_EVENT, handleSailSelect);
    };
  }, []);

  const handleRefresh = useCallback(() => {
    if (!persistedEvent) return;
    const params = extractQueryParams(persistedEvent);
    if (params?._context?.sailCode) fetchData(params, { force: true });
  }, [persistedEvent, fetchData]);

  if (loading && !data?.length) {
    return <LoadingSpinner message="Loading direct availability..." fullScreen={false} />;
  }

  if (error && !data?.length) {
    return (
      <ErrorMessage
        error={error}
        title="Failed to query direct availability"
        onRetry={handleRefresh}
      />
    );
  }

  if (!persistedEvent && !loading) {
    return (
      <div className="direct-source-empty">
        <div className="direct-source-empty__icon">🔗</div>
        <h3 className="direct-source-empty__title">Direct Availability</h3>
        <p className="direct-source-empty__message">
          Waiting for sailing selection... choose a sail in Master Sailing.
        </p>
      </div>
    );
  }

  return (
    <DirectAvailabilityPresenter
      data={data || []}
      loading={loading}
      queryInfo={queryInfo}
      onRefresh={handleRefresh}
    />
  );
};

export default DirectAvailabilityContainer;
