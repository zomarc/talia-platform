/**
 * Google Search Service
 * Handles both public Google Custom Search API and private Google APIs data
 */

class GoogleSearchService {
  constructor() {
    // Google Custom Search API configuration
    this.customSearchApiKey = process.env.GOOGLE_SEARCH_API_KEY || '';
    this.customSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID || '';
    this.customSearchUrl = 'https://www.googleapis.com/customsearch/v1';
    
    // Google APIs configuration (for private data)
    this.clientId = process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    this.redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173/auth/google/callback';
    
    // OAuth scopes for different Google services
    this.scopes = {
      analytics: 'https://www.googleapis.com/auth/analytics.readonly',
      ads: 'https://www.googleapis.com/auth/adwords',
      searchConsole: 'https://www.googleapis.com/auth/webmasters.readonly'
    };
  }

  /**
   * Perform public Google Custom Search
   * @param {Object} options - Search options
   * @param {string} options.query - Search query
   * @param {number} options.num - Number of results (1-10)
   * @param {number} options.start - Start index (pagination)
   * @param {string} options.dateRestrict - Date restriction (e.g., 'm1' for past month)
   * @returns {Promise<Object>} Search results
   */
  async searchPublic(options = {}) {
    const { query, num = 10, start = 1, dateRestrict } = options;

    // Read environment variables at runtime (in case they weren't loaded at construction time)
    const apiKey = this.customSearchApiKey || process.env.GOOGLE_SEARCH_API_KEY || '';
    const engineId = this.customSearchEngineId || process.env.GOOGLE_SEARCH_ENGINE_ID || '';

    if (!apiKey || !engineId) {
      console.error('[GoogleSearchService] Missing credentials:', {
        hasApiKey: !!apiKey,
        hasEngineId: !!engineId,
        apiKeyLength: apiKey.length,
        engineIdLength: engineId.length,
        envApiKey: !!process.env.GOOGLE_SEARCH_API_KEY,
        envEngineId: !!process.env.GOOGLE_SEARCH_ENGINE_ID
      });
      throw new Error('Google Custom Search API credentials not configured. Set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID environment variables.');
    }

    if (!query || query.trim() === '') {
      throw new Error('Search query is required');
    }

    try {
      const params = new URLSearchParams({
        key: apiKey,
        cx: engineId,
        q: query,
        num: Math.min(Math.max(1, num), 10), // Limit to 1-10
        start: Math.max(1, start)
      });

      if (dateRestrict) {
        params.append('dateRestrict', dateRestrict);
      }

      const url = `${this.customSearchUrl}?${params.toString()}`;
      
      console.log('[GoogleSearchService] Performing public search:', { query, num, start });
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GoogleSearchService] Search API error:', response.status, errorText);
        throw new Error(`Google Search API error: ${response.status} - ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();
      
      // Transform Google Custom Search API response to our format
      return {
        query: query,
        totalResults: parseInt(data.searchInformation?.totalResults || '0', 10),
        searchTime: parseFloat(data.searchInformation?.searchTime || '0'),
        items: (data.items || []).map(item => ({
          title: item.title || '',
          link: item.link || '',
          snippet: item.snippet || '',
          displayLink: item.displayLink || '',
          formattedUrl: item.formattedUrl || '',
          htmlTitle: item.htmlTitle || item.title || '',
          htmlSnippet: item.htmlSnippet || item.snippet || '',
          pagemap: item.pagemap || {}
        })),
        spelling: data.spelling?.correctedQuery || null,
        metadata: {
          apiType: 'public',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[GoogleSearchService] Error performing public search:', error);
      throw error;
    }
  }

  /**
   * Get OAuth authorization URL for private Google services
   * @param {string} service - Service name ('analytics', 'ads', 'searchConsole')
   * @param {string} userId - User ID for state parameter
   * @returns {string} OAuth authorization URL
   */
  getOAuthUrl(service, userId) {
    if (!this.clientId) {
      throw new Error('Google OAuth client ID not configured. Set GOOGLE_CLIENT_ID environment variable.');
    }

    const scope = this.scopes[service];
    if (!scope) {
      throw new Error(`Unknown service: ${service}. Available: ${Object.keys(this.scopes).join(', ')}`);
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scope,
      access_type: 'offline',
      prompt: 'consent',
      state: JSON.stringify({ service, userId })
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from OAuth callback
   * @returns {Promise<Object>} Token response with access_token and refresh_token
   */
  async exchangeCodeForToken(code) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Google OAuth credentials not configured.');
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          grant_type: 'authorization_code'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[GoogleSearchService] Error exchanging code for token:', error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New token response
   */
  async refreshAccessToken(refreshToken) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Google OAuth credentials not configured.');
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[GoogleSearchService] Error refreshing token:', error);
      throw error;
    }
  }

  /**
   * Track a search and store its metrics for trend analysis
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @param {Object} storageService - Service to store trend data (SupabaseDataService)
   * @returns {Promise<Object>} Search result with tracking info
   */
  async searchAndTrack(query, options = {}, storageService = null) {
    // Perform the search
    const searchOptions = {
      query,
      num: options.num || 10,
      start: options.start || 1,
      dateRestrict: options.dateRestrict || null
    };

    const results = await this.searchPublic(searchOptions);

    // Store trend data if storage service provided
    if (storageService && typeof storageService.storeSearchTrend === 'function') {
      try {
        await storageService.storeSearchTrend({
          query: query,
          total_results: results.totalResults,
          search_time: results.searchTime,
          search_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
          search_timestamp: new Date().toISOString(),
          notes: options.notes || null,
          created_by: options.createdBy || null
        });
      } catch (error) {
        console.error('[GoogleSearchService] Error storing search trend:', error);
        // Don't throw - search was successful, storage is optional
      }
    }

    return results;
  }
}

// Export singleton instance
export const googleSearchService = new GoogleSearchService();
export default googleSearchService;

