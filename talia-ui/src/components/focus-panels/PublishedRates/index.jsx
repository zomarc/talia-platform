/**
 * Published Rates Container Component
 * Handles data fetching and state management
 * Follows the _TEMPLATE pattern for consistency
 */

import React from 'react';
import { usePublishedRatesBySail } from '../../../hooks/data/usePublishedRatesData';
import PublishedRatesPresenter from './PublishedRatesPresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';
import { useTheme } from '../../../contexts/ThemeContext';

const PublishedRatesContainer = ({ filters = {} }) => {
  const { theme } = useTheme();
  
  console.log('[PublishedRatesContainer] Component rendering');
  
  // Use hook that listens to sail selection events
  const { data, loading, error, refetch, selectedSailCode } = usePublishedRatesBySail({
    listenToSailEvents: true
  });

  console.log('[PublishedRatesContainer] State:', { loading, error: error?.message, dataLength: data?.length, selectedSailCode });

  // Handle loading state
  if (loading) {
    return <LoadingSpinner message="Loading published rates..." fullScreen={false} />;
  }

  // Handle error state
  if (error) {
    return (
      <ErrorMessage 
        error={error} 
        title="Failed to load published rates"
        onRetry={refetch}
      />
    );
  }

  // Handle empty data
  if (!data || data.length === 0) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        color: 'var(--theme-fg)'
      }}>
        <p>
          {selectedSailCode 
            ? `No published rates found for sail code: ${selectedSailCode}`
            : 'No published rates data available'}
        </p>
        <button 
          onClick={refetch}
          style={{
            marginTop: '16px',
            padding: '8px 16px',
            backgroundColor: 'var(--theme-accent)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Render presenter with data
  return (
    <PublishedRatesPresenter 
      data={data} 
      theme={theme}
      onRefresh={refetch}
      selectedSailCode={selectedSailCode}
    />
  );
};

export default PublishedRatesContainer;

