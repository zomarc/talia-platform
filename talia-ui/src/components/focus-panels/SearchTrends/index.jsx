/**
 * Search Trends Container Component
 * Handles data fetching and state management
 * Follows the Container/Presenter pattern
 */

import React from 'react';
import { useSearchTrends } from '../../../hooks/data/useSearchTrends';
import SearchTrendsPresenter from './SearchTrendsPresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';
import { useTheme } from '../../../contexts/ThemeContext';

const SearchTrendsContainer = ({ filters = {} }) => {
  const { theme } = useTheme();
  const { trends, trackedQueries, loading, error, refetch } = useSearchTrends(filters);

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
      onQuerySelect={(query) => {
        // Could filter by query or show details
        console.log('Selected query:', query);
      }}
      theme={theme}
    />
  );
};

export default SearchTrendsContainer;

