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

const MasterVoyagePerformanceSummaryContainer = ({ panelInstanceId, panelComponentId }) => {

  // Use reusable hook for context-based data fetching
  // Show all master_sail data without filtering
  const { data, loading, error, refetch } = useTableDataWithContext({
    tableName: 'master_sail',
    eventName: null, // Don't filter - show all sail data
    panelInstanceId,
    panelComponentId,
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
      <div className="focus-panel-empty">
        <p>No voyage performance data available</p>
        <div className="focus-panel-empty__action">
          <button className="talia-btn talia-btn--primary" onClick={refetch}>Retry</button>
        </div>
      </div>
    );
  }

  // Render component with transformed data
  return (
    <MasterVoyagePerformanceSummaryPresenter 
      data={transformedData} 
      onRefresh={refetch}
      panelInstanceId={panelInstanceId}
      panelComponentId={panelComponentId}
    />
  );
};

export default MasterVoyagePerformanceSummaryContainer;
