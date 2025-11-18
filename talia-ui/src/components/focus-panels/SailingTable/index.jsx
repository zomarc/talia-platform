/**
 * Sailing Table Container Component
 * Example of improved architecture - separates data fetching from presentation
 */

import React from 'react';
import { useSailingData } from '../../../hooks/data/useSailingData';
import SailingTablePresenter from './SailingTablePresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';

const SailingTableContainer = ({ filters = {}, theme }) => {
  const { data, loading, error, refetch } = useSailingData(filters);

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

