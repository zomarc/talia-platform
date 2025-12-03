/**
 * Demand Heatmap Data Service
 * Aggregates demand data (reservations/bookings) by itinerary and departure month
 */

import queryTracker from './queryTracker';

const GRAPHQL_URL = '/api/graphql';

class DemandHeatmapService {
  constructor() {
    this.graphqlUrl = GRAPHQL_URL;
    this.headers = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Fetch demand heatmap data aggregated by itinerary and departure month
   * Uses reservations as a proxy for "viewing demand"
   * @param {Object} filters - Query filters (dateRange, region, etc.)
   * @returns {Promise<Array>} Array of demand records grouped by itinerary and month
   */
  async fetch(filters = {}) {
    const { dateFrom, dateTo, region, geogAreaCode } = filters;
    
    // Build GraphQL query to get aggregated demand heatmap data
    // Uses the new demand_heatmap_data table which supports mock data
    const query = `
      query GetDemandHeatmapData($filters: DemandHeatmapFilters, $includeMockData: Boolean) {
        demandHeatmapData(filters: $filters, includeMockData: $includeMockData) {
          data {
            region
            itinerary
            geog_area_code
            months {
              month
              guest_count
            }
          }
          months
          containsMockData
        }
      }
    `;

    // Build variables - convert date filters to month filters
    const demandFilters = {};
    if (region) demandFilters.region = region;
    if (geogAreaCode) demandFilters.geog_area_code = geogAreaCode;
    if (dateFrom) {
      // Convert date to month format (YYYY-MM)
      const date = new Date(dateFrom);
      demandFilters.departure_month_from = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    if (dateTo) {
      // Convert date to month format (YYYY-MM)
      const date = new Date(dateTo);
      demandFilters.departure_month_to = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    const variables = {
      filters: demandFilters,
      includeMockData: true // Always include mock data for testing
    };

    const completeQuery = queryTracker.trackQuery({
      query,
      variables,
      component: 'DemandHeatmap',
      purpose: 'Fetch demand heatmap data'
    });

    try {
      const response = await fetch(this.graphqlUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        // Try to get error details from response body
        let errorDetails = '';
        try {
          const errorBody = await response.clone().json();
          if (errorBody.errors) {
            errorDetails = ` GraphQL errors: ${JSON.stringify(errorBody.errors, null, 2)}`;
            console.error('[DemandHeatmapService] GraphQL errors:', errorBody.errors);
          }
        } catch (e) {
          // Response might not be JSON
          const errorText = await response.clone().text();
          errorDetails = ` Response: ${errorText.substring(0, 200)}`;
        }
        const error = new Error(`HTTP error! status: ${response.status}${errorDetails}`);
        completeQuery({ error });
        throw error;
      }

      const result = await response.json();
      
      if (result.errors) {
        console.error('[DemandHeatmapService] GraphQL errors:', result.errors);
        const error = new Error(`GraphQL errors: ${JSON.stringify(result.errors, null, 2)}`);
        completeQuery({ error });
        throw error;
      }
      
      // Log the raw response for debugging
      if (!result.data) {
        console.error('[DemandHeatmapService] No data in response:', result);
      }

      const heatmapResult = result.data?.demandHeatmapData;
      
      if (!heatmapResult) {
        throw new Error('No demand heatmap data returned from GraphQL');
      }

      // Store mock data flag for component to display
      this.containsMockData = heatmapResult.containsMockData || false;

      console.log('[DemandHeatmapService] Received aggregated data:', {
        rowCount: heatmapResult.data?.length || 0,
        monthsCount: heatmapResult.months?.length || 0,
        containsMockData: heatmapResult.containsMockData,
        sampleRow: heatmapResult.data?.[0]
      });

      // Transform GraphQL response to match expected format
      // The resolver already adds months as direct properties, so we just need to extract them
      const transformedData = heatmapResult.data.map(row => {
        const transformedRow = {
          region: row.region,
          itinerary: row.itinerary,
          geog_area_code: row.geog_area_code
        };
        
        // Add each month as a direct property (already set by resolver, but ensure all months are included)
        heatmapResult.months.forEach(month => {
          // Use direct property if available (from resolver), otherwise check months array
          if (row[month] !== undefined) {
            transformedRow[month] = parseFloat(row[month]) || null;
          } else {
            const monthData = row.months?.find(m => m.month === month);
            transformedRow[month] = monthData ? parseFloat(monthData.guest_count) : null;
          }
        });
        
        return transformedRow;
      });

      const aggregatedData = {
        data: transformedData,
        months: heatmapResult.months || [],
        containsMockData: heatmapResult.containsMockData || false
      };

      console.log('[DemandHeatmapService] Transformed to', aggregatedData.data.length, 'rows with', aggregatedData.months.length, 'months');
      completeQuery({ data: aggregatedData });
      
      return aggregatedData;
    } catch (error) {
      console.error('[DemandHeatmapService] Error fetching data:', error);
      completeQuery({ error });
      throw error;
    }
  }

  /**
   * Aggregate reservation data by itinerary and departure month
   * Maps geog_area_code to region names
   */
  aggregateDemandData(reservations, masterSail) {
    // Create a map of sail_code -> master_sail info
    const sailInfoMap = new Map();
    masterSail.forEach(sail => {
      sailInfoMap.set(sail.sail_code, {
        package_name: sail.package_name,
        geog_area_code: sail.geog_area_code,
        sail_date_from: sail.sail_date_from
      });
    });

    // Map geog_area_code to region names
    const regionMap = {
      'ADRIATIC': 'Mediterranean',
      'AEGEAN': 'Mediterranean',
      'GULF': 'Gulf',
      'GULF_ARABIA': 'Gulf',
      'ARABIA': 'Gulf',
      'MEDITERRANEAN': 'Mediterranean',
      'RED_SEA': 'Gulf'
    };

    // Aggregate by itinerary and month
    const demandMap = new Map();

    // First, initialize all itineraries from masterSail (even without reservations)
    const allMonthsFromSail = new Set(); // Track all months from masterSail
    
    console.log('[DemandHeatmapService] Processing', masterSail.length, 'masterSail records');
    
    masterSail.forEach((sail, index) => {
      if (!sail.package_name || !sail.sail_date_from) {
        if (index < 5) console.log('[DemandHeatmapService] Skipping sail (missing data):', { package_name: sail.package_name, sail_date_from: sail.sail_date_from });
        return;
      }

      const date = new Date(sail.sail_date_from);
      if (isNaN(date.getTime())) {
        if (index < 5) console.log('[DemandHeatmapService] Skipping sail (invalid date):', { sail_date_from: sail.sail_date_from, parsed: date });
        return;
      }

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      allMonthsFromSail.add(monthKey); // Track this month
      
      if (index < 5) console.log('[DemandHeatmapService] Processed sail:', { 
        sail_code: sail.sail_code, 
        sail_date_from: sail.sail_date_from,
        monthKey 
      });
      
      // Map geog_area_code to region
      const geogArea = sail.geog_area_code || '';
      const region = this.mapRegion(geogArea, regionMap);

      // Create unique key for itinerary + region
      const itineraryKey = `${region}|||${sail.package_name}`;

      if (!demandMap.has(itineraryKey)) {
        demandMap.set(itineraryKey, {
          region,
          itinerary: sail.package_name,
          geog_area_code: geogArea,
          months: new Map()
        });
      }
    });

    // Then, add reservation counts to existing itineraries
    reservations.forEach(res => {
      if (!res.sail_code) return;
      
      const sailInfo = sailInfoMap.get(res.sail_code);
      if (!sailInfo || !sailInfo.package_name) return;

      // Get departure month from reservation or master_sail
      const sailDate = res.sail_from_date || sailInfo.sail_date_from;
      if (!sailDate) return;

      const date = new Date(sailDate);
      if (isNaN(date.getTime())) return; // Skip invalid dates

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      // Map geog_area_code to region
      const geogArea = sailInfo.geog_area_code || '';
      const region = this.mapRegion(geogArea, regionMap);

      // Create unique key for itinerary + region
      const itineraryKey = `${region}|||${sailInfo.package_name}`;

      // Ensure itinerary exists in map
      if (!demandMap.has(itineraryKey)) {
        demandMap.set(itineraryKey, {
          region,
          itinerary: sailInfo.package_name,
          geog_area_code: geogArea,
          months: new Map()
        });
      }

      const record = demandMap.get(itineraryKey);
      const currentCount = record.months.get(monthKey) || 0;
      record.months.set(monthKey, currentCount + (parseFloat(res.guest_count) || 1));
    });

    // Convert to array format and get all unique months
    // Include months from both reservations and masterSail
    const allMonths = new Set(allMonthsFromSail);
    demandMap.forEach(record => {
      record.months.forEach((count, month) => allMonths.add(month));
    });

    const sortedMonths = Array.from(allMonths).sort();
    
    console.log('[DemandHeatmapService] Months from masterSail:', Array.from(allMonthsFromSail).sort());
    console.log('[DemandHeatmapService] Final sorted months:', sortedMonths);
    console.log('[DemandHeatmapService] Number of months detected:', sortedMonths.length);

    // Convert to flat array with month columns
    const result = Array.from(demandMap.values()).map(record => {
      const row = {
        region: record.region,
        itinerary: record.itinerary,
        geog_area_code: record.geog_area_code
      };

      // Add each month as a column
      sortedMonths.forEach(month => {
        row[month] = record.months.get(month) || null;
      });

      return row;
    });

    // Sort by region, then itinerary
    result.sort((a, b) => {
      if (a.region !== b.region) {
        return (a.region || '').localeCompare(b.region || '');
      }
      return (a.itinerary || '').localeCompare(b.itinerary || '');
    });

    return {
      data: result,
      months: sortedMonths
    };
  }

  /**
   * Map geog_area_code to friendly region name
   */
  mapRegion(geogAreaCode, regionMap) {
    if (!geogAreaCode) return 'Unknown';
    
    const upper = geogAreaCode.toUpperCase();
    
    // Check exact matches first
    if (regionMap[upper]) {
      return regionMap[upper];
    }

    // Check partial matches
    if (upper.includes('ADRIATIC') || upper.includes('AEGEAN')) {
      return 'Mediterranean';
    }
    if (upper.includes('GULF') || upper.includes('ARABIA') || upper.includes('RED')) {
      return 'Gulf';
    }

    return 'Unknown';
  }
}

// Export singleton instance
const demandHeatmapService = new DemandHeatmapService();
export default demandHeatmapService;
