/**
 * Google Search Service
 * Handles fetching Google search results via GraphQL
 */

import queryTracker from './queryTracker';

const GRAPHQL_URL = '/api/graphql';

class GoogleSearchService {
  constructor() {
    this.graphqlUrl = GRAPHQL_URL;
    this.headers = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Search Google using Custom Search API (public)
   * @param {Object} filters - Search filters
   * @param {string} filters.query - Search query (required)
   * @param {number} filters.num - Number of results (1-10, default: 10)
   * @param {number} filters.start - Start index for pagination (default: 1)
   * @param {string} filters.dateRestrict - Date restriction (e.g., 'm1' for past month)
   * @returns {Promise<Object>} Search results
   */
  async search(filters = {}) {
    const { query, num, start, dateRestrict } = filters;

    if (!query || query.trim() === '') {
      throw new Error('Search query is required');
    }

    const graphqlQuery = `
      query GoogleSearch($filters: GoogleSearchFilters!) {
        googleSearch(filters: $filters) {
          query
          totalResults
          searchTime
          spelling
          metadata {
            apiType
            timestamp
          }
          items {
            title
            link
            snippet
            displayLink
            formattedUrl
            htmlTitle
            htmlSnippet
            pagemap
          }
        }
      }
    `;

    const variables = {
      filters: {
        query: query.trim(),
        ...(num && { num }),
        ...(start && { start }),
        ...(dateRestrict && { dateRestrict })
      }
    };

    const completeQuery = queryTracker.trackQuery({
      query: graphqlQuery,
      variables,
      component: 'GoogleSearch',
      purpose: 'Fetch Google search results'
    });

    try {
      const response = await fetch(this.graphqlUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ query: graphqlQuery, variables }),
      });

      if (!response.ok) {
        let errorDetails = '';
        try {
          const errorBody = await response.clone().json();
          if (errorBody.errors) {
            errorDetails = ` GraphQL errors: ${JSON.stringify(errorBody.errors, null, 2)}`;
            console.error('[GoogleSearchService] GraphQL errors:', errorBody.errors);
          }
        } catch (e) {
          const errorText = await response.clone().text();
          errorDetails = ` Response: ${errorText.substring(0, 200)}`;
        }
        const error = new Error(`HTTP error! status: ${response.status}${errorDetails}`);
        completeQuery({ error });
        throw error;
      }

      const result = await response.json();

      if (result.errors) {
        console.error('[GoogleSearchService] GraphQL errors:', result.errors);
        console.error('[GoogleSearchService] Query that failed:', graphqlQuery);
        console.error('[GoogleSearchService] Variables:', variables);
        const error = new Error(`GraphQL errors: ${JSON.stringify(result.errors, null, 2)}`);
        completeQuery({ error });
        throw error;
      }

      const searchResult = result.data?.googleSearch;

      if (!searchResult) {
        throw new Error('No search results returned from GraphQL');
      }

      console.log('[GoogleSearchService] Search completed:', {
        query: searchResult.query,
        totalResults: searchResult.totalResults,
        itemsCount: searchResult.items?.length || 0
      });

      completeQuery({ data: searchResult });

      return searchResult;
    } catch (error) {
      console.error('[GoogleSearchService] Error performing search:', error);
      completeQuery({ error });
      throw error;
    }
  }

  /**
   * Get OAuth URL for private Google service access
   * @param {string} service - Service name ('ANALYTICS', 'ADS', 'SEARCH_CONSOLE')
   * @returns {Promise<Object>} OAuth response with authorizationUrl and state
   */
  async getOAuthUrl(service) {
    const graphqlQuery = `
      query GetGoogleOAuthUrl($service: GoogleService!) {
        googleOAuthUrl(service: $service) {
          authorizationUrl
          state
        }
      }
    `;

    const variables = { service };

    try {
      const response = await fetch(this.graphqlUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ query: graphqlQuery, variables }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.errors) {
        console.error('[GoogleSearchService] GraphQL errors:', result.errors);
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors, null, 2)}`);
      }

      return result.data?.googleOAuthUrl;
    } catch (error) {
      console.error('[GoogleSearchService] Error getting OAuth URL:', error);
      throw error;
    }
  }
}

// Export singleton instance
const googleSearchService = new GoogleSearchService();
export default googleSearchService;

