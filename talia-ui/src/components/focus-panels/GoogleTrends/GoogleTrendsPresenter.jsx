/**
 * Google Trends Presenter
 * Displays Google Trends data showing what people are searching for
 * Shows interest scores (0-100) over time for generic cruise holiday terms
 */

import React, { useMemo, useState } from 'react';
import RefreshStatus from '../../common/RefreshStatus';

const GoogleTrendsPresenter = ({ 
  trends, 
  availableQueries = [],
  selectedQueries: selectedQueriesProp = [],
  loading, 
  error,
  refreshMetadata,
  refreshing,
  onRefresh,
  onQueryChange,
  onSelectedQueriesChange,
  onRegionChange,
  onDateRangeChange,
  onFetchAndStore,
  onBackfill,
  theme 
}) => {
  const [editingQuery, setEditingQuery] = useState(null);
  const [editingQueryText, setEditingQueryText] = useState('');
  const [newQueryText, setNewQueryText] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year ago
    endDate: new Date().toISOString().split('T')[0]
  });
  const [backfilling, setBackfilling] = useState(false);
  const [sortBy, setSortBy] = useState('mostSearched'); // 'mostSearched' or 'alphabetical'
  const [quickFilter, setQuickFilter] = useState(null);
  const [topLimit, setTopLimit] = useState(null); // null = show all, or number for top X
  
  // Load collapse state from localStorage
  const STORAGE_KEY_COLLAPSED = 'googleTrendsSearchTermsCollapsed';
  const loadCollapsedState = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_COLLAPSED);
      return stored === 'true';
    } catch (e) {
      return false;
    }
  };
  const [searchTermsCollapsed, setSearchTermsCollapsed] = useState(loadCollapsedState);
  
  // Save collapse state to localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COLLAPSED, String(searchTermsCollapsed));
    } catch (e) {
      console.warn('[GoogleTrendsPresenter] Error saving collapse state:', e);
    }
  }, [searchTermsCollapsed]);
  
  // Use selectedQueries from props (managed by container with localStorage)
  const selectedQueries = selectedQueriesProp.length > 0 ? selectedQueriesProp : ['cruise holidays'];
  
  // Check if all available queries are selected
  const allQueriesSelected = availableQueries && Array.isArray(availableQueries) && availableQueries.length > 0 && 
    availableQueries.every(q => selectedQueries.includes(q)) &&
    selectedQueries.length === availableQueries.length;
  
  // Initialize date range from trends data when available
  React.useEffect(() => {
    if (trends?.dateRange) {
      setDateRange({
        startDate: trends.dateRange.from || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: trends.dateRange.to || new Date().toISOString().split('T')[0]
      });
    }
  }, [trends]);
  

  // Optimized date formatter with caching
  const dateCache = useMemo(() => new Map(), []);
  const formatDate = (dateString) => {
    if (!dateString) return '';
    if (dateCache.has(dateString)) return dateCache.get(dateString);
    try {
      const date = new Date(dateString);
      const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      dateCache.set(dateString, formatted);
      return formatted;
    } catch {
      return dateString;
    }
  };

  // Color palette for different queries
  const colors = [
    '#1976d2', '#4caf50', '#ff9800', '#9c27b0', '#e91e63',
    '#00bcd4', '#8bc34a', '#ff5722', '#673ab7', '#f44336'
  ];

  // Filter out series with no data points, sort, and apply top limit
  const seriesWithData = useMemo(() => {
    if (!trends || !trends.series) return [];
    let filtered = trends.series.filter(s => s.dataPoints && s.dataPoints.length > 0);
    
    // Sort based on selected option
    if (sortBy === 'mostSearched') {
      // Sort by average interest score (highest first)
      filtered = [...filtered].sort((a, b) => {
        const avgA = a.avgScore || 0;
        const avgB = b.avgScore || 0;
        return avgB - avgA; // Descending (highest first)
      });
    } else if (sortBy === 'alphabetical') {
      // Sort alphabetically by query name
      filtered = [...filtered].sort((a, b) => 
        (a.query || '').localeCompare(b.query || '')
      );
    }
    
    // Apply top limit if set
    if (topLimit !== null && topLimit > 0) {
      filtered = filtered.slice(0, topLimit);
    }
    
    return filtered;
  }, [trends, sortBy, topLimit]);

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

  // Show empty state only if we're not loading and truly have no data
  // Check if we have any series with data points
  const hasData = trends && trends.series && trends.series.length > 0 && seriesWithData.length > 0;
  
  if (!hasData && !loading && !error) {
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
          
          {/* Refresh Status */}
          <div style={{ marginBottom: '16px' }}>
            <RefreshStatus
              lastRefreshTime={refreshMetadata?.lastRefreshedAt}
              isLoading={refreshing || loading}
              error={refreshMetadata?.refreshStatus === 'error' ? refreshMetadata?.refreshError : null}
              onRefresh={onRefresh}
              dataSource="Google Trends"
              theme={theme}
            />
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
            Current Range: {formatDate(trends.dateRange.from)} - {formatDate(trends.dateRange.to)}
            {trends.region && ` (${trends.region || 'Worldwide'})`}
          </p>
        )}
        
        {/* Search Terms Selector */}
        <div style={{
          marginTop: '16px',
          padding: '12px 16px',
          backgroundColor: theme?.colors?.backgroundSecondary || '#2a2a2a',
          borderRadius: '8px',
          border: `1px solid ${theme?.colors?.border || '#333'}`
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <label style={{
              fontSize: '13px',
              fontWeight: '500',
              color: theme?.colors?.foreground || '#e0e0e0'
            }}>
              Search Terms ({selectedQueries.length} selected{allQueriesSelected ? ' - All' : ''}):
            </label>
            <button
              onClick={() => setSearchTermsCollapsed(!searchTermsCollapsed)}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                backgroundColor: 'transparent',
                color: theme?.colors?.textSecondary || '#999',
                border: `1px solid ${theme?.colors?.border || '#444'}`,
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {searchTermsCollapsed ? '▼ Show' : '▲ Hide'}
            </button>
          </div>
          {!searchTermsCollapsed && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              marginBottom: '12px'
            }}>
              {selectedQueries.map((query, idx) => (
              <div
                key={`${query}-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  backgroundColor: theme?.colors?.background || '#1e1e1e',
                  border: `1px solid ${theme?.colors?.border || '#444'}`,
                  borderRadius: '4px',
                  fontSize: '13px'
                }}
              >
                {editingQuery === idx ? (
                  <>
                    <input
                      type="text"
                      value={editingQueryText}
                      onChange={(e) => setEditingQueryText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const updated = [...selectedQueries];
                          updated[idx] = editingQueryText.trim();
                          if (updated[idx] && onSelectedQueriesChange) {
                            onSelectedQueriesChange(updated);
                          }
                          setEditingQuery(null);
                          setEditingQueryText('');
                        } else if (e.key === 'Escape') {
                          setEditingQuery(null);
                          setEditingQueryText('');
                        }
                      }}
                      autoFocus
                      style={{
                        padding: '8px 12px',
                        fontSize: '14px',
                        border: `2px solid ${theme?.colors?.border || '#555'}`,
                        borderRadius: '6px',
                        backgroundColor: theme?.colors?.backgroundSecondary || '#2a2a2a',
                        color: theme?.colors?.foreground || '#e0e0e0',
                        outline: 'none',
                        minWidth: '250px',
                        fontWeight: '500'
                      }}
                    />
                    <button
                      onClick={() => {
                        const updated = [...selectedQueries];
                        updated[idx] = editingQueryText.trim();
                        if (updated[idx] && onSelectedQueriesChange) {
                          onSelectedQueriesChange(updated);
                        }
                        setEditingQuery(null);
                        setEditingQueryText('');
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        backgroundColor: theme?.colors?.primary || '#1976d2',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => {
                        setEditingQuery(null);
                        setEditingQueryText('');
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        backgroundColor: 'transparent',
                        color: theme?.colors?.textSecondary || '#999',
                        border: `1px solid ${theme?.colors?.border || '#444'}`,
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ color: theme?.colors?.foreground || '#e0e0e0' }}>
                      {query}
                    </span>
                    <button
                      onClick={() => {
                        setEditingQuery(idx);
                        setEditingQueryText(query);
                      }}
                      style={{
                        padding: '2px 6px',
                        fontSize: '11px',
                        backgroundColor: 'transparent',
                        color: theme?.colors?.textSecondary || '#999',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: 0.7
                      }}
                      title="Edit query"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => {
                        const updated = selectedQueries.filter((_, i) => i !== idx);
                        if (onSelectedQueriesChange) {
                          onSelectedQueriesChange(updated.length > 0 ? updated : ['cruise holidays']);
                        }
                      }}
                      style={{
                        padding: '2px 6px',
                        fontSize: '11px',
                        backgroundColor: 'transparent',
                        color: theme?.colors?.textSecondary || '#999',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: 0.7
                      }}
                      title="Remove query"
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
              ))}
            </div>
          )}
          
          {/* Add new query - always visible */}
          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value === '__ALL__') {
                  // Select all available queries
                  if (onSelectedQueriesChange && availableQueries && availableQueries.length > 0) {
                    onSelectedQueriesChange([...availableQueries]);
                  }
                } else if (e.target.value && !selectedQueries.includes(e.target.value)) {
                  const updated = [...selectedQueries, e.target.value];
                  if (onSelectedQueriesChange) {
                    onSelectedQueriesChange(updated);
                  }
                }
                e.target.value = '';
              }}
              style={{
                padding: '10px 14px',
                fontSize: '14px',
                border: `2px solid ${theme?.colors?.border || '#555'}`,
                borderRadius: '6px',
                backgroundColor: theme?.colors?.backgroundSecondary || '#2a2a2a',
                color: theme?.colors?.foreground || '#e0e0e0',
                outline: 'none',
                minWidth: '240px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              <option value="">Add search term...</option>
              <option value="__ALL__" style={{ fontWeight: '600' }}>
                ── Select All Available Queries ──
              </option>
              {(availableQueries || [])
                .filter(q => !selectedQueries.includes(q))
                .map(query => (
                  <option key={query} value={query}>{query}</option>
                ))}
            </select>
            <div style={{
              display: 'flex',
              gap: '6px',
              alignItems: 'center'
            }}>
              <input
                type="text"
                value={newQueryText}
                onChange={(e) => setNewQueryText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newQueryText.trim()) {
                    if (!selectedQueries.includes(newQueryText.trim())) {
                      const updated = [...selectedQueries, newQueryText.trim()];
                      if (onSelectedQueriesChange) {
                        onSelectedQueriesChange(updated);
                      }
                    }
                    setNewQueryText('');
                  }
                }}
                placeholder="Or type new query..."
                style={{
                  padding: '10px 14px',
                  fontSize: '14px',
                  border: `2px solid ${theme?.colors?.border || '#555'}`,
                  borderRadius: '6px',
                  backgroundColor: theme?.colors?.backgroundSecondary || '#2a2a2a',
                  color: theme?.colors?.foreground || '#e0e0e0',
                  outline: 'none',
                  minWidth: '240px',
                  fontWeight: '500'
                }}
              />
              {newQueryText.trim() && (
                <button
                  onClick={() => {
                    if (!selectedQueries.includes(newQueryText.trim())) {
                      const updated = [...selectedQueries, newQueryText.trim()];
                      if (onSelectedQueriesChange) {
                        onSelectedQueriesChange(updated);
                      }
                    }
                    setNewQueryText('');
                  }}
                  disabled={!newQueryText.trim() || selectedQueries.includes(newQueryText.trim())}
                  style={{
                    padding: '6px 12px',
                    fontSize: '13px',
                    fontWeight: '500',
                    backgroundColor: (!newQueryText.trim() || selectedQueries.includes(newQueryText.trim()))
                      ? (theme?.colors?.backgroundSecondary || '#2a2a2a')
                      : (theme?.colors?.primary || '#1976d2'),
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: (!newQueryText.trim() || selectedQueries.includes(newQueryText.trim())) ? 'not-allowed' : 'pointer',
                    opacity: (!newQueryText.trim() || selectedQueries.includes(newQueryText.trim())) ? 0.6 : 1
                  }}
                >
                  Add
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Date Range Filter */}
        <div style={{
          marginTop: '16px',
          padding: '16px',
          backgroundColor: theme?.colors?.backgroundSecondary || '#2a2a2a',
          borderRadius: '8px',
          border: `1px solid ${theme?.colors?.border || '#333'}`
        }}>
          <label style={{
            fontSize: '13px',
            fontWeight: '500',
            color: theme?.colors?.foreground || '#e0e0e0',
            marginBottom: '12px',
            display: 'block'
          }}>
            Date Range:
          </label>
          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            {/* Quick Filter Radio Buttons */}
            {[
              { value: 'last-month', label: 'Last Month', days: 30 },
              { value: 'last-3-months', label: 'Last 3 Months', days: 90 },
              { value: 'last-6-months', label: 'Last 6 Months', days: 180 },
              { value: 'last-year', label: 'Last Year', days: 365 },
              { value: 'all-time', label: 'All Time', days: null }
            ].map((filter) => (
              <label key={filter.value} style={{ display: 'flex', alignItems: 'center', cursor: loading ? 'not-allowed' : 'pointer', gap: '6px' }}>
                <input
                  type="radio"
                  name="quick-date-filter"
                  value={filter.value}
                  checked={quickFilter === filter.value}
                  disabled={loading}
                  onChange={() => {
                    setQuickFilter(filter.value);
                    let startDate, endDate;
                    if (filter.days === null) {
                      startDate = '2020-01-01';
                      endDate = new Date().toISOString().split('T')[0];
                    } else {
                      startDate = new Date(Date.now() - filter.days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                      endDate = new Date().toISOString().split('T')[0];
                    }
                    setDateRange({ startDate, endDate });
                    // Automatically update the display when quick filter is selected
                    if (onDateRangeChange) {
                      onDateRangeChange(startDate, endDate);
                    }
                  }}
                  style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
                />
                <span style={{ 
                  fontSize: '13px',
                  color: theme?.colors?.foreground || '#e0e0e0',
                  opacity: loading ? 0.6 : 1
                }}>
                  {filter.label}
                </span>
              </label>
            ))}
            
            {/* Custom Date Range - inline with quick filters */}
            <span style={{
              fontSize: '13px',
              color: theme?.colors?.textSecondary || '#999',
              margin: '0 4px'
            }}>
              or
            </span>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => {
                const newStartDate = e.target.value;
                setDateRange(prev => ({ ...prev, startDate: newStartDate }));
                setQuickFilter(null);
                // Auto-apply when custom date is changed
                if (onDateRangeChange && newStartDate && dateRange.endDate) {
                  onDateRangeChange(newStartDate, dateRange.endDate);
                }
              }}
              max={dateRange.endDate || new Date().toISOString().split('T')[0]}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                border: `2px solid ${theme?.colors?.border || '#555'}`,
                borderRadius: '6px',
                backgroundColor: theme?.colors?.backgroundSecondary || '#2a2a2a',
                color: theme?.colors?.foreground || '#e0e0e0',
                outline: 'none',
                fontWeight: '500',
                cursor: 'pointer',
                minWidth: '140px'
              }}
            />
            <span style={{
              fontSize: '13px',
              color: theme?.colors?.textSecondary || '#999'
            }}>
              to
            </span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => {
                const newEndDate = e.target.value;
                setDateRange(prev => ({ ...prev, endDate: newEndDate }));
                setQuickFilter(null);
                // Auto-apply when custom date is changed
                if (onDateRangeChange && dateRange.startDate && newEndDate) {
                  onDateRangeChange(dateRange.startDate, newEndDate);
                }
              }}
              min={dateRange.startDate}
              max={new Date().toISOString().split('T')[0]}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                border: `2px solid ${theme?.colors?.border || '#555'}`,
                borderRadius: '6px',
                backgroundColor: theme?.colors?.backgroundSecondary || '#2a2a2a',
                color: theme?.colors?.foreground || '#e0e0e0',
                outline: 'none',
                fontWeight: '500',
                cursor: 'pointer',
                minWidth: '140px'
              }}
            />
            {/* Apply button only shown when using custom dates (not quick filters) */}
            {quickFilter === null && (
              <button
                onClick={() => {
                  if (onDateRangeChange && dateRange.startDate && dateRange.endDate) {
                    onDateRangeChange(dateRange.startDate, dateRange.endDate);
                  }
                }}
                disabled={loading || !dateRange.startDate || !dateRange.endDate}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '500',
                  backgroundColor: (loading || !dateRange.startDate || !dateRange.endDate)
                    ? (theme?.colors?.backgroundSecondary || '#2a2a2a')
                    : (theme?.colors?.primary || '#1976d2'),
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (loading || !dateRange.startDate || !dateRange.endDate) ? 'not-allowed' : 'pointer',
                  opacity: (loading || !dateRange.startDate || !dateRange.endDate) ? 0.6 : 1,
                  transition: 'all 0.2s'
                }}
              >
                {loading ? 'Loading...' : 'Apply'}
              </button>
            )}
          </div>
        </div>
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
                transition: 'all 0.2s',
                position: 'relative'
              }}
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  const updatedQueries = selectedQueries.filter(q => q !== series.query);
                  onSelectedQueriesChange(updatedQueries);
                }}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'transparent',
                  border: `1px solid ${theme?.colors?.border || '#444'}`,
                  borderRadius: '4px',
                  color: theme?.colors?.textSecondary || '#999',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontSize: '14px',
                  lineHeight: '1',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = theme?.colors?.backgroundSecondary || '#2a2a2a';
                  e.target.style.color = theme?.colors?.foreground || '#e0e0e0';
                  e.target.style.borderColor = theme?.colors?.border || '#666';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.color = theme?.colors?.textSecondary || '#999';
                  e.target.style.borderColor = theme?.colors?.border || '#444';
                }}
                title="Remove this graph"
              >
                ×
              </button>

              {/* Query Header */}
              <div style={{ marginBottom: '16px', minHeight: '60px', paddingRight: '32px' }}>
                <h4 
                  style={{ 
                    margin: '0 0 8px 0',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: theme?.colors?.foreground || '#e0e0e0',
                    height: '24px',
                    lineHeight: '24px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  title={series.query}
                >
                  {series.query}
                </h4>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: '12px',
                  fontSize: '14px',
                  height: '20px'
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
              {series.dataPoints.length > 0 && (() => {
                // Pre-calculate values outside render loop for performance
                const seriesMaxScore = series.maxScore || 100;
                const totalPoints = series.dataPoints.length;
                const barWidth = totalPoints > 100 ? '2px' 
                  : totalPoints > 50 ? '3px'
                  : totalPoints > 20 ? '4px'
                  : undefined;
                
                return (
                  <div style={{
                    marginTop: '16px',
                    height: '120px',
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '1px',
                    padding: '8px',
                    backgroundColor: theme?.colors?.backgroundSecondary || '#2a2a2a',
                    borderRadius: '4px',
                    position: 'relative',
                    border: `1px solid ${theme?.colors?.border || '#444'}`,
                    overflowX: 'auto',
                    overflowY: 'hidden'
                  }}>
                    {series.dataPoints.map((point, pointIdx) => {
                      const heightPercent = seriesMaxScore > 0 
                        ? (point.interestScore / seriesMaxScore) * 100 
                        : 0;
                      const barHeight = Math.max(heightPercent, 1);
                      
                      return (
                        <div
                          key={`${point.date}-${pointIdx}`}
                          style={{
                            ...(barWidth ? { width: barWidth, flexShrink: 0 } : { flex: 1 }),
                            height: `${barHeight}%`,
                            minHeight: '2px',
                            minWidth: '1px',
                            backgroundColor: color,
                            borderRadius: barWidth ? '1px 1px 0 0' : '2px 2px 0 0',
                            position: 'relative',
                            opacity: 0.9,
                            border: `1px solid ${color}33`
                          }}
                          title={`${formatDate(point.date)}: ${point.interestScore}/100`}
                        />
                      );
                    })}
                  </div>
                );
              })()}

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
            {trends.totalDataPoints || 0}
          </strong> total data points across{' '}
          <strong style={{ color: theme?.colors?.foreground || '#e0e0e0' }}>
            {trends.queries?.length || 0}
          </strong> search {(trends.queries?.length || 0) === 1 ? 'query' : 'queries'}
        </div>
      )}
    </div>
  );
};

export default GoogleTrendsPresenter;

