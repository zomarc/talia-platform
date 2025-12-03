/**
 * Search Trends Presenter
 * Displays search trends in a clean, informative UI showing what people are searching for
 */

import React, { useMemo } from 'react';

const SearchTrendsPresenter = ({ trends, trackedQueries, loading, backfilling, backfillResult, onQuerySelect, onBackfill, theme }) => {
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
        <p style={{ color: theme?.colors?.textSecondary || '#999', marginBottom: '16px' }}>
          No trend data available yet
        </p>
        <p style={{ fontSize: '14px', color: theme?.colors?.textSecondary || '#999', marginBottom: '24px' }}>
          Start tracking searches to see trends over time, or backfill historical data
        </p>
        {onBackfill && (
          <div style={{ marginTop: '24px' }}>
            <p style={{ fontSize: '13px', color: theme?.colors?.textSecondary || '#999', marginBottom: '12px' }}>
              Get historical trends for a query:
            </p>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const query = formData.get('backfillQuery');
              const monthsBack = parseInt(formData.get('monthsBack') || '6', 10);
              if (query && query.trim()) {
                onBackfill(query.trim(), monthsBack);
              }
            }}>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', maxWidth: '500px', margin: '0 auto' }}>
                <input
                  type="text"
                  name="backfillQuery"
                  placeholder="e.g., cruise holidays"
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '14px',
                    border: `1px solid ${theme?.colors?.border || '#444'}`,
                    borderRadius: '4px',
                    backgroundColor: theme?.colors?.background || '#1e1e1e',
                    color: theme?.colors?.foreground || '#e0e0e0',
                    outline: 'none'
                  }}
                  disabled={backfilling}
                />
                <input
                  type="number"
                  name="monthsBack"
                  placeholder="Months"
                  defaultValue="6"
                  min="1"
                  max="12"
                  style={{
                    width: '80px',
                    padding: '8px 12px',
                    fontSize: '14px',
                    border: `1px solid ${theme?.colors?.border || '#444'}`,
                    borderRadius: '4px',
                    backgroundColor: theme?.colors?.background || '#1e1e1e',
                    color: theme?.colors?.foreground || '#e0e0e0',
                    outline: 'none'
                  }}
                  disabled={backfilling}
                />
                <button
                  type="submit"
                  disabled={backfilling}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    backgroundColor: backfilling 
                      ? (theme?.colors?.accent || '#1976d2') + '80'
                      : (theme?.colors?.accent || '#1976d2'),
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: backfilling ? 'not-allowed' : 'pointer',
                    fontWeight: '500'
                  }}
                >
                  {backfilling ? 'Backfilling...' : 'Get Historical Data'}
                </button>
              </div>
            </form>
            {backfillResult && (
              <div style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: backfillResult.error 
                  ? 'rgba(244, 67, 54, 0.1)' 
                  : 'rgba(76, 175, 80, 0.1)',
                borderRadius: '4px',
                fontSize: '13px',
                color: backfillResult.error 
                  ? '#f44336' 
                  : theme?.colors?.foreground || '#e0e0e0'
              }}>
                {backfillResult.error ? (
                  <span>❌ Error: {backfillResult.error}</span>
                ) : (
                  <span>
                    ✅ Backfilled {backfillResult.dataPointsStored} data points for "{backfillResult.query}"
                    ({backfillResult.dateRange.from} to {backfillResult.dateRange.to})
                  </span>
                )}
              </div>
            )}
          </div>
        )}
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

      {/* Historical Data Backfill Section */}
      {onBackfill && (
        <div style={{
          marginTop: '32px',
          padding: '20px',
          backgroundColor: theme?.colors?.backgroundSecondary || '#2a2a2a',
          borderRadius: '8px',
          border: `1px solid ${theme?.colors?.border || '#333'}`
        }}>
          <h4 style={{ 
            margin: '0 0 12px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: theme?.colors?.foreground || '#e0e0e0'
          }}>
            📊 Get Historical Trends
          </h4>
          <p style={{ 
            fontSize: '13px', 
            color: theme?.colors?.textSecondary || '#999',
            marginBottom: '16px'
          }}>
            Backfill historical search data to see trends over time. This will perform searches for past dates and store the results.
          </p>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const query = formData.get('backfillQuery');
            const monthsBack = parseInt(formData.get('monthsBack') || '6', 10);
            if (query && query.trim()) {
              onBackfill(query.trim(), monthsBack);
            }
          }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                name="backfillQuery"
                placeholder="Enter search query (e.g., cruise holidays)"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: `1px solid ${theme?.colors?.border || '#444'}`,
                  borderRadius: '4px',
                  backgroundColor: theme?.colors?.background || '#1e1e1e',
                  color: theme?.colors?.foreground || '#e0e0e0',
                  outline: 'none'
                }}
                disabled={backfilling}
              />
              <select
                name="monthsBack"
                style={{
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: `1px solid ${theme?.colors?.border || '#444'}`,
                  borderRadius: '4px',
                  backgroundColor: theme?.colors?.background || '#1e1e1e',
                  color: theme?.colors?.foreground || '#e0e0e0',
                  outline: 'none',
                  cursor: backfilling ? 'not-allowed' : 'pointer'
                }}
                disabled={backfilling}
                defaultValue="6"
              >
                <option value="3">Last 3 months</option>
                <option value="6">Last 6 months</option>
                <option value="12">Last 12 months</option>
              </select>
              <button
                type="submit"
                disabled={backfilling}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  backgroundColor: backfilling 
                    ? (theme?.colors?.accent || '#1976d2') + '80'
                    : (theme?.colors?.accent || '#1976d2'),
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: backfilling ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                  whiteSpace: 'nowrap'
                }}
              >
                {backfilling ? '⏳ Backfilling...' : '📥 Get Historical Data'}
              </button>
            </div>
          </form>
          {backfillResult && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              backgroundColor: backfillResult.error 
                ? 'rgba(244, 67, 54, 0.1)' 
                : 'rgba(76, 175, 80, 0.1)',
              borderRadius: '4px',
              fontSize: '13px',
              color: backfillResult.error 
                ? '#f44336' 
                : theme?.colors?.foreground || '#e0e0e0'
            }}>
              {backfillResult.error ? (
                <span>❌ Error: {backfillResult.error}</span>
              ) : (
                <span>
                  ✅ Successfully backfilled <strong>{backfillResult.dataPointsStored}</strong> data points for "{backfillResult.query}"
                  <br />
                  <span style={{ fontSize: '12px', color: theme?.colors?.textSecondary || '#999' }}>
                    Date range: {formatDate(backfillResult.dateRange.from)} to {formatDate(backfillResult.dateRange.to)}
                  </span>
                </span>
              )}
            </div>
          )}
          <p style={{ 
            marginTop: '12px',
            fontSize: '12px', 
            color: theme?.colors?.textSecondary || '#666',
            fontStyle: 'italic'
          }}>
            Note: Historical backfill uses date-restricted searches to simulate past trends. Results may vary based on Google's index.
          </p>
        </div>
      )}
    </div>
  );
};

export default SearchTrendsPresenter;

