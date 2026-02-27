/**
 * Google Search Results Presenter
 * Displays Google search results in a clean, organized format
 */

import React from 'react';

const GoogleSearchPresenter = ({ results, query, loading, onSearch }) => {
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const searchQuery = formData.get('query');
    if (searchQuery && searchQuery.trim()) {
      onSearch(searchQuery.trim());
    }
  };

  const formatUrl = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return '';
    }
  };

  return (
    <div className="google-search">
      {/* Search Form */}
      <form onSubmit={handleSearchSubmit} className="google-search__form">
        <div className="google-search__form-row">
          <input
            type="text"
            name="query"
            placeholder="Search Google..."
            defaultValue={query || ''}
            className="google-search__input"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="google-search__button"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {/* Search Results */}
      {results && (
        <div>
          {/* Search Metadata */}
          <div className="google-search__meta">
            About {results.totalResults?.toLocaleString() || 0} results 
            ({results.searchTime?.toFixed(2) || 0} seconds)
            {results.spelling && (
              <div className="google-search__spell">
                Did you mean: <strong>{results.spelling}</strong>?
              </div>
            )}
          </div>

          {/* Search Items */}
          {results.items && results.items.length > 0 ? (
            <div className="google-search__results">
              {results.items.map((item, index) => (
                <div
                  key={index}
                  className="google-search__item"
                >
                  {/* URL */}
                  <div className="google-search__url">
                    {formatUrl(item.link)}
                  </div>

                  {/* Title */}
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="google-search__link"
                    dangerouslySetInnerHTML={{ __html: item.htmlTitle || item.title }}
                  />

                  {/* Snippet */}
                  <div
                    className="google-search__snippet"
                    dangerouslySetInnerHTML={{ __html: item.htmlSnippet || item.snippet }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="google-search__empty">
              No results found
            </div>
          )}

          {/* Metadata */}
          {results.metadata && (
            <div className="google-search__footer">
              Data source: {results.metadata.apiType || 'unknown'} 
              {results.metadata.timestamp && ` • Retrieved: ${formatDate(results.metadata.timestamp)}`}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!results && !loading && (
        <div className="google-search__empty-state">
          <p className="google-search__empty-title">
            Enter a search query above to search Google
          </p>
          <p className="google-search__empty-note">
            This uses Google Custom Search API to find relevant web results
          </p>
        </div>
      )}
    </div>
  );
};

export default GoogleSearchPresenter;

