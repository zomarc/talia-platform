/**
 * Custom hook for fetching sailing data
 * Provides a reusable pattern for data fetching with loading and error states
 */

import { useState, useEffect } from 'react';
import sailingsService from '../../services/data/sailingsService';

/**
 * Hook for fetching sailing data
 * @param {Object} filters - Query filters (sail_code, ship_name, etc.)
 * @returns {Object} { data, loading, error, refetch }
 */
export const useSailingData = (filters = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await sailingsService.fetch(filters);
      setData(result);
    } catch (err) {
      console.error('[useSailingData] Error:', err);
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
 * Hook for fetching a single sailing by ID
 * @param {string} sailId - Sail ID
 * @returns {Object} { data, loading, error, refetch }
 */
export const useSailingById = (sailId) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    if (!sailId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await sailingsService.fetchById(sailId);
      setData(result);
    } catch (err) {
      console.error('[useSailingById] Error:', err);
      setError(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [sailId]);

  return {
    data,
    loading,
    error,
    refetch: fetchData
  };
};

/**
 * Hook for fetching unique ship names
 * @returns {Object} { ships, loading, error, refetch }
 */
export const useShipNames = () => {
  const [ships, setShips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await sailingsService.getShipNames();
      setShips(result);
    } catch (err) {
      console.error('[useShipNames] Error:', err);
      setError(err);
      setShips([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    ships,
    loading,
    error,
    refetch: fetchData
  };
};

