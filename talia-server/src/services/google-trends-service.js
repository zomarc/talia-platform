/**
 * Google Trends Service
 * Fetches historical Google Trends data for cruise holiday search terms
 * Uses google-trends-api npm package
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const googleTrends = require('google-trends-api');

class GoogleTrendsService {
  constructor() {
    // Default options for trends queries
    this.defaultOptions = {
      geo: '', // Empty = worldwide, or 'US', 'GB', 'GR', etc.
      category: 0, // 0 = all categories, or specific category code
      timeframe: 'today 5-y' // Last 5 years
    };
  }

  /**
   * Get historical trends data for a search query
   * @param {string} query - Search query (e.g., "cruise holidays")
   * @param {Object} options - Query options
   * @param {string} options.startDate - Start date (YYYY-MM-DD)
   * @param {string} options.endDate - End date (YYYY-MM-DD)
   * @param {string} options.region - Geographic region (e.g., 'US', 'GB', 'GR', '' for worldwide)
   * @param {string} options.granularity - 'daily', 'weekly', 'monthly' (default: 'daily')
   * @returns {Promise<Array>} Array of trend data points with date and interest score
   */
  async getHistoricalTrends(query, options = {}) {
    const {
      startDate,
      endDate,
      region = '',
      granularity = 'daily'
    } = options;

    if (!query || query.trim() === '') {
      throw new Error('Search query is required');
    }

    try {
      // Format date range for google-trends-api
      let timeframe = 'today 5-y'; // Default: last 5 years
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        timeframe = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')} ${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
      }

      // Get interest over time
      const response = await googleTrends.interestOverTime({
        keyword: query,
        startTime: startDate ? new Date(startDate) : new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000), // 5 years ago
        endTime: endDate ? new Date(endDate) : new Date(),
        geo: region
      });

      // Parse the response
      const data = JSON.parse(response);
      
      if (!data.default || !data.default.timelineData) {
        console.warn(`[GoogleTrendsService] No timeline data for query: ${query}`);
        return [];
      }

      // Transform to our format
      const trends = data.default.timelineData.map(point => {
        const date = new Date(point.time * 1000); // Convert from timestamp
        return {
          date: date.toISOString().split('T')[0], // YYYY-MM-DD
          interestScore: point.value[0] || 0, // Interest score 0-100
          timestamp: date.toISOString()
        };
      });

      // Apply granularity filter if needed
      if (granularity === 'weekly') {
        // Keep only one data point per week
        const weeklyData = [];
        let lastWeek = null;
        for (const point of trends) {
          const week = this.getWeekNumber(new Date(point.date));
          if (lastWeek !== week) {
            weeklyData.push(point);
            lastWeek = week;
          }
        }
        return weeklyData;
      } else if (granularity === 'monthly') {
        // Aggregate to monthly summaries - average interest scores per month
        const monthlyMap = new Map();
        
        for (const point of trends) {
          const month = point.date.substring(0, 7); // YYYY-MM
          const monthKey = `${month}-01`; // Normalize to first of month
          
          if (!monthlyMap.has(monthKey)) {
            monthlyMap.set(monthKey, {
              date: monthKey,
              interestScores: [],
              timestamp: new Date(`${month}-01`).toISOString()
            });
          }
          
          monthlyMap.get(monthKey).interestScores.push(point.interestScore);
        }
        
        // Calculate average interest score per month
        const monthlyData = Array.from(monthlyMap.values()).map(monthData => ({
          date: monthData.date,
          interestScore: Math.round(
            monthData.interestScores.reduce((sum, score) => sum + score, 0) / monthData.interestScores.length
          ),
          timestamp: monthData.timestamp
        }));
        
        // Sort by date
        monthlyData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        return monthlyData;
      }

      return trends;
    } catch (error) {
      console.error(`[GoogleTrendsService] Error fetching trends for "${query}":`, error);
      throw new Error(`Failed to fetch Google Trends data: ${error.message}`);
    }
  }

  /**
   * Compare multiple search queries
   * @param {Array<string>} queries - Array of search queries
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Comparison data with multiple series
   */
  async compareQueries(queries, options = {}) {
    const {
      startDate,
      endDate,
      region = ''
    } = options;

    if (!Array.isArray(queries) || queries.length === 0) {
      throw new Error('At least one query is required for comparison');
    }

    try {
      const startTime = startDate ? new Date(startDate) : new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000);
      const endTime = endDate ? new Date(endDate) : new Date();

      const response = await googleTrends.interestOverTime({
        keyword: queries,
        startTime,
        endTime,
        geo: region
      });

      const data = JSON.parse(response);
      
      if (!data.default || !data.default.timelineData) {
        return {
          queries,
          data: []
        };
      }

      // Transform to our format with multiple queries
      const timelineData = data.default.timelineData.map(point => {
        const date = new Date(point.time * 1000);
        const values = {};
        
        queries.forEach((query, index) => {
          values[query] = point.value[index] || 0;
        });

        return {
          date: date.toISOString().split('T')[0],
          values,
          timestamp: date.toISOString()
        };
      });

      return {
        queries,
        data: timelineData
      };
    } catch (error) {
      console.error(`[GoogleTrendsService] Error comparing queries:`, error);
      throw new Error(`Failed to compare Google Trends queries: ${error.message}`);
    }
  }

  /**
   * Get related queries (what people also search for)
   * @param {string} query - Search query
   * @param {string} type - 'top' or 'rising'
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of related queries
   */
  async getRelatedQueries(query, type = 'top', options = {}) {
    const { region = '' } = options;

    try {
      const response = await googleTrends.relatedQueries({
        keyword: query,
        geo: region
      });

      const data = JSON.parse(response);
      const relatedData = data.default?.rankedList?.find(list => list.rankedKeyword[0].value === query);
      
      if (!relatedData) {
        return [];
      }

      const queries = relatedData.rankedKeyword.slice(0, 10).map(item => ({
        query: item.query,
        value: item.value,
        formattedValue: item.formattedValue
      }));

      return queries;
    } catch (error) {
      console.error(`[GoogleTrendsService] Error fetching related queries:`, error);
      // Return empty array on error rather than throwing
      return [];
    }
  }

  /**
   * Get week number for a date
   * @private
   */
  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }
}

// Export singleton instance
export const googleTrendsService = new GoogleTrendsService();
export default googleTrendsService;

