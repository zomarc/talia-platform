/**
 * Demand Heatmap Container Component
 * Handles data fetching and state management
 * Follows the Container/Presenter pattern for consistency
 */

import React from 'react';
import { useDemandHeatmap } from '../../../hooks/data/useDemandHeatmap';
import DemandHeatmapPresenter from './DemandHeatmapPresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';

const DemandHeatmapContainer = ({ filters = {}, panelInstanceId, panelComponentId }) => {
  console.log('[DemandHeatmapContainer] Component rendering with filters:', filters);
  
  const { data, months, containsMockData, loading, error, refetch } = useDemandHeatmap(filters);
  
  // Expose mock data flag for TestPage
  React.useEffect(() => {
    if (containsMockData) {
      window._componentMockDataFlags = window._componentMockDataFlags || {};
      window._componentMockDataFlags.DemandHeatmap = true;
    } else {
      window._componentMockDataFlags = window._componentMockDataFlags || {};
      window._componentMockDataFlags.DemandHeatmap = false;
    }
  }, [containsMockData]);

  console.log('[DemandHeatmapContainer] State:', { 
    loading, 
    error: error?.message, 
    dataLength: data?.length,
    monthsCount: months?.length 
  });

  // Initial load only — keep prior content so ReportShell can grey-out while refreshing.
  if (loading && (!data || data.length === 0)) {
    return <LoadingSpinner message="Loading demand heatmap..." fullScreen={false} />;
  }

  if (error && (!data || data.length === 0)) {
    return (
      <ErrorMessage 
        error={error} 
        title="Failed to load demand heatmap"
        onRetry={refetch}
      />
    );
  }

  if (!loading && (!data || data.length === 0)) {
    return (
      <div className="focus-panel-empty">
        <p>No demand data available</p>
        <p className="focus-panel-empty__detail">
          Demand data is calculated from reservation counts grouped by itinerary and departure month.
        </p>
        <div className="focus-panel-empty__action">
          <button className="talia-btn talia-btn--primary" onClick={refetch}>Retry</button>
        </div>
      </div>
    );
  }

  // Render presenter with data
  return (
    <DemandHeatmapPresenter 
      data={data}
      months={months}
      onRefresh={refetch}
      panelInstanceId={panelInstanceId}
      panelComponentId={panelComponentId}
    />
  );
};

export default DemandHeatmapContainer;
