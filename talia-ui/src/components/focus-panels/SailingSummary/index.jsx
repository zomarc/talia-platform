/**
 * Sailing Summary Container Component
 * Aggregates sailing cabin occupancy data at the sail level
 * Uses useTableDataWithContext for data fetching (event-based)
 */

import React from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import SailingSummaryPresenter from './SailingSummaryPresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';
import { useTheme } from '../../../contexts/ThemeContext';

const SailingSummaryContainer = ({ theme: themeProp }) => {
  const { theme: themeContext } = useTheme();
  const theme = themeProp || themeContext;

  // Use reusable hook for context-based data fetching
  // Note: SailingSummary shows all data (no filtering), but listens to events for selection
  const { data, loading, error, refetch, context } = useTableDataWithContext({
    tableName: 'sail_by_cabin_occupancy',
    eventName: null, // Don't filter - show all sail data
    contextMapper: () => null, // No filtering
    limit: 10000 // Need more data for aggregation
  });

  // Handle loading state
  if (loading) {
    return <LoadingSpinner message="Loading sailing summary data..." fullScreen={false} />;
  }

  // Handle error state
  if (error) {
    return (
      <ErrorMessage 
        error={error} 
        title="Failed to load sailing summary data"
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
        color: theme?.colors?.foreground || '#ffffff'
      }}>
        <p>No sailing summary data available</p>
        <button 
          onClick={refetch}
          style={{
            marginTop: '16px',
            padding: '8px 16px',
            backgroundColor: theme?.colors?.accent || '#b08d57',
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
    <SailingSummaryPresenter 
      data={data} 
      theme={theme}
      onRefresh={refetch}
    />
  );
};

export default SailingSummaryContainer;

