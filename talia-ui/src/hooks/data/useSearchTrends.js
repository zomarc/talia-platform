/**
 * Custom hook for Search Trends
 * Manages trends data fetching
 */

import { useState, useEffect, useCallback } from 'react';
import searchTrendsService from '../../services/data/searchTrendsService';

export const useSearchTrends = (filters = {}) => {
  const [trends, setTrends] = useState(null);
  const [trackedQueries, setTrackedQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTrends = useCallback(async (newFilters = {}) => {
    setLoading(true);
    setError(null);

    try {
      const mergedFilters = { ...filters, ...newFilters };
      const trendsData = await searchTrendsService.getTrends(mergedFilters);
      setTrends(trendsData);
    } catch (err) {
      console.error('[useSearchTrends] Error:', err);
      setError(err);
      setTrends(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchTrackedQueries = useCallback(async () => {
    try {
      const queries = await searchTrendsService.getTrackedQueries();
      setTrackedQueries(queries);
    } catch (err) {
      console.error('[useSearchTrends] Error fetching tracked queries:', err);
      setTrackedQueries([]);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTrends();
    fetchTrackedQueries();
  }, []);

  const refetch = useCallback((newFilters) => {
    return fetchTrends(newFilters);
  }, [fetchTrends]);

  return {
    trends,
    trackedQueries,
    loading,
    error,
    refetch,
    fetchTrends
  };
};

