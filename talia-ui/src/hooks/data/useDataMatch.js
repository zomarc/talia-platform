/**
 * Custom hook for fetching data match/completeness data
 */

import { useState, useEffect } from 'react';

const GRAPHQL_URL = '/api/graphql';

export const useDataMatch = (filters = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const query = `
        query GetDataMatch($filters: DataMatchFilters) {
          dataMatch(filters: $filters) {
            rows {
              ship_code
              departure_date
              sail_code
              tableMatches {
                tableName
                matchingCount
                missingCount
              }
            }
            tables
          }
        }
      `;

      const variables = {
        filters: Object.keys(filters).length > 0 ? filters : undefined
      };

      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      setData(result.data?.dataMatch || null);
    } catch (err) {
      console.error('[useDataMatch] Error:', err);
      setError(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [JSON.stringify(filters)]);

  return {
    data,
    loading,
    error,
    refetch: fetchData
  };
};

