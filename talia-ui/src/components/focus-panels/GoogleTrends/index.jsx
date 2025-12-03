/**
 * Google Trends Container Component
 * Shows historical Google Trends data for cruise holiday search terms
 * What people are searching for (not our searches)
 */

import React, { useEffect } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { useGoogleTrends } from '../../../hooks/data/useGoogleTrends';
import GoogleTrendsPresenter from './GoogleTrendsPresenter';

const GoogleTrendsContainer = () => {
  const { theme } = useTheme();
  const { trends, availableQueries, loading, error, refetch, fetchAndStore, backfill } = useGoogleTrends({
    queries: ['cruise holidays'], // Start with available query from DB
  });

  // Log state for debugging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[GoogleTrendsContainer] State:', {
        hasTrends: !!trends,
        seriesCount: trends?.series?.length,
        totalDataPoints: trends?.totalDataPoints,
        availableQueries: availableQueries.length,
        loading,
        error: error?.message
      });
    }
  }, [trends, availableQueries, loading, error]);

  const handleQueryChange = async (queries) => {
    await refetch({ queries });
  };

  const handleRegionChange = async (region) => {
    await refetch({ region });
  };

  const handleDateRangeChange = async (startDate, endDate) => {
    await refetch({ startDate, endDate });
  };

  const handleFetchAndStore = async (options) => {
    try {
      await fetchAndStore(options);
    } catch (err) {
      console.error('[GoogleTrendsContainer] Error fetching and storing:', err);
    }
  };

  const handleBackfill = async (queries, startDate, endDate, region) => {
    try {
      await backfill({
        queries: Array.isArray(queries) ? queries : [queries],
        startDate,
        endDate,
        region
      });
    } catch (err) {
      console.error('[GoogleTrendsContainer] Error backfilling:', err);
    }
  };

  return (
    <GoogleTrendsPresenter
      trends={trends}
      availableQueries={availableQueries}
      loading={loading}
      error={error}
      onQueryChange={handleQueryChange}
      onRegionChange={handleRegionChange}
      onDateRangeChange={handleDateRangeChange}
      onFetchAndStore={handleFetchAndStore}
      onBackfill={handleBackfill}
      theme={theme}
    />
  );
};

export default GoogleTrendsContainer;

