/**
 * Custom hook for fetching published rates data
 * Provides a reusable pattern for data fetching with loading and error states
 */

import { useState, useEffect } from 'react';
import publishedRatesService from '../../services/data/publishedRatesService';

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

  // Listen to sail selection events
  useEffect(() => {
    if (!listenToSailEvents) return;

    const handleSailSelect = (event) => {
      const sailCode = event.detail;
      console.log('[usePublishedRatesBySail] Sail selected:', sailCode);
      setSelectedSailCode(sailCode);
    };

    const handleSailClear = () => {
      console.log('[usePublishedRatesBySail] Sail cleared');
      setSelectedSailCode(null);
    };

    window.addEventListener('talia:sail.select', handleSailSelect);
    window.addEventListener('talia:sail.clear', handleSailClear);

    return () => {
      window.removeEventListener('talia:sail.select', handleSailSelect);
      window.removeEventListener('talia:sail.clear', handleSailClear);
    };
  }, [listenToSailEvents]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const filters = selectedSailCode ? { sail_code: selectedSailCode } : {};
      const result = await publishedRatesService.fetch(filters);
      setData(result);
    } catch (err) {
      console.error('[usePublishedRatesBySail] Error:', err);
      setError(err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedSailCode]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    selectedSailCode
  };
};

