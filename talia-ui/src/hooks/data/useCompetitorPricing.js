/**
 * Custom hook for fetching competitor pricing data
 */

import { useState, useEffect, useCallback } from 'react';
import competitorPricingService from '../../services/data/competitorPricingService';

/**
 * Hook for competitor pricing data
 * @param {Object} filters - Filter options
 * @returns {Object} { data, loading, error, refetch }
 */
export const useCompetitorPricing = (filters = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await competitorPricingService.fetch(filters);
      setData(result);
    } catch (err) {
      console.error('[useCompetitorPricing] Error:', err);
      setError(err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
};

