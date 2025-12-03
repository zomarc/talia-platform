/**
 * Search Trends Container Component
 * Handles data fetching and state management
 * Follows the Container/Presenter pattern
 */

import React, { useState } from 'react';
import { useSearchTrends } from '../../../hooks/data/useSearchTrends';
import SearchTrendsPresenter from './SearchTrendsPresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';
import { useTheme } from '../../../contexts/ThemeContext';
import searchTrendsService from '../../../services/data/searchTrendsService';

const SearchTrendsContainer = ({ filters = {} }) => {
  const { theme } = useTheme();
  const { trends, trackedQueries, loading, error, refetch } = useSearchTrends(filters);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState(null);

  const handleBackfill = async (query, monthsBack = 6) => {
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const result = await searchTrendsService.backfillHistoricalTrends(query, monthsBack);
      setBackfillResult(result);
      // Refresh trends after backfill
      setTimeout(() => refetch(), 1000);
    } catch (err) {
      console.error('Error backfilling:', err);
      setBackfillResult({ error: err.message });
    } finally {
      setBackfilling(false);
    }
  };

  // Handle loading state
  if (loading && !trends) {
    return <LoadingSpinner message="Loading search trends..." fullScreen={false} />;
  }

  // Handle error state
  if (error && !trends) {
    return (
      <ErrorMessage 
        error={error} 
        title="Failed to load search trends"
        onRetry={() => refetch(filters)}
      />
    );
  }

  // Render presenter
  return (
    <SearchTrendsPresenter 
      trends={trends}
      trackedQueries={trackedQueries}
      loading={loading}
      backfilling={backfilling}
      backfillResult={backfillResult}
      onQuerySelect={(query) => {
        // Could filter by query or show details
        console.log('Selected query:', query);
      }}
      onBackfill={handleBackfill}
      theme={theme}
    />
  );
};

export default SearchTrendsContainer;

