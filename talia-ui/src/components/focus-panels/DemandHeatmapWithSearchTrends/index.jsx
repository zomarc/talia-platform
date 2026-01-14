/**
 * Demand Heatmap with Search Trends Container Component
 * Combines demand heatmap data with search trends to show correlations
 * NEW component - does not modify existing DemandHeatmap component
 */

import React, { useState, useMemo } from 'react';
import { useDemandHeatmap } from '../../../hooks/data/useDemandHeatmap';
import { useSearchTrends } from '../../../hooks/data/useSearchTrends';
import DemandHeatmapWithSearchTrendsPresenter from './DemandHeatmapWithSearchTrendsPresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';
import { useTheme } from '../../../contexts/ThemeContext';

const DemandHeatmapWithSearchTrendsContainer = ({ filters = {} }) => {
  const { theme } = useTheme();
  
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
    trackedQueries, 
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
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        color: 'var(--theme-fg)'
      }}>
        <p>No data available</p>
        <p style={{ fontSize: '12px', color: 'var(--theme-text-secondary)', marginTop: '8px' }}>
          This component combines demand heatmap data with search trends to show correlations.
        </p>
        <button 
          onClick={() => {
            refetchHeatmap();
            refetchTrends();
          }}
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

  // Render presenter with combined data
  return (
    <DemandHeatmapWithSearchTrendsPresenter 
      heatmapData={heatmapData || []}
      months={heatmapMonths}
      searchTrends={searchTrends}
      combinedData={combinedData}
      trackedQueries={trackedQueries}
      containsMockData={containsMockData}
      theme={theme}
      onRefresh={() => {
        refetchHeatmap();
        refetchTrends();
      }}
    />
  );
};

export default DemandHeatmapWithSearchTrendsContainer;




