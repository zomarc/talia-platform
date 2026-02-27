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

// Default external GraphQL endpoint
const DEFAULT_GRAPHQL_ENDPOINT = 'https://thaliatest.b2b.celestyal.com:3000/graphql';

// Default query template - availableVoyages
// Note: The Celestyal B2B API expects DateTime type for effectiveDate and Date type for date ranges
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

const DirectSourceRequestContainer = () => {

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

  // Refs to prevent stale closures
  const mountedRef = useRef(true);

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

  // Fetch data from external GraphQL endpoint
  const fetchData = useCallback(async (variables) => {
    if (!mountedRef.current) return;

    setLoading(true);
    setError(null);

    const startTime = Date.now();

    try {
      console.log('[DirectSourceRequest] Fetching from:', DEFAULT_GRAPHQL_ENDPOINT);
      console.log('[DirectSourceRequest] Variables:', variables);

      const response = await fetch(DEFAULT_GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query: DEFAULT_QUERY,
          variables: {
            effectiveDate: variables.effectiveDate,
            startDateFrom: variables.startDateFrom,
            startDateTo: variables.startDateTo
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!mountedRef.current) return;

      if (result.errors) {
        console.error('[DirectSourceRequest] GraphQL errors:', result.errors);
        throw new Error(result.errors[0].message);
      }

      const voyages = result.data?.availableVoyages || [];
      console.log('[DirectSourceRequest] Received', voyages.length, 'voyages');

      // Flatten the data for table display
      const flattenedData = flattenVoyageData(voyages, variables?._context?.sailCode);
      console.log('[DirectSourceRequest] Flattened to', flattenedData.length, 'records');

      // If no data and this wasn't already a fallback query, retry with next 4 weeks
      // Only fallback if the original query was based on persisted context dates (not default)
      if (flattenedData.length === 0 && !variables._isFallback && variables._context?.source === 'persisted-event') {
        console.log('[DirectSourceRequest] No data for context dates, falling back to next 4 weeks');
        const today = new Date();
        const fourWeeksLater = new Date(today);
        fourWeeksLater.setDate(fourWeeksLater.getDate() + 28);
        
        const fallbackVariables = {
          effectiveDate: today.toISOString(),
          startDateFrom: today.toISOString().split('T')[0],
          startDateTo: fourWeeksLater.toISOString().split('T')[0],
          _context: {
            ...(variables._context || {}),
            fallbackReason: 'No data for original date range - showing next 4 weeks',
            rangeDaysBefore: 0,
            rangeDaysAfter: 28,
            source: 'fallback'
          },
          _isFallback: true
        };
        
        // Retry with fallback dates
        if (mountedRef.current) {
          fetchData(fallbackVariables);
        }
        return;
      }

      setData(flattenedData);
      setQueryInfo(prev => ({
        ...prev,
        variables,
        lastExecuted: new Date().toISOString(),
        executionTime: Date.now() - startTime,
        recordCount: flattenedData.length
      }));

    } catch (err) {
      console.error('[DirectSourceRequest] Error:', err);
      if (mountedRef.current) {
        setError(err);
        setData(null);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

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

  // Subscribe to persisted event changes
  useEffect(() => {
    mountedRef.current = true;
    let hasInitialFetch = false;

    // Check for initial persisted event and auto-fetch
    const checkPersistedEvent = () => {
      if (window.__taliaStatus) {
        const state = window.__taliaStatus.getState();
        if (state.persistedEvent && state.persistedEvent.detail) {
          console.log('[DirectSourceRequest] Found persisted event on mount:', state.persistedEvent);
          setPersistedEvent(state.persistedEvent);
          
          // Extract params and update manual dates to match context
          const params = extractQueryParams(state.persistedEvent);
          if (params) {
            // Update manual dates to reflect context dates
            setManualDates({
              effectiveDate: getTodayISO(),
              startDate: params.startDateFrom,
              endDate: params.startDateTo
            });
            
            // Auto-fetch with context
            if (!hasInitialFetch) {
              hasInitialFetch = true;
              console.log('[DirectSourceRequest] Auto-fetching with context:', params._context);
              fetchData(params);
            }
          }
          return true;
        }
      }
      return false;
    };

    // Check last sail select event (global event bus)
    const checkLastSailSelect = () => {
      if (window.lastSailSelectEvent?.detail) {
        const persistedEvent = window.lastSailSelectEvent;
        console.log('[DirectSourceRequest] Found lastSailSelectEvent on mount:', persistedEvent);
        setPersistedEvent(persistedEvent);
        const params = extractQueryParams(persistedEvent);
        if (params) {
          setManualDates({
            effectiveDate: getTodayISO(),
            startDate: params.startDateFrom,
            endDate: params.startDateTo
          });
          if (!hasInitialFetch) {
            hasInitialFetch = true;
            fetchData(params);
          }
          return true;
        }
      }
      return false;
    };

    // Also check localStorage for persisted event
    const checkLocalStorage = () => {
      try {
        const persistedEventStr = localStorage.getItem('talia:persisted:lastEvent');
        if (persistedEventStr) {
          const persistedEvent = JSON.parse(persistedEventStr);
          if (persistedEvent && persistedEvent.detail) {
            console.log('[DirectSourceRequest] Found localStorage persisted event:', persistedEvent);
            setPersistedEvent(persistedEvent);
            
            const params = extractQueryParams(persistedEvent);
            if (params) {
              setManualDates({
                effectiveDate: getTodayISO(),
                startDate: params.startDateFrom,
                endDate: params.startDateTo
              });
              
              if (!hasInitialFetch) {
                hasInitialFetch = true;
                console.log('[DirectSourceRequest] Auto-fetching with localStorage context:', params._context);
                fetchData(params);
              }
            }
            return true;
          }
        }
      } catch (e) {
        console.warn('[DirectSourceRequest] Error checking localStorage:', e);
      }
      return false;
    };

    // Subscribe to status changes
    let unsubscribe = null;
    if (window.__taliaStatus?.subscribe) {
      unsubscribe = window.__taliaStatus.subscribe(() => {
        const state = window.__taliaStatus.getState();
        if (state.persistedEvent && state.persistedEvent.detail) {
          setPersistedEvent(state.persistedEvent);
          const params = extractQueryParams(state.persistedEvent);
          if (params) {
            // Update manual dates when context changes
            setManualDates({
              effectiveDate: getTodayISO(),
              startDate: params.startDateFrom,
              endDate: params.startDateTo
            });
            fetchData(params);
          }
        }
      });
    }

    // Also listen to sail.select events directly
    const handleSailSelect = (event) => {
      console.log('[DirectSourceRequest] Received sail.select event:', event.detail);
      const syntheticEvent = { detail: event.detail };
      setPersistedEvent(syntheticEvent);
      const params = extractQueryParams(syntheticEvent);
      if (params) {
        // Update manual dates when context changes
        setManualDates({
          effectiveDate: getTodayISO(),
          startDate: params.startDateFrom,
          endDate: params.startDateTo
        });
        fetchData(params);
      }
    };

    window.addEventListener(SAIL_SELECT_EVENT, handleSailSelect);

    // Check on mount - try multiple sources
    const foundContext = checkPersistedEvent() || checkLastSailSelect() || checkLocalStorage();
    
    if (!foundContext) {
      console.log('[DirectSourceRequest] No context found on mount - waiting for selection');
    }

    return () => {
      mountedRef.current = false;
      if (unsubscribe) {
        unsubscribe();
      }
      window.removeEventListener(SAIL_SELECT_EVENT, handleSailSelect);
    };
  }, [extractQueryParams, fetchData]);

  // Manual refresh handler
  const handleRefresh = useCallback(() => {
    if (testMode) {
      // Use manual test dates
      handleTestQuery();
    } else if (persistedEvent) {
      const params = extractQueryParams(persistedEvent);
      if (params) {
        fetchData(params);
      }
    } else {
      // If no persisted event, use default date range (next 4 weeks)
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
          rangeDaysAfter: 28
        }
      });
    }
  }, [persistedEvent, extractQueryParams, fetchData, testMode]);

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
        rangeDaysAfter: null
      }
    });
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
      persistedEvent={persistedEvent}
      // Test mode props
      testMode={testMode}
      onToggleTestMode={handleToggleTestMode}
      manualDates={manualDates}
      onDateChange={handleDateChange}
      onTestQuery={handleTestQuery}
    />
  );
};

export default DirectSourceRequestContainer;
