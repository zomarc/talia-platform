/**
 * Google Trends Presenter
 * Displays Google Trends data showing what people are searching for
 * Shows interest scores (0-100) over time for generic cruise holiday terms
 */

import React, { useMemo, useState } from 'react';
import RefreshStatus from '../../common/RefreshStatus';
import { formatDayMon } from '../../../lib/dateFormat';

const GoogleTrendsPresenter = ({ 
  trends, 
  availableQueries = [],
  selectedQueries: selectedQueriesProp = [],
  loading, 
  error,
  refreshMetadata,
  refreshing,
  onSelectedQueriesChange,
  onDateRangeChange,
  onBackfill 
}) => {
  const [editingQuery, setEditingQuery] = useState(null);
  const [editingQueryText, setEditingQueryText] = useState('');
  const [newQueryText, setNewQueryText] = useState('');
  const [selectedRegion] = useState('');
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
    } catch {
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
      const formatted = formatDayMon(dateString, dateString);
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
      <div className="google-trends__status">
        <p>Loading Google Trends data...</p>
      </div>
    );
  }

  if (error && !trends) {
    return (
      <div className="google-trends__error">
        <h3 className="google-trends__error-title">Error Loading Trends</h3>
        <p className="google-trends__error-message">
          {error.message || 'Failed to load Google Trends data'}
        </p>
        {error.stack && (
          <details className="google-trends__error-details">
            <summary className="google-trends__error-summary">Error Details</summary>
            <pre className="google-trends__error-pre">
              {error.stack || JSON.stringify(error, null, 2)}
            </pre>
          </details>
        )}
        <button
          onClick={() => window.location.reload()}
          className="google-trends__button"
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
      <div className="google-trends__empty">
        <h3 className="google-trends__empty-title">
          Google Trends - What People Are Searching For
        </h3>
        <p className="google-trends__empty-text">No trend data available yet</p>
        {error && (
          <div className="google-trends__empty-error">
            Error: {error.message || 'Unknown error'}
          </div>
        )}
        <p className="google-trends__empty-note">
          Fetch trends data to see search interest over time for cruise holiday terms
        </p>
        
        {/* Backfill Form */}
        <div className="google-trends__backfill-card">
          <h4 className="google-trends__backfill-title">Fetch Historical Trends</h4>
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
            <div className="google-trends__backfill-form">
              <input
                type="text"
                name="queries"
                placeholder="cruise holidays, Greek islands cruise, Mediterranean cruise"
                defaultValue="cruise holidays"
                required
                className="google-trends__input"
                disabled={backfilling}
              />
              <div className="google-trends__backfill-row">
                <input
                  type="date"
                  name="startDate"
                  defaultValue={dateRange.startDate}
                  required
                  className="google-trends__input google-trends__input--date"
                  disabled={backfilling}
                />
                <input
                  type="date"
                  name="endDate"
                  defaultValue={dateRange.endDate}
                  required
                  className="google-trends__input google-trends__input--date"
                  disabled={backfilling}
                />
                <input
                  type="text"
                  name="region"
                  placeholder="Region (e.g., US, GB, GR)"
                  className="google-trends__input google-trends__input--region"
                  disabled={backfilling}
                />
              </div>
              <button
                type="submit"
                disabled={backfilling}
                className="google-trends__button"
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
    <div className="google-trends talia-report">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h3 className="google-trends__title talia-report__title">
            Google Trends - What People Are Searching For
          </h3>
          <p className="google-trends__subtitle talia-report__subtitle">
            Historical search interest for cruise holiday terms
            {trends.dateRange
              ? ` · ${formatDate(trends.dateRange.from)} - ${formatDate(trends.dateRange.to)}${trends.region ? ` (${trends.region || 'Worldwide'})` : ''}`
              : ''}
          </p>
        </div>
      </header>

      {seriesWithData.length > 1 ? (
        <div className="talia-report__controls google-trends__controls" aria-label="Google trends controls">
          <div className="google-trends__sort">
            <label className="google-trends__label">Sort:</label>
            <button
              type="button"
              onClick={() => setSortBy('mostSearched')}
              className="talia-btn talia-btn--secondary google-trends__toggle"
              data-active={sortBy === 'mostSearched' ? 'true' : 'false'}
              title="Sort by average interest score (most searched first)"
            >
              Most Searched
            </button>
            <button
              type="button"
              onClick={() => setSortBy('alphabetical')}
              className="talia-btn talia-btn--secondary google-trends__toggle"
              data-active={sortBy === 'alphabetical' ? 'true' : 'false'}
              title="Sort alphabetically by query name"
            >
              A-Z
            </button>
          </div>
          <div className="google-trends__top">
            <label className="google-trends__label">Show Top:</label>
            <select
              value={topLimit === null ? 'all' : topLimit.toString()}
              onChange={(e) => {
                const value = e.target.value;
                setTopLimit(value === 'all' ? null : parseInt(value, 10));
              }}
              className="google-trends__select"
            >
              <option value="all">All</option>
              <option value="5">Top 5</option>
              <option value="10">Top 10</option>
              <option value="15">Top 15</option>
              <option value="20">Top 20</option>
              <option value="25">Top 25</option>
            </select>
          </div>
        </div>
      ) : null}

      <div className="talia-report__actions-bar" aria-label="Google trends actions">
        <RefreshStatus
          lastRefreshTime={refreshMetadata?.lastRefreshedAt}
          isLoading={refreshing || loading}
          error={refreshMetadata?.refreshStatus === 'error' ? refreshMetadata?.refreshError : null}
          dataSource="Google Trends"
        />
      </div>

      <div className="talia-report-filters google-trends__filters">
        {/* Search Terms Selector */}
        <div className="google-trends__terms">
          <div className="google-trends__terms-header">
            <label className="google-trends__terms-label">
              Search Terms ({selectedQueries.length} selected{allQueriesSelected ? ' - All' : ''}):
            </label>
            <button
              onClick={() => setSearchTermsCollapsed(!searchTermsCollapsed)}
              className="google-trends__terms-toggle"
            >
              {searchTermsCollapsed ? '▼ Show' : '▲ Hide'}
            </button>
          </div>
          {!searchTermsCollapsed && (
            <div className="google-trends__terms-list">
              {selectedQueries.map((query, idx) => (
              <div
                key={`${query}-${idx}`}
                className="google-trends__term"
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
                      className="google-trends__term-input"
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
                      className="google-trends__term-button google-trends__term-button--save"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => {
                        setEditingQuery(null);
                        setEditingQueryText('');
                      }}
                      className="google-trends__term-button"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <span className="google-trends__term-text">
                      {query}
                    </span>
                    <button
                      onClick={() => {
                        setEditingQuery(idx);
                        setEditingQueryText(query);
                      }}
                      className="google-trends__term-action"
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
                      className="google-trends__term-action"
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
          <div className="google-trends__add-query">
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
              className="google-trends__select google-trends__select--wide"
            >
              <option value="">Add search term...</option>
              <option value="__ALL__" className="google-trends__option-strong">
                ── Select All Available Queries ──
              </option>
              {(availableQueries || [])
                .filter(q => !selectedQueries.includes(q))
                .map(query => (
                  <option key={query} value={query}>{query}</option>
                ))}
            </select>
            <div className="google-trends__add-actions">
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
                className="google-trends__input google-trends__input--wide"
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
                  className="google-trends__button google-trends__button--small"
                >
                  Add
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Date Range Filter */}
        <div className="google-trends__date-range">
          <label className="google-trends__label">
            Date Range:
          </label>
          <div className="google-trends__date-row">
            {/* Quick Filter Radio Buttons */}
            {[
              { value: 'last-month', label: 'Last Month', days: 30 },
              { value: 'last-3-months', label: 'Last 3 Months', days: 90 },
              { value: 'last-6-months', label: 'Last 6 Months', days: 180 },
              { value: 'last-year', label: 'Last Year', days: 365 },
              { value: 'all-time', label: 'All Time', days: null }
            ].map((filter) => (
              <label
                key={filter.value}
                className="google-trends__date-option"
                data-disabled={loading ? 'true' : 'false'}
              >
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
                  className="google-trends__radio"
                />
                <span className="google-trends__date-text" data-disabled={loading ? 'true' : 'false'}>
                  {filter.label}
                </span>
              </label>
            ))}
            
            {/* Custom Date Range - inline with quick filters */}
            <span className="google-trends__date-separator">
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
              className="google-trends__input google-trends__input--date"
            />
            <span className="google-trends__date-separator">
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
              className="google-trends__input google-trends__input--date"
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
                className="google-trends__button google-trends__button--small"
              >
                {loading ? 'Loading...' : 'Apply'}
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="talia-report__content">
      {/* Trends Series */}
      <div className="google-trends__series-grid">
        {seriesWithData.map((series, idx) => {
          const colorIndex = idx % colors.length;
          
          return (
            <div
              key={series.query}
              className={`google-trends__series-card google-trends__series-card--color-${colorIndex}`}
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  const updatedQueries = selectedQueries.filter(q => q !== series.query);
                  onSelectedQueriesChange(updatedQueries);
                }}
                className="google-trends__series-close"
                title="Remove this graph"
              >
                ×
              </button>

              {/* Query Header */}
              <div className="google-trends__series-header">
                <h4 
                  className="google-trends__series-title"
                  title={series.query}
                >
                  {series.query}
                </h4>
                <div className="google-trends__series-meta">
                  <span className="google-trends__series-meta-label">
                    Avg Interest: <strong className="google-trends__series-meta-value">
                      {series.avgScore.toFixed(1)}/100
                    </strong>
                  </span>
                  <span className="google-trends__series-meta-label">
                    Peak: <strong className="google-trends__series-meta-value">
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
                const barWidthClass = totalPoints > 100
                  ? 'google-trends__bars--dense'
                  : totalPoints > 50
                    ? 'google-trends__bars--compact'
                    : totalPoints > 20
                      ? 'google-trends__bars--medium'
                      : 'google-trends__bars--flex';
                
                return (
                  <div className={`google-trends__bars ${barWidthClass}`}>
                    {series.dataPoints.map((point, pointIdx) => {
                      const heightPercent = seriesMaxScore > 0 
                        ? (point.interestScore / seriesMaxScore) * 100 
                        : 0;
                      const level = Math.max(1, Math.min(10, Math.round(heightPercent / 10)));
                      
                      return (
                        <div
                          key={`${point.date}-${pointIdx}`}
                          className={`google-trends__bar google-trends__bar--level-${level}`}
                          title={`${formatDate(point.date)}: ${point.interestScore}/100`}
                        />
                      );
                    })}
                  </div>
                );
              })()}

              {/* Stats */}
              <div className="google-trends__series-stats">
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
        <div className="google-trends__summary">
          <strong className="google-trends__summary-value">
            {trends.totalDataPoints || 0}
          </strong> total data points across{' '}
          <strong className="google-trends__summary-value">
            {trends.queries?.length || 0}
          </strong> search {(trends.queries?.length || 0) === 1 ? 'query' : 'queries'}
        </div>
      )}
      </main>
    </div>
  );
};

export default GoogleTrendsPresenter;

