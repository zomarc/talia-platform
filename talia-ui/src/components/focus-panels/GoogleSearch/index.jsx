/**
 * Google Search Container Component
 * Handles data fetching and state management
 * Follows the Container/Presenter pattern
 */

import React from 'react';
import { useGoogleSearch } from '../../../hooks/data/useGoogleSearch';
import GoogleSearchPresenter from './GoogleSearchPresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';
import { useTheme } from '../../../contexts/ThemeContext';

const GoogleSearchContainer = ({ initialQuery = '', searchOptions = {} }) => {
  const { theme } = useTheme();
  const { query, results, loading, error, search } = useGoogleSearch(initialQuery, searchOptions);

  // Handle loading state
  if (loading && !results) {
    return <LoadingSpinner message="Searching Google..." fullScreen={false} />;
  }

  // Handle error state
  if (error && !results) {
    return (
      <ErrorMessage 
        error={error} 
        title="Failed to search Google"
        onRetry={() => query && search(query)}
      />
    );
  }

  // Render presenter
  return (
    <GoogleSearchPresenter 
      results={results}
      query={query}
      loading={loading}
      onSearch={search}
      theme={theme}
    />
  );
};

export default GoogleSearchContainer;

