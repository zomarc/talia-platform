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
const SailingSummaryContainer = () => {

  // Use reusable hook for context-based data fetching
  // Note: SailingSummary shows all data (no filtering), but listens to events for selection
  const { data, loading, error, refetch } = useTableDataWithContext({
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
      <div className="focus-panel-empty">
        <p>No sailing summary data available</p>
        <div className="focus-panel-empty__action">
          <button 
            onClick={refetch}
            className="talia-btn talia-btn--primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render presenter with data
  return (
    <SailingSummaryPresenter 
      data={data} 
      onRefresh={refetch}
    />
  );
};

export default SailingSummaryContainer;

