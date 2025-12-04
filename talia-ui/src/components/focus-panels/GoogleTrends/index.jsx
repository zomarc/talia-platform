/**
 * Google Trends Container Component
 * Shows historical Google Trends data for cruise holiday search terms
 * What people are searching for (not our searches)
 */

import React, { useEffect, useState } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { useGoogleTrends } from '../../../hooks/data/useGoogleTrends';
import GoogleTrendsPresenter from './GoogleTrendsPresenter';

const STORAGE_KEY = 'googleTrendsSelectedQueries';

const GoogleTrendsContainer = () => {
  const { theme } = useTheme();
  
  // Load selected queries from localStorage or use default
  const loadSelectedQueriesFromStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[GoogleTrendsContainer] Error loading from localStorage:', e);
    }
    return ['cruise holidays'];
  };

  const [selectedQueries, setSelectedQueriesState] = useState(loadSelectedQueriesFromStorage);
  
  // Save to localStorage whenever selectedQueries changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedQueries));
    } catch (e) {
      console.warn('[GoogleTrendsContainer] Error saving to localStorage:', e);
    }
  }, [selectedQueries]);

  const { trends, availableQueries, loading, error, refetch, fetchAndStore, backfill } = useGoogleTrends({
    queries: selectedQueries,
  });

  // Update selected queries when availableQueries loads - use all available queries if we only have the default
  useEffect(() => {
    if (availableQueries.length > 0 && selectedQueries.length === 1 && selectedQueries[0] === 'cruise holidays') {
      // If we only have the default query, replace with all available queries (up to 20 for better coverage)
      const initialQueries = availableQueries.slice(0, Math.min(20, availableQueries.length));
      if (initialQueries.length > 1) {
        setSelectedQueriesState(initialQueries);
      }
    }
  }, [availableQueries, selectedQueries]);

  // Log state for debugging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[GoogleTrendsContainer] State:', {
        hasTrends: !!trends,
        seriesCount: trends?.series?.length,
        totalDataPoints: trends?.totalDataPoints,
        availableQueries: availableQueries.length,
        selectedQueries: selectedQueries.length,
        selectedQueriesList: selectedQueries,
        loading,
        error: error?.message
      });
    }
  }, [trends, availableQueries, selectedQueries, loading, error]);

  const handleQueryChange = async (queries) => {
    setSelectedQueriesState(queries);
    await refetch({ queries });
  };
  
  const handleSelectedQueriesChange = async (newQueries) => {
    setSelectedQueriesState(newQueries);
    await refetch({ queries: newQueries });
  };

  const handleRegionChange = async (region) => {
    await refetch({ queries: selectedQueries, region });
  };

  const handleDateRangeChange = async (startDate, endDate) => {
    // Preserve currently selected queries when filtering by date
    const queriesToUse = selectedQueries.length > 0 
      ? selectedQueries 
      : (availableQueries.length > 0 ? availableQueries : ['cruise holidays']);
    console.log('[GoogleTrendsContainer] Date range change - preserving queries:', queriesToUse.length, 'queries');
    await refetch({ queries: queriesToUse, startDate, endDate });
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
      selectedQueries={selectedQueries}
      loading={loading}
      error={error}
      onQueryChange={handleQueryChange}
      onSelectedQueriesChange={handleSelectedQueriesChange}
      onRegionChange={handleRegionChange}
      onDateRangeChange={handleDateRangeChange}
      onFetchAndStore={handleFetchAndStore}
      onBackfill={handleBackfill}
      theme={theme}
    />
  );
};

export default GoogleTrendsContainer;
