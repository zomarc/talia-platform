/**
 * Script to fetch Google Trends data for all configured search queries
 * This will populate the google_trends_data table with historical trends
 */

import dotenv from 'dotenv';
import { googleTrendsService } from '../src/services/google-trends-service.js';
import { supabaseDataService } from '../src/services/supabase.js';
import { GOOGLE_TRENDS_QUERIES, ALL_QUERIES, getQueriesByCategory, getCategories } from '../src/config/googleTrendsQueries.js';

// Load environment variables
dotenv.config();

/**
 * Fetch trends for a single query
 */
async function fetchTrendsForQuery(query, options = {}) {
  const {
    startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year ago
    endDate = new Date().toISOString().split('T')[0],
    region = '',
    granularity = 'weekly'
  } = options;

  try {
    console.log(`📊 Fetching trends for: "${query}"`);
    
    // Check if we already have data for this query
    const existingData = await supabaseDataService.getGoogleTrendsData({
      queries: [query],
      startDate,
      endDate,
      region
    });

    if (existingData && existingData.length > 0) {
      console.log(`⏭️  Skipping "${query}" - already have ${existingData.length} data points`);
      return {
        query,
        dataPointsStored: 0,
        success: true,
        skipped: true,
        existingCount: existingData.length
      };
    }

    const trends = await googleTrendsService.getHistoricalTrends(query, {
      startDate,
      endDate,
      region,
      granularity
    });

    if (trends && trends.length > 0) {
      // Store in database
      const trendsToStore = trends.map(point => ({
        search_query: query,
        date: point.date,
        interest_score: point.interestScore,
        region: region || ''
      }));

      const stored = await supabaseDataService.storeGoogleTrendsDataBatch(trendsToStore);
      console.log(`✅ Stored ${stored.length} data points for "${query}"`);
      
      // Rate limiting - wait between queries to avoid hitting API limits
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return {
        query,
        dataPointsStored: stored.length,
        success: true
      };
    } else {
      console.log(`⚠️  No trends data returned for "${query}"`);
      return {
        query,
        dataPointsStored: 0,
        success: false,
        error: 'No data returned'
      };
    }
  } catch (error) {
    console.error(`❌ Error fetching trends for "${query}":`, error.message);
    return {
      query,
      dataPointsStored: 0,
      success: false,
      error: error.message
    };
  }
}

/**
 * Fetch trends for all queries in a category
 */
async function fetchTrendsForCategory(category, options = {}) {
  const queries = getQueriesByCategory(category);
  
  if (!queries || queries.length === 0) {
    console.log(`⚠️  No queries found for category: ${category}`);
    return [];
  }
  
  console.log(`\n📁 Fetching trends for category: ${category} (${queries.length} queries)`);
  
  const results = [];
  for (const query of queries) {
    const result = await fetchTrendsForQuery(query, options);
    results.push(result);
  }
  
  return results;
}

/**
 * Fetch trends for all queries
 */
async function fetchAllTrends(options = {}) {
  const {
    categories = null, // null = all categories
    queries = null, // null = all queries
    startDate,
    endDate,
    region
  } = options;

  console.log('🚀 Starting Google Trends data fetch...\n');

  const results = {
    total: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    queries: []
  };

  try {
    let queriesToFetch = [];

    if (queries && queries.length > 0) {
      // Use provided queries
      queriesToFetch = queries;
    } else if (categories && categories.length > 0) {
      // Use queries from specified categories
      queriesToFetch = categories.flatMap(cat => getQueriesByCategory(cat));
    } else {
      // Use all queries from all categories
      queriesToFetch = ALL_QUERIES;
    }

    console.log(`📋 Fetching trends for ${queriesToFetch.length} queries...\n`);

    for (const query of queriesToFetch) {
      const result = await fetchTrendsForQuery(query, {
        startDate,
        endDate,
        region
      });
      
      results.queries.push(result);
      results.total++;
      
      if (result.success) {
        if (result.skipped) {
          results.skipped++;
        } else {
          results.successful++;
        }
      } else {
        results.failed++;
      }
    }

    console.log('\n✅ Fetch complete!');
    console.log(`📊 Total queries: ${results.total}`);
    console.log(`✅ Successful: ${results.successful}`);
    console.log(`⏭️  Skipped (already exists): ${results.skipped}`);
    console.log(`❌ Failed: ${results.failed}`);

    return results;
  } catch (error) {
    console.error('❌ Error in fetchAllTrends:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const options = {};
  let categoryArg = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--category' && args[i + 1]) {
      categoryArg = args[i + 1];
      i++;
    } else if (args[i] === '--start-date' && args[i + 1]) {
      options.startDate = args[i + 1];
      i++;
    } else if (args[i] === '--end-date' && args[i + 1]) {
      options.endDate = args[i + 1];
      i++;
    } else if (args[i] === '--region' && args[i + 1]) {
      options.region = args[i + 1];
      i++;
    } else if (args[i] === '--list-categories') {
      console.log('Available categories:');
      getCategories().forEach(cat => {
        const queries = getQueriesByCategory(cat);
        console.log(`  - ${cat}: ${queries.length} queries`);
      });
      process.exit(0);
    } else if (args[i] === '--help') {
      console.log(`
Usage: node fetch-google-trends.js [options]

Options:
  --category <name>      Fetch trends for a specific category
  --start-date <date>    Start date (YYYY-MM-DD)
  --end-date <date>      End date (YYYY-MM-DD)
  --region <code>        Geographic region (US, GB, GR, etc.)
  --list-categories      List all available categories
  --help                 Show this help message

Examples:
  node fetch-google-trends.js
  node fetch-google-trends.js --category generic
  node fetch-google-trends.js --start-date 2024-01-01 --end-date 2024-12-31
  node fetch-google-trends.js --category destination_focused --region GB
      `);
      process.exit(0);
    }
  }

  if (categoryArg) {
    if (categoryArg === 'all') {
      // Fetch all categories
      options.categories = getCategories();
    } else {
      options.categories = [categoryArg];
    }
  }

  fetchAllTrends(options)
    .then((results) => {
      console.log('\n📊 Summary:');
      console.log(JSON.stringify(results, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { fetchAllTrends, fetchTrendsForQuery, fetchTrendsForCategory };
