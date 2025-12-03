/**
 * Google Trends Presenter
 * Displays Google Trends data showing what people are searching for
 * Shows interest scores (0-100) over time for generic cruise holiday terms
 */

import React, { useMemo, useState } from 'react';

const GoogleTrendsPresenter = ({ 
  trends, 
  availableQueries, 
  loading, 
  error, 
  onQueryChange, 
  onRegionChange,
  onDateRangeChange,
  onFetchAndStore,
  onBackfill,
  theme 
}) => {
  const [selectedQueries, setSelectedQueries] = useState(['cruise holidays']);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year ago
    endDate: new Date().toISOString().split('T')[0]
  });
  const [backfilling, setBackfilling] = useState(false);
  const [sortBy, setSortBy] = useState('mostSearched'); // 'mostSearched' or 'alphabetical'

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  // Color palette for different queries
  const colors = [
    '#1976d2', '#4caf50', '#ff9800', '#9c27b0', '#e91e63',
    '#00bcd4', '#8bc34a', '#ff5722', '#673ab7', '#f44336'
  ];

  // Filter out series with no data points and sort
  const seriesWithData = useMemo(() => {
    if (!trends || !trends.series) return [];
    const filtered = trends.series.filter(s => s.dataPoints && s.dataPoints.length > 0);
    
    // Sort based on selected option
    if (sortBy === 'mostSearched') {
      // Sort by average interest score (highest first)
      return [...filtered].sort((a, b) => {
        const avgA = a.avgScore || 0;
        const avgB = b.avgScore || 0;
        return avgB - avgA; // Descending (highest first)
      });
    } else if (sortBy === 'alphabetical') {
      // Sort alphabetically by query name
      return [...filtered].sort((a, b) => 
        (a.query || '').localeCompare(b.query || '')
      );
    }
    
    return filtered;
  }, [trends, sortBy]);

  // Calculate max interest score for scaling charts
  const maxScore = useMemo(() => {
    if (!seriesWithData || seriesWithData.length === 0) return 100;
    return Math.max(...seriesWithData.flatMap(s => s.dataPoints.map(dp => dp.interestScore || 0)));
  }, [seriesWithData]);

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      await onBackfill(selectedQueries, dateRange.startDate, dateRange.endDate, selectedRegion);
    } catch (err) {
      console.error('Error backfilling:', err);
    } finally {
      setBackfilling(false);
    }
  };

  if (loading && !trends) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        color: theme?.colors?.foreground || '#e0e0e0'
      }}>
        <p>Loading Google Trends data...</p>
      </div>
    );
  }

  if (error && !trends) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        color: theme?.colors?.foreground || '#e0e0e0'
      }}>
        <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
          Error Loading Trends
        </h3>
        <p style={{ color: '#f44336', marginBottom: '16px' }}>
          {error.message || 'Failed to load Google Trends data'}
        </p>
        {error.stack && (
          <details style={{ 
            marginTop: '16px', 
            padding: '12px',
            backgroundColor: theme?.colors?.backgroundSecondary || '#2a2a2a',
            borderRadius: '4px',
            textAlign: 'left',
            fontSize: '12px',
            color: theme?.colors?.textSecondary || '#999'
          }}>
            <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>Error Details</summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {error.stack || JSON.stringify(error, null, 2)}
            </pre>
          </details>
        )}
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '8px 16px',
            marginTop: '16px',
            backgroundColor: theme?.colors?.primary || '#1976d2',
            color: '#fff',
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

  // Debug info in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[GoogleTrendsPresenter] Current state:', {
      hasTrends: !!trends,
      seriesCount: trends?.series?.length,
      seriesWithDataCount: seriesWithData?.length,
      totalDataPoints: trends?.totalDataPoints,
      loading,
      error: error?.message
    });
  }

  // Show empty state only if we're not loading and truly have no data
  const hasData = trends && seriesWithData && seriesWithData.length > 0;
  
  if (!hasData && !loading) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        color: theme?.colors?.foreground || '#e0e0e0'
      }}>
        <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
          Google Trends - What People Are Searching For
        </h3>
        <p style={{ color: theme?.colors?.textSecondary || '#999', marginBottom: '16px' }}>
          No trend data available yet
        </p>
        {error && (
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            border: '1px solid #f44336',
            borderRadius: '4px',
            color: '#f44336',
            fontSize: '14px'
          }}>
            Error: {error.message || 'Unknown error'}
          </div>
        )}
        <p style={{ fontSize: '14px', color: theme?.colors?.textSecondary || '#999', marginBottom: '24px' }}>
          Fetch trends data to see search interest over time for cruise holiday terms
        </p>
        
        {/* Backfill Form */}
        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '24px',
          backgroundColor: theme?.colors?.backgroundSecondary || '#2a2a2a',
          borderRadius: '8px',
          border: `1px solid ${theme?.colors?.border || '#333'}`
        }}>
          <h4 style={{ 
            margin: '0 0 16px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: theme?.colors?.foreground || '#e0e0e0'
          }}>
            Fetch Historical Trends
          </h4>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const queries = formData.get('queries').split(',').map(q => q.trim()).filter(q => q);
            const startDate = formData.get('startDate');
            const endDate = formData.get('endDate');
            const region = formData.get('region') || '';
            
            if (queries.length > 0 && startDate && endDate) {
              handleBackfill();
              onBackfill(queries, startDate, endDate, region);
            }
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                name="queries"
                placeholder="cruise holidays, Greek islands cruise, Mediterranean cruise"
                defaultValue="cruise holidays"
                required
                style={{
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="date"
                  name="startDate"
                  defaultValue={dateRange.startDate}
                  required
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
                  type="date"
                  name="endDate"
                  defaultValue={dateRange.endDate}
                  required
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
                  type="text"
                  name="region"
                  placeholder="Region (e.g., US, GB, GR)"
                  style={{
                    width: '120px',
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
              </div>
              <button
                type="submit"
                disabled={backfilling}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: backfilling 
                    ? (theme?.colors?.backgroundSecondary || '#2a2a2a')
                    : (theme?.colors?.primary || '#1976d2'),
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: backfilling ? 'not-allowed' : 'pointer',
                  opacity: backfilling ? 0.6 : 1
                }}
              >
                {backfilling ? 'Fetching...' : 'Fetch Historical Trends'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '24px',
      color: theme?.colors?.foreground || '#e0e0e0',
      maxHeight: '100%',
      overflow: 'auto'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          marginBottom: '8px'
        }}>
          <div>
            <h3 style={{ 
              margin: '0 0 8px 0',
              fontSize: '20px',
              fontWeight: '600',
              color: theme?.colors?.foreground || '#e0e0e0'
            }}>
              Google Trends - What People Are Searching For
            </h3>
            <p style={{ 
              margin: 0,
              fontSize: '14px',
              color: theme?.colors?.textSecondary || '#999'
            }}>
              Historical search interest for cruise holiday terms
            </p>
          </div>
          
          {/* Sort Button */}
          {seriesWithData.length > 1 && (
            <div style={{ 
              display: 'flex',
              gap: '8px',
              alignItems: 'center'
            }}>
              <label style={{
                fontSize: '13px',
                color: theme?.colors?.textSecondary || '#999',
                marginRight: '4px'
              }}>
                Sort:
              </label>
              <button
                onClick={() => setSortBy('mostSearched')}
                style={{
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: sortBy === 'mostSearched' ? '600' : '400',
                  backgroundColor: sortBy === 'mostSearched'
                    ? (theme?.colors?.primary || '#1976d2')
                    : (theme?.colors?.backgroundSecondary || '#2a2a2a'),
                  color: sortBy === 'mostSearched' ? '#fff' : (theme?.colors?.foreground || '#e0e0e0'),
                  border: `1px solid ${sortBy === 'mostSearched' 
                    ? (theme?.colors?.primary || '#1976d2')
                    : (theme?.colors?.border || '#444')}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                title="Sort by average interest score (most searched first)"
              >
                Most Searched
              </button>
              <button
                onClick={() => setSortBy('alphabetical')}
                style={{
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: sortBy === 'alphabetical' ? '600' : '400',
                  backgroundColor: sortBy === 'alphabetical'
                    ? (theme?.colors?.primary || '#1976d2')
                    : (theme?.colors?.backgroundSecondary || '#2a2a2a'),
                  color: sortBy === 'alphabetical' ? '#fff' : (theme?.colors?.foreground || '#e0e0e0'),
                  border: `1px solid ${sortBy === 'alphabetical' 
                    ? (theme?.colors?.primary || '#1976d2')
                    : (theme?.colors?.border || '#444')}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                title="Sort alphabetically by query name"
              >
                A-Z
              </button>
            </div>
          )}
        </div>
        {trends.dateRange && (
          <p style={{ 
            margin: '8px 0 0 0',
            fontSize: '13px',
            color: theme?.colors?.textSecondary || '#999'
          }}>
            {formatDate(trends.dateRange.from)} - {formatDate(trends.dateRange.to)}
            {trends.region && ` (${trends.region || 'Worldwide'})`}
          </p>
        )}
      </div>

      {/* Trends Series */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {seriesWithData.map((series, idx) => {
          const color = colors[idx % colors.length];
          
          return (
            <div
              key={series.query}
              style={{
                padding: '20px',
                backgroundColor: theme?.colors?.background || '#1e1e1e',
                border: `1px solid ${theme?.colors?.border || '#333'}`,
                borderRadius: '8px',
                transition: 'all 0.2s'
              }}
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
                    Avg Interest: <strong style={{ color: theme?.colors?.foreground || '#e0e0e0' }}>
                      {series.avgScore.toFixed(1)}/100
                    </strong>
                  </span>
                  <span style={{ 
                    color: theme?.colors?.textSecondary || '#999'
                  }}>
                    Peak: <strong style={{ color: theme?.colors?.foreground || '#e0e0e0' }}>
                      {series.maxScore}/100
                    </strong>
                  </span>
                </div>
              </div>

              {/* Mini Chart */}
              {series.dataPoints.length > 0 && (
                <div style={{
                  marginTop: '16px',
                  height: '120px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '2px',
                  padding: '8px',
                  backgroundColor: theme?.colors?.backgroundSecondary || '#2a2a2a',
                  borderRadius: '4px',
                  position: 'relative'
                }}>
                  {series.dataPoints.map((point, pointIdx) => {
                    const heightPercent = maxScore > 0 
                      ? (point.interestScore / maxScore) * 100 
                      : 0;
                    
                    return (
                      <div
                        key={pointIdx}
                        style={{
                          flex: 1,
                          height: `${Math.max(heightPercent, 2)}%`,
                          backgroundColor: color,
                          borderRadius: '2px 2px 0 0',
                          minHeight: '4px',
                          transition: 'height 0.3s ease',
                          position: 'relative',
                          opacity: 0.8
                        }}
                        title={`${formatDate(point.date)}: ${point.interestScore}/100`}
                      />
                    );
                  })}
                </div>
              )}

              {/* Stats */}
              <div style={{
                marginTop: '12px',
                fontSize: '12px',
                color: theme?.colors?.textSecondary || '#666',
                textAlign: 'center',
                display: 'flex',
                justifyContent: 'space-around'
              }}>
                <span>Min: {series.minScore}</span>
                <span>Max: {series.maxScore}</span>
                <span>{series.dataPoints.length} points</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      {trends.totalDataPoints > 0 && (
        <div style={{
          padding: '16px',
          backgroundColor: theme?.colors?.backgroundSecondary || '#2a2a2a',
          borderRadius: '8px',
          border: `1px solid ${theme?.colors?.border || '#333'}`,
          fontSize: '14px',
          color: theme?.colors?.textSecondary || '#999'
        }}>
          <strong style={{ color: theme?.colors?.foreground || '#e0e0e0' }}>
            {trends.totalDataPoints}
          </strong> total data points across{' '}
          <strong style={{ color: theme?.colors?.foreground || '#e0e0e0' }}>
            {trends.queries.length}
          </strong> search {trends.queries.length === 1 ? 'query' : 'queries'}
        </div>
      )}
    </div>
  );
};

export default GoogleTrendsPresenter;

