/**
 * Custom hook for fetching data debug information
 * Provides comprehensive data visibility for debugging
 */

import { useState, useEffect } from 'react';

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

      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        const errorMessage = result.errors[0]?.message || JSON.stringify(result.errors);
        console.error('[useDataDebugInfo] GraphQL errors:', result.errors);
        throw new Error(`GraphQL error: ${errorMessage}`);
      }

      if (!result.data?.dataDebugInfo) {
        throw new Error('No data returned from dataDebugInfo query');
      }

      setData(result.data.dataDebugInfo);
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

