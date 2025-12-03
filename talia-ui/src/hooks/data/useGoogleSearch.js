/**
 * Custom hook for Google Search
 * Manages search state and data fetching
 */

import { useState, useEffect, useCallback } from 'react';
import googleSearchService from '../../services/data/googleSearchService';

export const useGoogleSearch = (initialQuery = '', options = {}) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const performSearch = useCallback(async (searchQuery, searchOptions = {}) => {
    if (!searchQuery || searchQuery.trim() === '') {
      setError(new Error('Search query is required'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const searchFilters = {
        query: searchQuery,
        ...options,
        ...searchOptions
      };

      const searchResults = await googleSearchService.search(searchFilters);
      setResults(searchResults);
      setQuery(searchQuery);
    } catch (err) {
      console.error('[useGoogleSearch] Error:', err);
      setError(err);
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, [options]);

  // Auto-search if initial query provided
  useEffect(() => {
    if (initialQuery && initialQuery.trim() !== '') {
      performSearch(initialQuery);
    }
  }, []); // Only run on mount if initialQuery provided

  const search = useCallback((searchQuery, searchOptions) => {
    return performSearch(searchQuery, searchOptions);
  }, [performSearch]);

  const clearResults = useCallback(() => {
    setResults(null);
    setQuery('');
    setError(null);
  }, []);

  return {
    query,
    results,
    loading,
    error,
    search,
    clearResults,
    performSearch // Alias for search
  };
};

