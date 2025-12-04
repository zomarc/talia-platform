/**
 * Google Trends Container Component
 * Shows historical Google Trends data for cruise holiday search terms
 * What people are searching for (not our searches)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { useGoogleTrends } from '../../../hooks/data/useGoogleTrends';
import googleTrendsService from '../../../services/data/googleTrendsService';
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

  // Refresh metadata state
  const [refreshMetadata, setRefreshMetadata] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load refresh metadata
  const loadRefreshMetadata = useCallback(async () => {
    try {
      const metadata = await googleTrendsService.getRefreshMetadata();
      setRefreshMetadata(metadata);
    } catch (err) {
      console.error('[GoogleTrendsContainer] Error loading refresh metadata:', err);
    }
  }, []);

  // Load refresh metadata on mount
  useEffect(() => {
    loadRefreshMetadata();
  }, [loadRefreshMetadata]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      // Use current selected queries and date range
      const startDate = trends?.dateRange?.from;
      const endDate = trends?.dateRange?.to;
      
      const result = await googleTrendsService.refreshTrends({
        queries: selectedQueries.length > 0 ? selectedQueries : undefined,
        startDate,
        endDate
      });

      // Update refresh metadata
      await loadRefreshMetadata();

      // Refetch trends data
      await refetch({ queries: selectedQueries, startDate, endDate });

    } catch (err) {
      console.error('[GoogleTrendsContainer] Error refreshing:', err);
      // Still reload metadata to show error status
      await loadRefreshMetadata();
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, selectedQueries, trends, refetch, loadRefreshMetadata]);

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


  const handleQueryChange = async (queries) => {
    setSelectedQueriesState(queries);
    await refetch({ queries });
  };
  
  const handleSelectedQueriesChange = async (newQueries) => {
    const previousQueries = selectedQueries;
    setSelectedQueriesState(newQueries);
    
    // Detect new queries that weren't in the previous list
    const newQueriesList = newQueries.filter(q => !previousQueries.includes(q));
    
    // If there are new queries, create them in the database and refresh data for only those
    if (newQueriesList.length > 0) {
      try {
        // Create search terms in database if they don't exist
        for (const query of newQueriesList) {
          try {
            await googleTrendsService.createSearchTerm({
              searchTerm: query,
              isActive: true
            });
          } catch (err) {
            // Ignore errors if term already exists (unique constraint)
            if (!err.message?.includes('already exists') && !err.message?.includes('duplicate')) {
              console.warn(`[GoogleTrendsContainer] Could not create search term "${query}":`, err.message);
            }
          }
        }
        
        // Refresh data for only the new queries
        const startDate = trends?.dateRange?.from || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = trends?.dateRange?.to || new Date().toISOString().split('T')[0];
        
        await googleTrendsService.refreshTrends({
          queries: newQueriesList,
          startDate,
          endDate
        });
      } catch (err) {
        console.error('[GoogleTrendsContainer] Error refreshing new queries:', err);
      }
    }
    
    // Refetch all trends data to include the new queries
    await refetch({ queries: newQueries });
  };

  const handleRegionChange = async (region) => {
    await refetch({ queries: selectedQueries, region });
  };

  const handleDateRangeChange = async (startDate, endDate) => {
    // CRITICAL: Always use current selectedQueries, explicitly pass them to ensure they're preserved
    const queriesToUse = selectedQueries && selectedQueries.length > 0 
      ? selectedQueries 
      : (availableQueries && availableQueries.length > 0 ? availableQueries : ['cruise holidays']);
    // Explicitly pass queries to override any stale filters in the hook
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
      refreshMetadata={refreshMetadata}
      refreshing={refreshing}
      onRefresh={handleRefresh}
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
