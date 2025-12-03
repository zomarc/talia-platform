/**
 * Fetch Google Trends for Mediterranean (MED) cruise searches
 * Stores monthly summarized trends (not daily data points)
 */

import dotenv from 'dotenv';
import { googleTrendsService } from '../src/services/google-trends-service.js';
import { supabaseDataService } from '../src/services/supabase.js';
import { GOOGLE_TRENDS_QUERIES, ALL_QUERIES } from '../src/config/googleTrendsQueries.js';

// Load environment variables
dotenv.config();

/**
 * Filter queries to only Mediterranean/Med related searches
 */
function getMedQueries() {
  const allQueries = ALL_QUERIES;
  
  // Filter queries that contain "mediterranean", "med cruise", or "med " (with space)
  const medQueries = allQueries.filter(query => {
    const lowerQuery = query.toLowerCase();
    return lowerQuery.includes('mediterranean') || 
           lowerQuery.includes('med cruise') ||
           lowerQuery.match(/\bmed\s/); // "med " with word boundary
  });
  
  return medQueries;
}

/**
 * Fetch and store monthly summarized trends for a single query
 */
async function fetchMonthlyTrendsForQuery(query, options = {}) {
  const {
    startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year ago
    endDate = new Date().toISOString().split('T')[0],
    region = '',
  } = options;

  try {
    console.log(`📊 Fetching monthly trends for: "${query}"`);
    
    // Fetch with monthly granularity
    const trends = await googleTrendsService.getHistoricalTrends(query, {
      startDate,
      endDate,
      region,
      granularity: 'monthly' // Store monthly summaries only
    });

    if (trends && trends.length > 0) {
      // Check if we already have monthly data for this query
      const existingData = await supabaseDataService.getGoogleTrendsData({
        queries: [query],
        startDate,
        endDate,
        region
      });

      // Filter out data points we already have (by date)
      const existingDates = new Set(
        existingData.map(d => d.date)
      );
      
      const newTrendsToStore = trends
        .filter(point => !existingDates.has(point.date))
        .map(point => ({
          search_query: query,
          date: point.date,
          interest_score: point.interestScore,
          region: region || ''
        }));

      if (newTrendsToStore.length > 0) {
        await supabaseDataService.storeGoogleTrendsDataBatch(newTrendsToStore);
        console.log(`✅ Stored ${newTrendsToStore.length} monthly data points for "${query}"`);
      } else {
        console.log(`⏭️  All monthly data already exists for "${query}"`);
      }
      
      // Rate limiting - wait between queries
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return {
        query,
        dataPointsStored: newTrendsToStore.length,
        totalDataPoints: trends.length,
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
 * Fetch monthly summarized trends for all MED queries
 */
async function fetchMedTrends(options = {}) {
  const {
    startDate,
    endDate,
    region
  } = options;

  const medQueries = getMedQueries();
  
  console.log('🚀 Starting MED (Mediterranean) cruise trends fetch...');
  console.log(`📋 Found ${medQueries.length} MED-related queries\n`);

  const results = {
    total: medQueries.length,
    successful: 0,
    failed: 0,
    skipped: 0,
    totalDataPointsStored: 0,
    queries: []
  };

  try {
    for (const query of medQueries) {
      const result = await fetchMonthlyTrendsForQuery(query, {
        startDate,
        endDate,
        region
      });
      
      results.queries.push(result);
      
      if (result.success) {
        if (result.dataPointsStored === 0) {
          results.skipped++;
        } else {
          results.successful++;
          results.totalDataPointsStored += result.dataPointsStored;
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
    console.log(`📈 Total monthly data points stored: ${results.totalDataPointsStored}`);

    return results;
  } catch (error) {
    console.error('❌ Error in fetchMedTrends:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start-date' && args[i + 1]) {
      options.startDate = args[i + 1];
      i++;
    } else if (args[i] === '--end-date' && args[i + 1]) {
      options.endDate = args[i + 1];
      i++;
    } else if (args[i] === '--region' && args[i + 1]) {
      options.region = args[i + 1];
      i++;
    } else if (args[i] === '--list-queries') {
      const medQueries = getMedQueries();
      console.log(`Found ${medQueries.length} MED-related queries:\n`);
      medQueries.forEach((q, i) => console.log(`${i + 1}. ${q}`));
      process.exit(0);
    } else if (args[i] === '--help') {
      console.log(`
Usage: node fetch-med-trends.js [options]

Fetches monthly summarized Google Trends for Mediterranean cruise searches.

Options:
  --start-date <date>    Start date (YYYY-MM-DD) - default: 1 year ago
  --end-date <date>      End date (YYYY-MM-DD) - default: today
  --region <code>        Geographic region (US, GB, GR, etc.) - default: worldwide
  --list-queries         List all MED-related queries
  --help                 Show this help message

Examples:
  node fetch-med-trends.js
  node fetch-med-trends.js --start-date 2023-01-01 --end-date 2024-12-31
  node fetch-med-trends.js --region GB
  node fetch-med-trends.js --list-queries
      `);
      process.exit(0);
    }
  }

  fetchMedTrends(options)
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

export { fetchMedTrends, getMedQueries };

