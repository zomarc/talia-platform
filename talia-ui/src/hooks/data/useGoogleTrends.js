/**
 * Custom hook for Google Trends
 * Manages trends data fetching for what people are searching for
 */

import { useState, useEffect, useCallback } from 'react';
import googleTrendsService from '../../services/data/googleTrendsService';

export const useGoogleTrends = (filters = {}) => {
  const [trends, setTrends] = useState(null);
  const [availableQueries, setAvailableQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTrends = useCallback(async (newFilters = {}) => {
    setLoading(true);
    setError(null);

    try {
      const mergedFilters = { ...filters, ...newFilters };
      console.log('[useGoogleTrends] Fetching trends with filters:', mergedFilters);
      const trendsData = await googleTrendsService.getTrends(mergedFilters);
      console.log('[useGoogleTrends] Trends data received:', {
        queries: trendsData?.queries,
        seriesCount: trendsData?.series?.length,
        totalDataPoints: trendsData?.totalDataPoints
      });
      setTrends(trendsData);
    } catch (err) {
      console.error('[useGoogleTrends] Error:', err);
      setError(err);
      setTrends(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchQueries = useCallback(async () => {
    try {
      const queries = await googleTrendsService.getQueries();
      setAvailableQueries(queries);
      return queries;
    } catch (err) {
      console.error('[useGoogleTrends] Error fetching queries:', err);
      setAvailableQueries([]);
      return [];
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    const init = async () => {
      try {
        const queries = await fetchQueries();
        // Use queries from filters if provided, otherwise use available queries, otherwise default
        const queriesToFetch = (filters.queries && filters.queries.length > 0) 
          ? filters.queries 
          : (queries.length > 0 ? queries : ['cruise holidays']);
        console.log('[useGoogleTrends] Initializing with queries:', queriesToFetch.length, 'queries');
        await fetchTrends({ queries: queriesToFetch });
      } catch (err) {
        console.error('[useGoogleTrends] Initialization error:', err);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const refetch = useCallback((newFilters) => {
    return fetchTrends(newFilters);
  }, [fetchTrends]);

  const fetchAndStore = useCallback(async (options) => {
    setLoading(true);
    setError(null);

    try {
      const trendsData = await googleTrendsService.fetchTrends(options);
      setTrends(trendsData);
      return trendsData;
    } catch (err) {
      console.error('[useGoogleTrends] Error fetching and storing:', err);
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const backfill = useCallback(async (options) => {
    setLoading(true);
    setError(null);

    try {
      const result = await googleTrendsService.backfillTrends(options);
      // After backfill, refetch trends
      await fetchTrends(filters);
      return result;
    } catch (err) {
      console.error('[useGoogleTrends] Error backfilling:', err);
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchTrends, filters]);

  return {
    trends,
    availableQueries,
    loading,
    error,
    refetch,
    fetchTrends,
    fetchAndStore,
    backfill
  };
};

