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
import { useTheme } from '../../../contexts/ThemeContext';

const SailingTableContainer = ({ filters = {}, theme: themeProp }) => {
  const { theme: themeContext } = useTheme();
  const theme = themeProp || themeContext;

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
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>No sailing data available</p>
        <button onClick={refetch}>Retry</button>
      </div>
    );
  }

  // Render table with data
  return (
    <SailingTablePresenter 
      data={data} 
      theme={theme}
      onRefresh={refetch}
    />
  );
};

export default SailingTableContainer;

