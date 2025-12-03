/**
 * Google Search Results Presenter
 * Displays Google search results in a clean, organized format
 */

import React from 'react';

const GoogleSearchPresenter = ({ results, query, loading, onSearch, theme }) => {
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
    <div style={{ 
      padding: '20px',
      color: theme?.colors?.foreground || '#e0e0e0',
      fontFamily: theme?.typography?.fontFamily || 'Roboto, sans-serif'
    }}>
      {/* Search Form */}
      <form onSubmit={handleSearchSubmit} style={{ marginBottom: '24px' }}>
        <div style={{ 
          display: 'flex', 
          gap: '8px',
          maxWidth: '600px'
        }}>
          <input
            type="text"
            name="query"
            placeholder="Search Google..."
            defaultValue={query || ''}
            style={{
              flex: 1,
              padding: '10px 16px',
              fontSize: '16px',
              border: `1px solid ${theme?.colors?.border || '#444'}`,
              borderRadius: '4px',
              backgroundColor: theme?.colors?.background || '#1e1e1e',
              color: theme?.colors?.foreground || '#e0e0e0',
              outline: 'none'
            }}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px 24px',
              fontSize: '16px',
              backgroundColor: loading 
                ? (theme?.colors?.accent || '#1976d2') + '80'
                : (theme?.colors?.accent || '#1976d2'),
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '500'
            }}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {/* Search Results */}
      {results && (
        <div>
          {/* Search Metadata */}
          <div style={{ 
            marginBottom: '16px',
            color: theme?.colors?.textSecondary || '#999',
            fontSize: '14px'
          }}>
            About {results.totalResults?.toLocaleString() || 0} results 
            ({results.searchTime?.toFixed(2) || 0} seconds)
            {results.spelling && (
              <div style={{ marginTop: '4px', fontStyle: 'italic' }}>
                Did you mean: <strong>{results.spelling}</strong>?
              </div>
            )}
          </div>

          {/* Search Items */}
          {results.items && results.items.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {results.items.map((item, index) => (
                <div
                  key={index}
                  style={{
                    padding: '16px',
                    borderBottom: `1px solid ${theme?.colors?.border || '#333'}`,
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme?.colors?.hover || '#2a2a2a';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {/* URL */}
                  <div style={{
                    fontSize: '14px',
                    color: theme?.colors?.textSecondary || '#999',
                    marginBottom: '4px'
                  }}>
                    {formatUrl(item.link)}
                  </div>

                  {/* Title */}
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '20px',
                      fontWeight: '500',
                      color: theme?.colors?.link || '#8ab4f8',
                      textDecoration: 'none',
                      display: 'block',
                      marginBottom: '8px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.textDecoration = 'underline';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.textDecoration = 'none';
                    }}
                    dangerouslySetInnerHTML={{ __html: item.htmlTitle || item.title }}
                  />

                  {/* Snippet */}
                  <div
                    style={{
                      fontSize: '14px',
                      color: theme?.colors?.foreground || '#e0e0e0',
                      lineHeight: '1.5',
                      marginBottom: '4px'
                    }}
                    dangerouslySetInnerHTML={{ __html: item.htmlSnippet || item.snippet }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: theme?.colors?.textSecondary || '#999'
            }}>
              No results found
            </div>
          )}

          {/* Metadata */}
          {results.metadata && (
            <div style={{
              marginTop: '32px',
              padding: '16px',
              fontSize: '12px',
              color: theme?.colors?.textSecondary || '#666',
              borderTop: `1px solid ${theme?.colors?.border || '#333'}`,
              fontStyle: 'italic'
            }}>
              Data source: {results.metadata.apiType || 'unknown'} 
              {results.metadata.timestamp && ` • Retrieved: ${formatDate(results.metadata.timestamp)}`}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!results && !loading && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: theme?.colors?.textSecondary || '#999'
        }}>
          <p style={{ fontSize: '16px', marginBottom: '8px' }}>
            Enter a search query above to search Google
          </p>
          <p style={{ fontSize: '12px' }}>
            This uses Google Custom Search API to find relevant web results
          </p>
        </div>
      )}
    </div>
  );
};

export default GoogleSearchPresenter;

