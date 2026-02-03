/**
 * Custom hook for fetching reservation data
 * Provides a reusable pattern for data fetching with loading and error states
 */

import { useState, useEffect, useCallback } from 'react';
import reservationsService from '../../services/data/reservationsService';
import { SAIL_CLEAR_EVENT, SAIL_SELECT_EVENT } from '../../lib/eventBus';

/**
 * Hook for fetching reservation data
 * @param {Object} filters - Query filters (sail_code, ship, res_status, etc.)
 * @returns {Object} { data, loading, error, refetch }
 */
export const useReservationsData = (filters = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await reservationsService.fetch(filters);
      setData(result);
    } catch (err) {
      console.error('[useReservationsData] Error:', err);
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
 * Hook for fetching reservations filtered by sail code
 * Listens to sail selection events for automatic filtering
 * @param {Object} options - Options object
 * @param {boolean} options.listenToSailEvents - Whether to listen to sail selection events (default: true)
 * @returns {Object} { data, loading, error, refetch, selectedSailCode }
 */
export const useReservationsBySail = (options = {}) => {
  const { listenToSailEvents = true } = options;
  const [selectedSailCode, setSelectedSailCode] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Listen to sail selection events
  useEffect(() => {
    if (!listenToSailEvents) return;

    const handleSailSelect = (event) => {
      // Extract sail_code from event detail (can be string or object with sail_code property)
      const sailCode = typeof event.detail === 'string' 
        ? event.detail 
        : event.detail?.sail_code || event.detail?.row_data?.sail_code || event.detail;
      console.log('[useReservationsBySail] Sail selected:', sailCode, 'from event:', event.detail);
      if (sailCode) {
        setSelectedSailCode(sailCode);
      } else {
        console.warn('[useReservationsBySail] Could not extract sail_code from event:', event.detail);
      }
    };

    const handleSailClear = () => {
      console.log('[useReservationsBySail] Sail cleared');
      setSelectedSailCode(null);
    };

    window.addEventListener(SAIL_SELECT_EVENT, handleSailSelect);
    window.addEventListener(SAIL_CLEAR_EVENT, handleSailClear);

    return () => {
      window.removeEventListener(SAIL_SELECT_EVENT, handleSailSelect);
      window.removeEventListener(SAIL_CLEAR_EVENT, handleSailClear);
    };
  }, [listenToSailEvents]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const filters = selectedSailCode ? { sail_code: selectedSailCode } : {};
      const result = await reservationsService.fetch(filters);
      setData(result);
    } catch (err) {
      console.error('[useReservationsBySail] Error:', err);
      setError(err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSailCode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    selectedSailCode
  };
};

