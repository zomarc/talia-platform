/**
 * Demand Heatmap with Search Trends Container Component
 * Combines demand heatmap data with search trends to show correlations
 * NEW component - does not modify existing DemandHeatmap component
 */

import React, { useMemo } from 'react';
import { useDemandHeatmap } from '../../../hooks/data/useDemandHeatmap';
import { useSearchTrends } from '../../../hooks/data/useSearchTrends';
import DemandHeatmapWithSearchTrendsPresenter from './DemandHeatmapWithSearchTrendsPresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';

const DemandHeatmapWithSearchTrendsContainer = ({ filters = {} }) => {
  console.log('[DemandHeatmapWithSearchTrendsContainer] Component rendering with filters:', filters);
  
  // Fetch both data sources
  const { 
    data: heatmapData, 
    months: heatmapMonths, 
    containsMockData, 
    loading: heatmapLoading, 
    error: heatmapError, 
    refetch: refetchHeatmap 
  } = useDemandHeatmap(filters);
  
  const { 
    trends: searchTrends, 
    loading: trendsLoading, 
    error: trendsError, 
    refetch: refetchTrends 
  } = useSearchTrends(filters);

  const loading = heatmapLoading || trendsLoading;
  const error = heatmapError || trendsError;

  // Combine data for correlation analysis
  const combinedData = useMemo(() => {
    if (!heatmapData || !searchTrends) return null;

    // Map search trends by month to correlate with heatmap months
    const trendsByMonth = {};
    if (searchTrends.series && searchTrends.series.length > 0) {
      searchTrends.series.forEach(series => {
        series.dataPoints.forEach(point => {
          const date = new Date(point.date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          if (!trendsByMonth[monthKey]) {
            trendsByMonth[monthKey] = [];
          }
          trendsByMonth[monthKey].push({
            query: series.query,
            totalResults: point.totalResults,
            changePercent: series.changePercent
          });
        });
      });
    }

    // Enhance heatmap rows with search trend data
    return heatmapData.map(row => {
      const enhancedRow = { ...row };
      heatmapMonths.forEach(month => {
        const trendData = trendsByMonth[month];
        if (trendData && trendData.length > 0) {
          // Calculate average search results for this month across all queries
          const avgResults = trendData.reduce((sum, t) => sum + t.totalResults, 0) / trendData.length;
          const maxResults = Math.max(...trendData.map(t => t.totalResults));
          enhancedRow[`${month}_searchTrends`] = {
            average: avgResults,
            max: maxResults,
            queries: trendData.length,
            data: trendData
          };
        }
      });
      return enhancedRow;
    });
  }, [heatmapData, heatmapMonths, searchTrends]);

  // Handle loading state
  if (loading && (!heatmapData || !searchTrends)) {
    return <LoadingSpinner message="Loading demand heatmap and search trends..." fullScreen={false} />;
  }

  // Handle error state
  if (error && (!heatmapData || !searchTrends)) {
    return (
      <ErrorMessage 
        error={error} 
        title="Failed to load data"
        onRetry={() => {
          refetchHeatmap();
          refetchTrends();
        }}
      />
    );
  }

  // Handle empty data
  if ((!heatmapData || heatmapData.length === 0) && (!searchTrends || !searchTrends.series || searchTrends.series.length === 0)) {
    return (
      <div className="focus-panel-empty">
        <p>No data available</p>
        <p className="focus-panel-empty__detail">
          This component combines demand heatmap data with search trends to show correlations.
        </p>
        <div className="focus-panel-empty__action">
          <button 
            className="talia-btn talia-btn--primary"
            onClick={() => {
              refetchHeatmap();
              refetchTrends();
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render presenter with combined data
  return (
    <DemandHeatmapWithSearchTrendsPresenter 
      heatmapData={heatmapData || []}
      months={heatmapMonths}
      searchTrends={searchTrends}
      combinedData={combinedData}
      containsMockData={containsMockData}
      onRefresh={() => {
        refetchHeatmap();
        refetchTrends();
      }}
    />
  );
};

export default DemandHeatmapWithSearchTrendsContainer;




