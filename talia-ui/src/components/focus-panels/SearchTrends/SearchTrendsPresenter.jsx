/**
 * Search Trends Presenter
 * Displays search trends in a clean, informative UI showing what people are searching for
 */

import React, { useMemo } from 'react';

const SearchTrendsPresenter = ({ trends, trackedQueries, loading, backfilling, backfillResult, onQuerySelect, onBackfill }) => {
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
  const colorCount = 10;

  if (loading) {
    return (
      <div className="search-trends__status">
        <p className="search-trends__status-text">Loading search trends...</p>
      </div>
    );
  }

  if (!trends || trends.series.length === 0) {
    return (
      <div className="search-trends__empty">
        <h3 className="search-trends__empty-title">Search Trends</h3>
        <p className="search-trends__empty-text">No trend data available yet</p>
        <p className="search-trends__empty-note">
          Start tracking searches to see trends over time, or backfill historical data
        </p>
        {onBackfill && (
          <div className="search-trends__backfill">
            <p className="search-trends__backfill-label">
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
              <div className="search-trends__backfill-row search-trends__backfill-row--center">
                <input
                  type="text"
                  name="backfillQuery"
                  placeholder="e.g., cruise holidays"
                  className="search-trends__input"
                  disabled={backfilling}
                />
                <input
                  type="number"
                  name="monthsBack"
                  placeholder="Months"
                  defaultValue="6"
                  min="1"
                  max="12"
                  className="search-trends__input search-trends__input--small"
                  disabled={backfilling}
                />
                <button
                  type="submit"
                  disabled={backfilling}
                  className="search-trends__button"
                >
                  {backfilling ? 'Backfilling...' : 'Get Historical Data'}
                </button>
              </div>
            </form>
            {backfillResult && (
              <div
                className="search-trends__backfill-result"
                data-status={backfillResult.error ? 'error' : 'success'}
              >
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
    <div className="search-trends">
      {/* Header */}
      <div className="search-trends__header">
        <h3 className="search-trends__title">
          Search Trends - What People Are Looking For
        </h3>
        <p className="search-trends__subtitle">
          Tracking {trends.queries.length} search {trends.queries.length === 1 ? 'query' : 'queries'} from {formatDate(trends.dateRange.from)} to {formatDate(trends.dateRange.to)}
        </p>
      </div>

      {/* Trend Cards */}
      <div className="search-trends__grid">
        {trends.series.map((series, index) => {
          const colorIndex = index % colorCount;
          const isPositive = series.changePercent >= 0;
          
          return (
            <div
              key={series.query}
              className={`search-trends__card search-trends__card--color-${colorIndex}`}
              data-clickable={onQuerySelect ? 'true' : 'false'}
              onClick={() => onQuerySelect && onQuerySelect(series.query)}
            >
              {/* Query Header */}
              <div className="search-trends__card-header">
                <h4 className="search-trends__card-title">
                  "{series.query}"
                </h4>
                <div className="search-trends__card-meta">
                  <span className="search-trends__card-meta-label">
                    Latest: <strong className="search-trends__card-meta-value">
                      {formatNumber(series.latestCount)} results
                    </strong>
                  </span>
                </div>
              </div>

              {/* Trend Indicator */}
              {series.changePercent !== 0 && (
                <div className="search-trends__trend" data-variant={isPositive ? 'positive' : 'negative'}>
                  <span className="search-trends__trend-icon">
                    {isPositive ? '📈' : '📉'}
                  </span>
                  <span className="search-trends__trend-text">
                    {isPositive ? '+' : ''}{series.changePercent.toFixed(1)}% 
                    ({isPositive ? '+' : ''}{formatNumber(series.change)} results)
                  </span>
                </div>
              )}

              {/* Mini Chart */}
              {series.dataPoints.length > 0 && (
                <div className="search-trends__mini-chart">
                  {series.dataPoints.map((point, idx) => {
                    const heightPercent = maxResults > 0 
                      ? (point.totalResults / maxResults) * 100 
                      : 0;
                    const level = Math.max(1, Math.min(10, Math.round(heightPercent / 10)));
                    
                    return (
                      <div
                        key={idx}
                        className={`search-trends__bar search-trends__bar--level-${level}`}
                        title={`${formatDate(point.date)}: ${formatNumber(point.totalResults)} results`}
                      />
                    );
                  })}
                </div>
              )}

              {/* Data Point Count */}
              <div className="search-trends__count">
                {series.dataPoints.length} data {series.dataPoints.length === 1 ? 'point' : 'points'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tracked Queries List */}
      {trackedQueries && trackedQueries.length > 0 && (
        <div className="search-trends__tracked">
          <h4 className="search-trends__tracked-title">
            Currently Tracking ({trackedQueries.length})
          </h4>
          <div className="search-trends__tracked-list">
            {trackedQueries.map((query, idx) => (
              <span
                key={idx}
                className="search-trends__tracked-item"
              >
                "{query}"
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Historical Data Backfill Section */}
      {onBackfill && (
        <div className="search-trends__backfill-section">
          <h4 className="search-trends__backfill-title">
            📊 Get Historical Trends
          </h4>
          <p className="search-trends__backfill-description">
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
            <div className="search-trends__backfill-row">
              <input
                type="text"
                name="backfillQuery"
                placeholder="Enter search query (e.g., cruise holidays)"
                className="search-trends__input"
                disabled={backfilling}
              />
              <select
                name="monthsBack"
                className="search-trends__input search-trends__input--select"
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
                className="search-trends__button"
              >
                {backfilling ? '⏳ Backfilling...' : '📥 Get Historical Data'}
              </button>
            </div>
          </form>
          {backfillResult && (
            <div
              className="search-trends__backfill-result"
              data-status={backfillResult.error ? 'error' : 'success'}
            >
              {backfillResult.error ? (
                <span>❌ Error: {backfillResult.error}</span>
              ) : (
                <span>
                  ✅ Successfully backfilled <strong>{backfillResult.dataPointsStored}</strong> data points for "{backfillResult.query}"
                  <br />
                  <span className="search-trends__backfill-meta">
                    Date range: {formatDate(backfillResult.dateRange.from)} to {formatDate(backfillResult.dateRange.to)}
                  </span>
                </span>
              )}
            </div>
          )}
          <p className="search-trends__backfill-note">
            Note: Historical backfill uses date-restricted searches to simulate past trends. Results may vary based on Google's index.
          </p>
        </div>
      )}
    </div>
  );
};

export default SearchTrendsPresenter;

