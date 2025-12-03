/**
 * Search Trends Presenter
 * Displays search trends in a clean, informative UI showing what people are searching for
 */

import React, { useMemo } from 'react';

const SearchTrendsPresenter = ({ trends, trackedQueries, loading, onQuerySelect, theme }) => {
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0';
    return num.toLocaleString();
  };

  // Calculate max value for scaling charts
  const maxResults = useMemo(() => {
    if (!trends || !trends.series || trends.series.length === 0) return 1;
    return Math.max(...trends.series.flatMap(s => s.dataPoints.map(dp => dp.totalResults)));
  }, [trends]);

  // Color palette for different queries
  const colors = [
    '#1976d2', '#4caf50', '#ff9800', '#9c27b0', '#e91e63',
    '#00bcd4', '#8bc34a', '#ff5722', '#673ab7', '#f44336'
  ];

  if (loading) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        color: theme?.colors?.foreground || '#e0e0e0'
      }}>
        <p>Loading search trends...</p>
      </div>
    );
  }

  if (!trends || trends.series.length === 0) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        color: theme?.colors?.foreground || '#e0e0e0'
      }}>
        <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
          Search Trends
        </h3>
        <p style={{ color: theme?.colors?.textSecondary || '#999', marginBottom: '8px' }}>
          No trend data available yet
        </p>
        <p style={{ fontSize: '14px', color: theme?.colors?.textSecondary || '#999' }}>
          Start tracking searches to see trends over time
        </p>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px',
      color: theme?.colors?.foreground || '#e0e0e0',
      fontFamily: theme?.typography?.fontFamily || 'Roboto, sans-serif'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ 
          margin: '0 0 8px 0', 
          fontSize: '20px', 
          fontWeight: '600',
          color: theme?.colors?.foreground || '#e0e0e0'
        }}>
          Search Trends - What People Are Looking For
        </h3>
        <p style={{ 
          fontSize: '14px', 
          color: theme?.colors?.textSecondary || '#999',
          margin: 0
        }}>
          Tracking {trends.queries.length} search {trends.queries.length === 1 ? 'query' : 'queries'} from {formatDate(trends.dateRange.from)} to {formatDate(trends.dateRange.to)}
        </p>
      </div>

      {/* Trend Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '16px',
        marginBottom: '32px'
      }}>
        {trends.series.map((series, index) => {
          const color = colors[index % colors.length];
          const isPositive = series.changePercent >= 0;
          
          return (
            <div
              key={series.query}
              style={{
                padding: '20px',
                backgroundColor: theme?.colors?.background || '#1e1e1e',
                border: `1px solid ${theme?.colors?.border || '#333'}`,
                borderRadius: '8px',
                cursor: onQuerySelect ? 'pointer' : 'default',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (onQuerySelect) {
                  e.currentTarget.style.borderColor = color;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseLeave={(e) => {
                if (onQuerySelect) {
                  e.currentTarget.style.borderColor = theme?.colors?.border || '#333';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
              onClick={() => onQuerySelect && onQuerySelect(series.query)}
            >
              {/* Query Header */}
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ 
                  margin: '0 0 8px 0',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: theme?.colors?.foreground || '#e0e0e0'
                }}>
                  "{series.query}"
                </h4>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: '12px',
                  fontSize: '14px'
                }}>
                  <span style={{ 
                    color: theme?.colors?.textSecondary || '#999'
                  }}>
                    Latest: <strong style={{ color: theme?.colors?.foreground || '#e0e0e0' }}>
                      {formatNumber(series.latestCount)} results
                    </strong>
                  </span>
                </div>
              </div>

              {/* Trend Indicator */}
              {series.changePercent !== 0 && (
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                  padding: '8px 12px',
                  backgroundColor: isPositive 
                    ? 'rgba(76, 175, 80, 0.1)' 
                    : 'rgba(244, 67, 54, 0.1)',
                  borderRadius: '4px'
                }}>
                  <span style={{ 
                    fontSize: '20px',
                    color: isPositive ? '#4caf50' : '#f44336'
                  }}>
                    {isPositive ? '📈' : '📉'}
                  </span>
                  <span style={{ 
                    fontSize: '14px',
                    fontWeight: '600',
                    color: isPositive ? '#4caf50' : '#f44336'
                  }}>
                    {isPositive ? '+' : ''}{series.changePercent.toFixed(1)}% 
                    ({isPositive ? '+' : ''}{formatNumber(series.change)} results)
                  </span>
                </div>
              )}

              {/* Mini Chart */}
              {series.dataPoints.length > 0 && (
                <div style={{
                  marginTop: '16px',
                  height: '80px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '4px',
                  padding: '8px',
                  backgroundColor: theme?.colors?.backgroundSecondary || '#2a2a2a',
                  borderRadius: '4px'
                }}>
                  {series.dataPoints.map((point, idx) => {
                    const heightPercent = maxResults > 0 
                      ? (point.totalResults / maxResults) * 100 
                      : 0;
                    
                    return (
                      <div
                        key={idx}
                        style={{
                          flex: 1,
                          height: `${Math.max(heightPercent, 5)}%`,
                          backgroundColor: color,
                          borderRadius: '2px 2px 0 0',
                          minHeight: '4px',
                          transition: 'height 0.3s ease',
                          position: 'relative'
                        }}
                        title={`${formatDate(point.date)}: ${formatNumber(point.totalResults)} results`}
                      />
                    );
                  })}
                </div>
              )}

              {/* Data Point Count */}
              <div style={{
                marginTop: '12px',
                fontSize: '12px',
                color: theme?.colors?.textSecondary || '#666',
                textAlign: 'center'
              }}>
                {series.dataPoints.length} data {series.dataPoints.length === 1 ? 'point' : 'points'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tracked Queries List */}
      {trackedQueries && trackedQueries.length > 0 && (
        <div style={{
          marginTop: '32px',
          padding: '16px',
          backgroundColor: theme?.colors?.backgroundSecondary || '#2a2a2a',
          borderRadius: '8px',
          border: `1px solid ${theme?.colors?.border || '#333'}`
        }}>
          <h4 style={{ 
            margin: '0 0 12px 0',
            fontSize: '14px',
            fontWeight: '600',
            color: theme?.colors?.foreground || '#e0e0e0'
          }}>
            Currently Tracking ({trackedQueries.length})
          </h4>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            {trackedQueries.map((query, idx) => (
              <span
                key={idx}
                style={{
                  padding: '6px 12px',
                  backgroundColor: theme?.colors?.background || '#1e1e1e',
                  border: `1px solid ${theme?.colors?.border || '#444'}`,
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: theme?.colors?.foreground || '#e0e0e0'
                }}
              >
                "{query}"
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchTrendsPresenter;

