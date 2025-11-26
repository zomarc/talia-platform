/**
 * Custom hook for fetching booking profile data
 * Provides booking trends and metrics for a specific sailing
 */

import { useState, useEffect } from 'react';
import bookingProfileService from '../../services/data/bookingProfileService';

/**
 * Hook for fetching booking profile
 * @param {string} sailCode - Sail code (e.g., "CJ07250901")
 * @param {Object} options - Options { includeComparison: boolean, previousYearSailCode: string }
 * @returns {Object} { data, loading, error, refetch }
 */
export const useBookingProfile = (sailCode, options = {}) => {
  const { includeComparison = false, previousYearSailCode = null } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    if (!sailCode) {
      setLoading(false);
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      let result;
      if (includeComparison) {
        const prevSailCode = previousYearSailCode || 
          bookingProfileService.generatePreviousYearSailCode(sailCode);
        result = await bookingProfileService.fetchWithComparison(sailCode, prevSailCode);
      } else {
        result = await bookingProfileService.fetch(sailCode);
      }
      setData(result);
    } catch (err) {
      console.error('[useBookingProfile] Error:', err);
      setError(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [sailCode, includeComparison, previousYearSailCode]);

  return {
    data,
    loading,
    error,
    refetch: fetchData
  };
};


