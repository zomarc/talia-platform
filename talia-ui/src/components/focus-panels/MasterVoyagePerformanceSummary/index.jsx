/**
 * Master Voyage Performance Summary Container Component
 * Uses useTableDataWithContext for consistent data fetching pattern
 * Transforms master_sail data into hierarchical structure with mock data
 */

import React, { useMemo } from 'react';
import { useTableDataWithContext } from '../../../hooks/data/useTableDataWithContext';
import MasterVoyagePerformanceSummaryPresenter from './MasterVoyagePerformanceSummaryPresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';
import { transformVoyageData } from './utils/dataTransformation';

const MasterVoyagePerformanceSummaryContainer = ({ filters = {}, theme: themeProp }) => {
  // Use theme prop if provided, otherwise use default
  const theme = themeProp || { colors: { foreground: '#ffffff', background: '#1a1a1a' } };

  // Use reusable hook for context-based data fetching
  // Show all master_sail data without filtering
  const { data, loading, error, refetch } = useTableDataWithContext({
    tableName: 'master_sail',
    eventName: null, // Don't filter - show all sail data
    contextMapper: () => null, // No filtering
    limit: 1000
  });

  // Transform raw data into hierarchical structure with mock columns
  const transformedData = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }
    return transformVoyageData(data);
  }, [data]);

  // Handle loading state
  if (loading) {
    return <LoadingSpinner message="Loading voyage performance data..." fullScreen={false} />;
  }

  // Handle error state
  if (error) {
    return (
      <ErrorMessage 
        error={error} 
        title="Failed to load voyage performance data"
        onRetry={refetch}
      />
    );
  }

  // Handle empty data
  if (!transformedData || transformedData.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>No voyage performance data available</p>
        <button onClick={refetch}>Retry</button>
      </div>
    );
  }

  // Render component with transformed data
  return (
    <MasterVoyagePerformanceSummaryPresenter 
      data={transformedData} 
      theme={theme}
      onRefresh={refetch}
    />
  );
};

export default MasterVoyagePerformanceSummaryContainer;
