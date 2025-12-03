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
import { useTheme } from '../../../contexts/ThemeContext';

const DemandHeatmapContainer = ({ filters = {} }) => {
  const { theme } = useTheme();
  
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

  // Handle loading state
  if (loading) {
    return <LoadingSpinner message="Loading demand heatmap..." fullScreen={false} />;
  }

  // Handle error state
  if (error) {
    return (
      <ErrorMessage 
        error={error} 
        title="Failed to load demand heatmap"
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
        <p>No demand data available</p>
        <p style={{ fontSize: '12px', color: 'var(--theme-text-secondary)', marginTop: '8px' }}>
          Demand data is calculated from reservation counts grouped by itinerary and departure month.
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
    <DemandHeatmapPresenter 
      data={data}
      months={months}
      theme={theme}
      onRefresh={refetch}
    />
  );
};

export default DemandHeatmapContainer;
