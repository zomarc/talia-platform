/**
 * Custom hook for fetching published rates data
 * Provides a reusable pattern for data fetching with loading and error states
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import publishedRatesService from '../../services/data/publishedRatesService';
import { SAIL_CLEAR_EVENT, SAIL_SELECT_EVENT } from '../../lib/eventBus';

/**
 * Hook for fetching published rates data
 * @param {Object} filters - Query filters (sail_code, ship_code, etc.)
 * @returns {Object} { data, loading, error, refetch }
 */
export const usePublishedRatesData = (filters = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await publishedRatesService.fetch(filters);
      setData(result);
    } catch (err) {
      console.error('[usePublishedRatesData] Error:', err);
      setError(err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [JSON.stringify(filters)]); // Re-fetch when filters change

  return {
    data,
    loading,
    error,
    refetch: fetchData
  };
};

/**
 * Hook for fetching published rates filtered by sail code
 * Listens to sail selection events for automatic filtering
 * Also checks for existing context on mount to restore state
 * @param {Object} options - Options object
 * @param {boolean} options.listenToSailEvents - Whether to listen to sail selection events (default: true)
 * @returns {Object} { data, loading, error, refetch, selectedSailCode }
 */
export const usePublishedRatesBySail = (options = {}) => {
  const { listenToSailEvents = true } = options;
  const [selectedSailCode, setSelectedSailCode] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Use refs to prevent double fetches and track initialization
  const fetchingRef = useRef(false);
  const lastSailCodeRef = useRef(null);
  const hasCheckedContextRef = useRef(false);

  // Check for existing context on mount (from persisted events or current state)
  useEffect(() => {
    if (!listenToSailEvents || hasCheckedContextRef.current) return;

    // Try to get the last sail selection from localStorage or window state
    // This is similar to how TestPage restores events
    const checkExistingContext = () => {
      try {
        // Check if there's a recent sail select event stored
        const lastEvent = window.lastSailSelectEvent || null;
        if (lastEvent && lastEvent.detail) {
          const sailCode = typeof lastEvent.detail === 'string' 
            ? lastEvent.detail 
            : lastEvent.detail?.sail_code || lastEvent.detail?.row_data?.sail_code;
          
          if (sailCode) {
            console.log('[usePublishedRatesBySail] Found existing context on mount:', sailCode);
            setSelectedSailCode(sailCode);
            hasCheckedContextRef.current = true;
            return;
          }
        }
      } catch (err) {
        console.warn('[usePublishedRatesBySail] Error checking existing context:', err);
      }
      hasCheckedContextRef.current = true;
    };

    checkExistingContext();
  }, [listenToSailEvents]);

  // Listen to sail selection events
  useEffect(() => {
    if (!listenToSailEvents) return;

    const handleSailSelect = (event) => {
      // Extract sail_code from event detail (can be string or object with sail_code property)
      const sailCode = typeof event.detail === 'string' 
        ? event.detail 
        : event.detail?.sail_code || event.detail?.row_data?.sail_code || null;
      
      console.log('[usePublishedRatesBySail] Sail selected:', sailCode, 'from event:', event.detail);
      
      if (sailCode && sailCode !== selectedSailCode) {
        setSelectedSailCode(sailCode);
        // Store for context restoration
        window.lastSailSelectEvent = event;
      } else if (!sailCode) {
        console.warn('[usePublishedRatesBySail] Could not extract sail_code from event:', event.detail);
      }
    };

    const handleSailClear = () => {
      console.log('[usePublishedRatesBySail] Sail cleared');
      setSelectedSailCode(null);
      window.lastSailSelectEvent = null;
    };

    window.addEventListener(SAIL_SELECT_EVENT, handleSailSelect);
    window.addEventListener(SAIL_CLEAR_EVENT, handleSailClear);

    return () => {
      window.removeEventListener(SAIL_SELECT_EVENT, handleSailSelect);
      window.removeEventListener(SAIL_CLEAR_EVENT, handleSailClear);
    };
  }, [listenToSailEvents, selectedSailCode]);

  // Fetch data - stabilized to prevent double fetches
  const fetchData = useCallback(async () => {
    // Prevent concurrent fetches
    if (fetchingRef.current) {
      console.log('[usePublishedRatesBySail] Already fetching, skipping');
      return;
    }

    // Check if sail code actually changed
    if (lastSailCodeRef.current === selectedSailCode && !loading) {
      console.log('[usePublishedRatesBySail] Sail code unchanged, skipping fetch');
      return;
    }

    fetchingRef.current = true;
    lastSailCodeRef.current = selectedSailCode;
    setLoading(true);
    setError(null);
    
    try {
      const filters = selectedSailCode ? { sail_code: selectedSailCode } : {};
      console.log('[usePublishedRatesBySail] Fetching with filters:', filters);
      const result = await publishedRatesService.fetch(filters);
      setData(result);
    } catch (err) {
      console.error('[usePublishedRatesBySail] Error:', err);
      setError(err);
      setData([]);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [selectedSailCode]); // Only depend on selectedSailCode

  // Fetch when sail code changes (but only once per change)
  useEffect(() => {
    // Wait for context check to complete before first fetch
    if (!hasCheckedContextRef.current) {
      return;
    }
    
    fetchData();
  }, [selectedSailCode, fetchData]); // Re-fetch when sail code changes

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    selectedSailCode
  };
};
