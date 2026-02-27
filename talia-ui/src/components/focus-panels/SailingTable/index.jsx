/**
 * Sailing Table Container Component
 * Uses useTableDataWithContext for consistent data fetching pattern
 * Shows all master_sail data, emits events when rows are selected
 */

import React from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import SailingTablePresenter from './SailingTablePresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';
const SailingTableContainer = () => {
  // Use reusable hook for context-based data fetching
  // Note: SailingTable shows all data (no filtering), but emits events when rows are selected
  const { data, loading, error, refetch } = useTableDataWithContext({
    tableName: 'master_sail',
    eventName: null, // Don't filter - show all sail data
    contextMapper: () => null, // No filtering
    limit: 1000
  });

  // Handle loading state
  if (loading) {
    return <LoadingSpinner message="Loading sailing data..." fullScreen={false} />;
  }

  // Handle error state
  if (error) {
    return (
      <ErrorMessage 
        error={error} 
        title="Failed to load sailing data"
        onRetry={refetch}
      />
    );
  }

  // Handle empty data
  if (!data || data.length === 0) {
    return (
      <div className="focus-panel-empty">
        <p>No sailing data available</p>
        <div className="focus-panel-empty__action">
          <button className="talia-btn talia-btn--primary" onClick={refetch}>Retry</button>
        </div>
      </div>
    );
  }

  // Render table with data
  return <SailingTablePresenter data={data} onRefresh={refetch} />;
};

export default SailingTableContainer;

