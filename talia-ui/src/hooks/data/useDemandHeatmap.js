/**
 * Custom hook for fetching demand heatmap data
 */

import { useState, useEffect } from 'react';
import demandHeatmapService from '../../services/data/demandHeatmapService';

/**
 * Hook for fetching demand heatmap data
 * @param {Object} filters - Filters for data (dateFrom, dateTo, region, geogAreaCode)
 * @returns {Object} { data, months, loading, error, refetch }
 */
export const useDemandHeatmap = (filters = {}) => {
  const [data, setData] = useState(null);
  const [months, setMonths] = useState([]);
  const [containsMockData, setContainsMockData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await demandHeatmapService.fetch(filters);
      setData(result.data || []);
      setMonths(result.months || []);
      setContainsMockData(result.containsMockData || false);
    } catch (err) {
      console.error('[useDemandHeatmap] Error:', err);
      setError(err);
      setData([]);
      setMonths([]);
      setContainsMockData(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [JSON.stringify(filters)]);

  return {
    data,
    months,
    containsMockData,
    loading,
    error,
    refetch: fetchData
  };
};

export default useDemandHeatmap;
