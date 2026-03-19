/**
 * Custom hook for fetching data debug information
 * Provides comprehensive data visibility for debugging
 */

import { useState, useEffect } from 'react';
import { trackedFetchGraphql } from '../../services/data/trackedGraphql';

const GRAPHQL_URL = '/api/graphql';

/**
 * Hook for fetching data debug info
 * @returns {Object} { data, loading, error, refetch }
 */
export const useDataDebugInfo = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const query = `
        query GetDataDebugInfo {
          dataDebugInfo {
            overview {
              shipCodes
              sailingDays {
                date
                shipCode
                sailCode
                capacity
                booked
                available
                year
                month
              }
              yearMonthBreakdown {
                year
                month
                capacity
                booked
                available
                sailingDays
              }
              totalCapacity
              totalBooked
            }
            tables {
              tableName
              rowCount
              lastSnapshotDate
              changesLastSync
              changes24Hours
              changesLastMonth
            }
          }
        }
      `;

      const payload = await trackedFetchGraphql({
        url: GRAPHQL_URL,
        query,
        variables: {},
        tableName: 'data_debug_info',
        component: 'Data Debug Info',
        purpose: 'Fetch data debug info from talia graphql'
      });

      if (!payload?.dataDebugInfo) {
        throw new Error('No data returned from dataDebugInfo query');
      }

      setData(payload.dataDebugInfo);
    } catch (err) {
      console.error('[useDataDebugInfo] Error:', err);
      setError(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchData
  };
};

