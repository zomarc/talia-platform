// Enhanced GraphQL Resolvers for Talia Focus Management System

import { sampleData } from './schema.js';
import { supabaseDataService } from '../services/supabase.js';
import { synapseSyncService } from '../services/synapse-sync.js';
import { googleSearchService } from '../services/google-search.js';
import { googleTrendsService } from '../services/google-trends.js';
import { googleTrendsService as googleTrendsApiService } from '../services/google-trends-service.js';
import { getCategories, getQueriesByCategory, ALL_QUERIES } from '../config/googleTrendsQueries.js';

// Helper function to check user permissions
const hasPermission = (userRole: string, requiredRole: string): boolean => {
  const roleHierarchy = {
    'GUEST': 0,
    'USER': 1,
    'MANAGER': 2,
    'ADMIN': 3
  };
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};

// Helper function to filter data based on user role
const filterDataByRole = (data: any[], userRole: string, roleField?: string) => {
  if (!userRole) return data;
  
  // For now, return all data. In production, implement role-based filtering
  return data;
};

// Helper function to map database focus to GraphQL Focus format
const mapDbFocusToGraphQL = (dbFocus: any) => {
  if (!dbFocus) return null;
  
  // Extract components from layout_data if it exists
  const layoutData = dbFocus.layout_data || {};
  const components = layoutData.components || [];
  
  // Use first assigned role as the primary role, or default to ADMIN
  const primaryRole = dbFocus.assigned_roles && dbFocus.assigned_roles.length > 0 
    ? dbFocus.assigned_roles[0].toUpperCase() 
    : 'ADMIN';
  
  return {
    id: dbFocus.id,
    name: dbFocus.name,
    description: dbFocus.description || null,
    type: dbFocus.type ? dbFocus.type.toUpperCase() : 'USER',
    role: primaryRole,
    components: components.map((comp: any, index: number) => ({
      id: comp.id || `comp-${index}`,
      type: comp.type || 'TABLE',
      position: comp.position || { x: 0, y: 0, width: 6, height: 4 },
      settings: comp.settings || null,
      dataSource: comp.dataSource || null
    })),
    // Include full layoutData as JSON for dockviewLayout preservation
    layoutData: layoutData,
    createdBy: dbFocus.created_by || '',
    createdAt: dbFocus.created_at || new Date().toISOString(),
    updatedAt: dbFocus.updated_at || dbFocus.created_at || new Date().toISOString(),
    isPublic: dbFocus.is_standard || false
  };
};

// Helper function to map GraphQL FocusInput to database format
const mapGraphQLFocusToDb = (input: any, createdBy?: string) => {
  // Extract components and store in layout_data
  const layoutData = {
    components: input.components || []
  };
  
  // Convert single role to array if needed
  const assignedRoles = input.assignedRoles || (input.role ? [input.role] : []);
  
  return {
    name: input.name,
    description: input.description || null,
    type: input.type ? input.type.toLowerCase() : 'user',
    isStandard: input.isPublic !== undefined ? input.isPublic : (input.isStandard || false),
    assignedRoles: assignedRoles.map((r: string) => r.toUpperCase()),
    isDefault: input.isDefault || false,
    isActive: input.isActive !== undefined ? input.isActive : true,
    createdBy: createdBy,
    layoutData: layoutData
  };
};

export const resolvers = {
  Query: {
    // User Management
    me: () => {
      // In a real app, this would get the current user from the context
      return sampleData.users[0]; // Return admin user for demo
    },
    
    users: () => {
      return sampleData.users;
    },

    taliaUser: async (parent: any, args: any) => {
      const { email } = args;
      try {
        const taliaUser = await supabaseDataService.getTaliaUserByEmail(email);
        if (!taliaUser) return null;
        
        return {
          id: taliaUser.id,
          taliaUserId: taliaUser.talia_user_id,
          email: taliaUser.email,
          createdAt: taliaUser.created_at,
          updatedAt: taliaUser.updated_at,
          lastLoginAt: taliaUser.last_login_at
        };
      } catch (error) {
        console.error('Error fetching talia user:', error);
        throw new Error(`Failed to fetch talia user: ${error.message}`);
      }
    },

    // Focus Management
    focuses: async (parent: any, args: any, context: any) => {
      const { filters } = args;
      try {
        // Get focuses from Supabase
        const dbFocuses = await supabaseDataService.getFocuses(filters || {});
        
        // Map to GraphQL format
        const mappedFocuses = dbFocuses.map(mapDbFocusToGraphQL).filter(Boolean);
        
        // Apply additional filtering if needed
        let filteredFocuses = mappedFocuses;
        if (filters) {
          if (filters.role) {
            filteredFocuses = filteredFocuses.filter(focus => focus.role === filters.role);
          }
          if (filters.type) {
            filteredFocuses = filteredFocuses.filter(focus => focus.type === filters.type);
          }
          if (filters.isPublic !== undefined) {
            filteredFocuses = filteredFocuses.filter(focus => focus.isPublic === filters.isPublic);
          }
        }
        
        return filteredFocuses;
      } catch (error) {
        console.error('Error fetching focuses:', error);
        // Fallback to sample data on error
        return sampleData.focuses;
      }
    },

    focus: async (parent: any, args: any) => {
      const { id } = args;
      try {
        const dbFocus = await supabaseDataService.getFocusById(id);
        return mapDbFocusToGraphQL(dbFocus);
      } catch (error) {
        console.error('Error fetching focus:', error);
        // Fallback to sample data
        return sampleData.focuses.find(focus => focus.id === id);
      }
    },

    focusesByRole: async (parent: any, args: any) => {
      const { role } = args;
      try {
        const normalizedRole = role?.toUpperCase() || 'USER';
        console.log(`[focusesByRole] Called with role: ${normalizedRole}`);
        
        // Get all active focuses from Supabase
        const allFocuses = await supabaseDataService.getFocuses();
        console.log(`[focusesByRole] Got ${allFocuses.length} focuses from getFocuses()`);
        
        if (allFocuses.length === 0) {
          console.log(`[focusesByRole] No focuses returned, returning empty array`);
          return [];
        }
        
        console.log(`[focusesByRole] First focus:`, {
          name: allFocuses[0].name,
          assigned_roles: allFocuses[0].assigned_roles,
          is_active: allFocuses[0].is_active
        });
        
        // Filter focuses where assigned_roles array contains the requested role
        const filteredFocuses = allFocuses.filter(focus => {
          // Skip inactive focuses (though getFocuses already filters these)
          if (focus.is_active === false) {
            return false;
          }
          
          // Must have assigned_roles array
          if (!focus.assigned_roles || !Array.isArray(focus.assigned_roles)) {
            return false;
          }
          
          // Check if any assigned role matches (case-insensitive)
          const matches = focus.assigned_roles.some(assignedRole => 
            String(assignedRole).toUpperCase() === normalizedRole
          );
          
          return matches;
        });
        
        console.log(`[focusesByRole] Filtered to ${filteredFocuses.length} focuses`);
        
        // Map to GraphQL format
        const mapped = filteredFocuses.map(mapDbFocusToGraphQL).filter(Boolean);
        console.log(`[focusesByRole] Mapped to ${mapped.length} GraphQL focuses`);
        
        return mapped;
      } catch (error) {
        console.error('[focusesByRole] Error:', error);
        console.error('[focusesByRole] Error stack:', error.stack);
        throw error;
      }
    },

    myFocuses: async (parent: any, args: any, context: any) => {
      try {
        // In a real app, get current user from context
        const userId = context?.user?.id || "1";
        const dbFocuses = await supabaseDataService.getFocuses({ createdBy: userId });
        return dbFocuses.map(mapDbFocusToGraphQL).filter(Boolean);
      } catch (error) {
        console.error('Error fetching my focuses:', error);
        // Fallback to sample data
        return sampleData.focuses.filter(focus => focus.createdBy === "1");
      }
    },

    myFocusPreferences: async (parent: any, args: any, context: any) => {
      try {
        // In a real app, get current user from context
        const userId = context?.user?.id || "1";
        let preferences;
        try {
          preferences = await supabaseDataService.getUserFocusPreferences(userId);
        } catch (serviceError) {
          console.error('Error calling getUserFocusPreferences:', serviceError);
          return [];
        }
        
        // Ensure we always return an array, never null
        if (!preferences || !Array.isArray(preferences)) {
          return [];
        }
        
        // Map database format to GraphQL format
        const mapped = preferences.map((pref: any) => ({
          id: pref.id,
          userId: pref.user_id,
          focusId: pref.focus_id,
          isFavorite: pref.is_favorite || false,
          lastUsed: pref.last_used || null,
          customLayout: pref.custom_layout || null,
          createdAt: pref.created_at || new Date().toISOString(),
          updatedAt: pref.updated_at || pref.created_at || new Date().toISOString()
        }));
        
        return mapped;
      } catch (error) {
        console.error('Error fetching my focus preferences:', error);
        // Return empty array instead of null to satisfy non-nullable field
        return [];
      }
    },

    focusGroups: async (parent: any, args: any) => {
      const { isActive } = args;
      try {
        // Get focus groups from Supabase
        const filters = isActive !== undefined ? { isActive } : {};
        const focusGroups = await supabaseDataService.getFocusGroups(filters);
        // Always return an array, never null (required by GraphQL schema)
        if (!focusGroups || !Array.isArray(focusGroups)) {
          return [];
        }
        return focusGroups;
      } catch (error) {
        console.error('Error fetching focus groups:', error);
        // Return empty array instead of null to satisfy non-nullable field
        return [];
      }
    },

    // Data Queries with Role-based Filtering
    sailings: (parent: any, args: any) => {
      const { filters, userRole } = args;
      let sailings = filterDataByRole(sampleData.sailings, userRole);

      if (filters) {
        if (filters.ship) {
          sailings = sailings.filter(sailing => sailing.ship === filters.ship);
        }
        if (filters.sailing) {
          sailings = sailings.filter(sailing => 
            sailing.sailing.toLowerCase().includes(filters.sailing.toLowerCase())
          );
        }
        if (filters.status) {
          sailings = sailings.filter(sailing => sailing.status === filters.status);
        }
        if (filters.dateFrom) {
          sailings = sailings.filter(sailing => sailing.depart >= filters.dateFrom);
        }
        if (filters.dateTo) {
          sailings = sailings.filter(sailing => sailing.depart <= filters.dateTo);
        }
        if (filters.bookedMin) {
          sailings = sailings.filter(sailing => sailing.booked >= filters.bookedMin);
        }
        if (filters.bookedMax) {
          sailings = sailings.filter(sailing => sailing.booked <= filters.bookedMax);
        }
      }

      return sailings;
    },

    masterSail: async (parent: any, args: any) => {
      const { filters } = args;
      try {
        // Get data from Supabase
        const supabaseData = await supabaseDataService.getMasterSail(filters || {});
        
        // Transform dates to strings for GraphQL
        return supabaseData.map(sail => ({
          ...sail,
          sail_date_from: sail.sail_date_from ? new Date(sail.sail_date_from).toISOString().split('T')[0] : null,
          sail_date_to: sail.sail_date_to ? new Date(sail.sail_date_to).toISOString().split('T')[0] : null,
          vacation_date: sail.vacation_date ? new Date(sail.vacation_date).toISOString().split('T')[0] : null,
          master_voyage_departure_date: sail.master_voyage_departure_date ? new Date(sail.master_voyage_departure_date).toISOString().split('T')[0] : null,
          created_at: sail.created_at ? new Date(sail.created_at).toISOString() : null
        }));
      } catch (error) {
        console.error('Error fetching master sail data:', error);
        // Return empty array on error rather than throwing
        return [];
      }
    },

    reservations: async (parent: any, args: any) => {
      const { filters } = args;
      try {
        // Get data from Supabase
        const supabaseData = await supabaseDataService.getReservations(filters || {});
        
        // Transform dates to strings for GraphQL
        return supabaseData.map(reservation => ({
          ...reservation,
          sail_from_date: reservation.sail_from_date ? new Date(reservation.sail_from_date).toISOString().split('T')[0] : null,
          sail_to_date: reservation.sail_to_date ? new Date(reservation.sail_to_date).toISOString().split('T')[0] : null,
          created_at: reservation.created_at ? new Date(reservation.created_at).toISOString() : null
        }));
      } catch (error) {
        console.error('Error fetching reservations data:', error);
        // Return empty array on error rather than throwing
        return [];
      }
    },

    ships: async () => {
      try {
        // Try to get data from Supabase first (local development)
        const supabaseData = await supabaseDataService.getShips();
        if (supabaseData && supabaseData.length > 0) {
          // Transform Supabase data to match GraphQL schema
          return supabaseData.map(ship => ({
            Ship_Id: ship.ship_id,
            Ship_Code: ship.ship_code,
            Ship_Name: ship.ship_name,
            Ship_Pax_Capacity: ship.ship_pax_capacity,
            Ship_Length: ship.ship_length,
            Ship_Tonnage: ship.ship_tonnage
          }));
        }
        
        // Fallback to sample data
        return [
          { Ship_Id: 1, Ship_Code: "DIS", Ship_Name: "Celestyal Discovery", Ship_Pax_Capacity: "950", Ship_Length: "180m", Ship_Tonnage: "45000" },
          { Ship_Id: 2, Ship_Code: "JRN", Ship_Name: "Celestyal Journey", Ship_Pax_Capacity: "980", Ship_Length: "185m", Ship_Tonnage: "47000" }
        ];
      } catch (error) {
        console.error('Error fetching ships data:', error);
        // Fallback to sample data
        return [
          { Ship_Id: 1, Ship_Code: "DIS", Ship_Name: "Celestyal Discovery", Ship_Pax_Capacity: "950", Ship_Length: "180m", Ship_Tonnage: "45000" },
          { Ship_Id: 2, Ship_Code: "JRN", Ship_Name: "Celestyal Journey", Ship_Pax_Capacity: "980", Ship_Length: "185m", Ship_Tonnage: "47000" }
        ];
      }
    },

    cabinAvailability: async (parent: any, args: any) => {
      const { filters } = args;
      try {
        // Try to get data from Supabase first (local development)
        const supabaseData = await supabaseDataService.getCabinAvailability(filters);
        if (supabaseData && supabaseData.length > 0) {
          // Transform Supabase data to match GraphQL schema
          return supabaseData.map(cabin => ({
            Snapshot_Date: cabin.snapshot_date,
            Sail_Code: cabin.sail_code,
            Package_Name: cabin.package_name,
            Sail_Days: cabin.sail_days,
            Cabin_Category: cabin.cabin_category,
            Available_Cabins: cabin.available_cabins,
            Total_Cabins: cabin.total_cabins,
            Available_Absolute: cabin.available_absolute,
            Available_Weighted: cabin.available_weighted,
            Availability_Result: cabin.availability_result,
            Nested_Cabins: cabin.nested_cabins
          }));
        }
        
        // Fallback to sample data
        return [
          {
            Snapshot_Date: "2025-01-01",
            Package_Name: "7N Islands",
            Sail_Days: 7,
            Cabin_Category: "Interior",
            Available_Cabins: 120,
            Total_Cabins: 150,
            Available_Absolute: 120,
            Available_Weighted: 115.5,
            Availability_Result: "Good",
            Nested_Cabins: 0
          }
        ];
      } catch (error) {
        console.error('Error fetching cabin availability data:', error);
        // Fallback to sample data
        return [
          {
            Snapshot_Date: "2025-01-01",
            Package_Name: "7N Islands",
            Sail_Days: 7,
            Cabin_Category: "Interior",
            Available_Cabins: 120,
            Total_Cabins: 150,
            Available_Absolute: 120,
            Available_Weighted: 115.5,
            Availability_Result: "Good",
            Nested_Cabins: 0
          }
        ];
      }
    },

    kpis: async (parent: any, args: any) => {
      const { userRole } = args;
      try {
        // Try to get data from Supabase first (local development)
        const supabaseData = await supabaseDataService.getKPIs(userRole);
        if (supabaseData && supabaseData.length > 0) {
          return supabaseData;
        }
        
        // Fallback to sample data
        return filterDataByRole(sampleData.kpis, userRole);
      } catch (error) {
        console.error('Error fetching KPIs data:', error);
        // Fallback to sample data
        return filterDataByRole(sampleData.kpis, userRole);
      }
    },

    exceptions: async (parent: any, args: any) => {
      const { userRole } = args;
      
      // Only managers and admins can see exceptions
      if (!hasPermission(userRole, 'MANAGER')) {
        return [];
      }
      
      try {
        // Try to get data from Supabase first (local development)
        const supabaseData = await supabaseDataService.getExceptions(userRole);
        if (supabaseData && supabaseData.length > 0) {
          return supabaseData;
        }
        
        // Fallback to sample data
        return filterDataByRole(sampleData.exceptions, userRole);
      } catch (error) {
        console.error('Error fetching exceptions data:', error);
        // Fallback to sample data
        return filterDataByRole(sampleData.exceptions, userRole);
      }
    },

    // Google Search
    googleSearch: async (parent: any, args: any) => {
      const { filters } = args;
      try {
        if (!filters || !filters.query) {
          throw new Error('Search query is required');
        }

        const searchOptions = {
          query: filters.query,
          num: filters.num || 10,
          start: filters.start || 1,
          dateRestrict: filters.dateRestrict || null
        };

        const results = await googleSearchService.searchPublic(searchOptions);
        
        // Optionally track the search for trends (if trackTrend flag is set)
        if (filters.trackTrend) {
          try {
            await supabaseDataService.storeSearchTrend({
              query: filters.query,
              total_results: results.totalResults,
              search_time: results.searchTime,
              search_date: new Date().toISOString().split('T')[0],
              search_timestamp: new Date().toISOString()
            });
          } catch (error) {
            console.error('Error tracking search trend:', error);
            // Don't fail the search if tracking fails
          }
        }
        
        return {
          query: results.query,
          totalResults: results.totalResults,
          searchTime: results.searchTime,
          items: results.items,
          spelling: results.spelling,
          metadata: results.metadata
        };
      } catch (error) {
        console.error('Error performing Google search:', error);
        throw error;
      }
    },

    googleOAuthUrl: async (parent: any, args: any, context: any) => {
      const { service } = args;
      const userId = context.user?.id || 'anonymous';
      
      try {
        const serviceMap = {
          'ANALYTICS': 'analytics',
          'ADS': 'ads',
          'SEARCH_CONSOLE': 'searchConsole'
        };

        const serviceName = serviceMap[service];
        if (!serviceName) {
          throw new Error(`Invalid service: ${service}. Must be one of: ANALYTICS, ADS, SEARCH_CONSOLE`);
        }

        const authUrl = googleSearchService.getOAuthUrl(serviceName, userId);
        
        return {
          authorizationUrl: authUrl,
          state: JSON.stringify({ service: serviceName, userId })
        };
      } catch (error) {
        console.error('Error generating OAuth URL:', error);
        throw error;
      }
    },

    googleSearchTrends: async (parent: any, args: any) => {
      const { filters = {} } = args;
      try {
        const rawData = await supabaseDataService.getSearchTrends(filters);
        
        if (!rawData || rawData.length === 0) {
          return {
            queries: [],
            series: [],
            dateRange: {
              from: filters.dateFrom || new Date().toISOString().split('T')[0],
              to: filters.dateTo || new Date().toISOString().split('T')[0]
            },
            totalDataPoints: 0
          };
        }

        // Group by query
        const queries = [...new Set(rawData.map(item => item.query))];
        const series = queries.map(query => {
          const queryData = rawData
            .filter(item => item.query === query)
            .sort((a, b) => new Date(a.search_date).getTime() - new Date(b.search_date).getTime());
          
          const dataPoints = queryData.map(item => ({
            date: item.search_date,
            totalResults: item.total_results,
            searchTime: item.search_time || null,
            timestamp: item.search_timestamp
          }));

          // Calculate change
          let change = null;
          let changePercent = null;
          if (dataPoints.length >= 2) {
            const first = dataPoints[0].totalResults;
            const last = dataPoints[dataPoints.length - 1].totalResults;
            change = last - first;
            changePercent = first > 0 ? ((change / first) * 100) : 0;
          }

          return {
            query,
            dataPoints,
            latestCount: dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].totalResults : 0,
            change: change || 0,
            changePercent: changePercent || 0
          };
        });

        // Get date range
        const dates = rawData.map(item => item.search_date).sort();
        const dateRange = {
          from: dates[0] || new Date().toISOString().split('T')[0],
          to: dates[dates.length - 1] || new Date().toISOString().split('T')[0]
        };

        return {
          queries,
          series,
          dateRange,
          totalDataPoints: rawData.length
        };
      } catch (error) {
        console.error('Error fetching Google search trends:', error);
        throw error;
      }
    },

    trackedSearchQueries: async () => {
      try {
        const queries = await supabaseDataService.getTrackedQueries();
        return queries;
      } catch (error) {
        console.error('Error fetching tracked queries:', error);
        throw error;
      }
    },

    historicalSearchTrends: async (parent: any, args: any) => {
      const { query, startDate, endDate, intervalDays = 7 } = args;
      try {
        if (!query || !startDate || !endDate) {
          throw new Error('Query, startDate, and endDate are required');
        }

        const trends = await googleTrendsService.getHistoricalTrends(query, {
          startDate,
          endDate,
          intervalDays
        });

        return trends.map(point => ({
          date: point.date,
          totalResults: point.totalResults,
          searchTime: point.searchTime || null
        }));
      } catch (error) {
        console.error('Error fetching historical search trends:', error);
        throw error;
      }
    },

    // Google Trends (what people are searching for)
    googleTrends: async (parent: any, args: any) => {
      const { filters } = args;
      try {
        if (!filters || !filters.queries || filters.queries.length === 0) {
          throw new Error('At least one query is required in filters.queries');
        }

        const { queries, startDate, endDate, region = '', granularity = 'daily', limit } = filters;

        // Try to get data from database first
        let dbData = await supabaseDataService.getGoogleTrendsData({
          queries,
          startDate,
          endDate,
          region,
          limit
        });

        // If no data in DB or incomplete, fetch from Google Trends API
        if (!dbData || dbData.length === 0) {
          console.log(`[GoogleTrends Resolver] No data in DB for queries: ${queries.join(', ')}, fetching from API...`);
          
          // Fetch from Google Trends API
          const apiData = await googleTrendsApiService.getHistoricalTrends(queries[0], {
            startDate: startDate || new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            endDate: endDate || new Date().toISOString().split('T')[0],
            region,
            granularity
          });

          // Store in database
          if (apiData && apiData.length > 0) {
            const trendsToStore = apiData.map(point => ({
              search_query: queries[0],
              date: point.date,
              interest_score: point.interestScore,
              region: region || ''
            }));

            await supabaseDataService.storeGoogleTrendsDataBatch(trendsToStore);
            dbData = await supabaseDataService.getGoogleTrendsData({
              queries: [queries[0]],
              startDate,
              endDate,
              region
            });
          }
        }

        // Group data by query
        const seriesMap = new Map();
        
        dbData.forEach(point => {
          if (!seriesMap.has(point.search_query)) {
            seriesMap.set(point.search_query, []);
          }
          seriesMap.get(point.search_query).push({
            id: point.id,
            searchQuery: point.search_query,
            date: point.date,
            interestScore: point.interest_score,
            region: point.region || '',
            category: point.category,
            createdAt: point.created_at,
            updatedAt: point.updated_at
          });
        });

        // Build series with statistics
        const series = queries.map(query => {
          const dataPoints = seriesMap.get(query) || [];
          const scores = dataPoints.map(p => p.interestScore).filter(s => s !== null && s !== undefined);
          
          return {
            query,
            dataPoints: dataPoints.sort((a, b) => a.date.localeCompare(b.date)),
            minScore: scores.length > 0 ? Math.min(...scores) : 0,
            maxScore: scores.length > 0 ? Math.max(...scores) : 0,
            avgScore: scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0
          };
        });

        // Get date range
        const allDates = dbData.map(item => item.date).sort();
        const dateRange = {
          from: allDates[0] || (startDate || new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
          to: allDates[allDates.length - 1] || (endDate || new Date().toISOString().split('T')[0])
        };

        return {
          queries,
          series,
          dateRange,
          region: region || '',
          totalDataPoints: dbData.length
        };
      } catch (error) {
        console.error('Error fetching Google Trends:', error);
        throw error;
      }
    },

    googleTrendsQueries: async () => {
      try {
        const queries = await supabaseDataService.getGoogleTrendsQueries();
        return queries;
      } catch (error) {
        console.error('Error fetching Google Trends queries:', error);
        throw error;
      }
    },

    googleTrendsCategories: async () => {
      try {
        return getCategories();
      } catch (error) {
        console.error('Error fetching Google Trends categories:', error);
        throw error;
      }
    },

    googleTrendsQueriesByCategory: async (parent: any, args: any) => {
      const { category } = args;
      try {
        if (!category) {
          throw new Error('Category is required');
        }
        return getQueriesByCategory(category);
      } catch (error) {
        console.error('Error fetching queries by category:', error);
        throw error;
      }
    },

    // Demand Heatmap
    demandHeatmapData: async (parent: any, args: any) => {
      const { filters = {}, includeMockData = true } = args;
      try {
        const rawData = await supabaseDataService.getDemandHeatmapData(filters, includeMockData);
        
        if (!rawData || rawData.length === 0) {
          return {
            data: [],
            months: [],
            containsMockData: false
          };
        }

        // Check if any data is mock
        const containsMockData = rawData.some(row => row.is_mock_data === true);

        // Group by region and itinerary, aggregate by month
        const groupedMap = new Map();
        const allMonths = new Set();

        rawData.forEach(row => {
          const key = `${row.region}|||${row.itinerary}`;
          if (!groupedMap.has(key)) {
            groupedMap.set(key, {
              region: row.region,
              itinerary: row.itinerary,
              geog_area_code: row.geog_area_code,
              months: new Map()
            });
          }
          
          const group = groupedMap.get(key);
          const month = row.departure_month;
          allMonths.add(month);
          
          // Sum guest counts for the same month
          const currentCount = group.months.get(month) || 0;
          group.months.set(month, currentCount + (parseFloat(row.guest_count) || 0));
        });

        // Convert to array format with months as object structure
        const data = Array.from(groupedMap.values()).map(group => {
          const row = {
            region: group.region,
            itinerary: group.itinerary,
            geog_area_code: group.geog_area_code,
            months: []
          };
          
          // Add all months with their values
          Array.from(allMonths).sort().forEach(month => {
            const guestCount = group.months.get(month) || 0;
            row.months.push({
              month,
              guest_count: parseFloat(guestCount)
            });
            // Also add as direct property for backward compatibility
            (row as any)[month] = guestCount;
          });
          
          return row;
        });

        // Sort months
        const sortedMonths = Array.from(allMonths).sort();

        return {
          data,
          months: sortedMonths,
          containsMockData
        };
      } catch (error) {
        console.error('Error fetching demand heatmap data:', error);
        throw error;
      }
    },

    // Booking Profile
    bookingProfile: async (parent: any, args: any) => {
      const { sailCode } = args;
      try {
        const profile = await supabaseDataService.getBookingProfile(sailCode);
        console.log(`[resolver] bookingProfile for ${sailCode}: ${profile?.bookingDataPoints?.length || 0} data points`);
        return profile;
      } catch (error) {
        console.error('Error fetching booking profile:', error);
        throw error;
      }
    },

    syncStatus: async (parent: any, args: any) => {
      const { tableName } = args;
      const status = synapseSyncService.getSyncStatus(tableName);
      
      if (!status) {
        return null; // No active sync
      }
      
      return {
        tableName: status.tableName,
        status: status.status,
        startTime: status.startTime,
        duration: status.duration,
        logs: status.logs,
        structuredLogs: status.structuredLogs.map(log => ({
          level: log.level,
          message: log.message,
          timestamp: log.timestamp.toISOString()
        }))
      };
    },

    synapseConnectionStatus: async () => {
      try {
        const result = await synapseSyncService.testConnectionDetailed();
        return {
          online: result.online,
          server: synapseSyncService.synapseConfig.server,
          database: synapseSyncService.synapseConfig.database,
          lastChecked: new Date().toISOString(),
          error: result.error || null
        };
      } catch (error: any) {
        return {
          online: false,
          server: synapseSyncService.synapseConfig.server,
          database: synapseSyncService.synapseConfig.database,
          lastChecked: new Date().toISOString(),
          error: error.message || 'Unknown error'
        };
      }
    },

    bookingProfileYearOverYear: async (parent: any, args: any) => {
      const { sailCode, previousYearSailCode } = args;
      try {
        const currentYear = await supabaseDataService.getBookingProfile(sailCode);
        let previousYear = null;
        let comparison = null;

        if (previousYearSailCode) {
          try {
            previousYear = await supabaseDataService.getBookingProfile(previousYearSailCode);
            
            // Calculate comparison metrics
            comparison = {
              bookingsDifference: currentYear.currentBookings - previousYear.currentBookings,
              bookingsPercentageChange: previousYear.currentBookings > 0 
                ? ((currentYear.currentBookings - previousYear.currentBookings) / previousYear.currentBookings) * 100 
                : 0,
              guestsDifference: currentYear.currentGuests - previousYear.currentGuests,
              guestsPercentageChange: previousYear.currentGuests > 0
                ? ((currentYear.currentGuests - previousYear.currentGuests) / previousYear.currentGuests) * 100
                : 0,
              velocityDifference: currentYear.bookingVelocity - previousYear.bookingVelocity,
              velocityPercentageChange: previousYear.bookingVelocity > 0
                ? ((currentYear.bookingVelocity - previousYear.bookingVelocity) / previousYear.bookingVelocity) * 100
                : 0
            };
          } catch (error) {
            console.warn('Could not fetch previous year data:', error);
            // Continue without previous year data
          }
        }

        return {
          currentYear,
          previousYear,
          comparison
        };
      } catch (error) {
        console.error('Error fetching year-over-year comparison:', error);
        throw error;
      }
    },

    bookingProfileWithCurves: async (parent: any, args: any) => {
      const { sailCode } = args;
      try {
        const profile = await supabaseDataService.getBookingProfileWithCurves(sailCode);
        console.log(`[resolver] bookingProfileWithCurves for ${sailCode}: ${profile?.buildCurves?.length || 0} curve points`);
        return profile;
      } catch (error) {
        console.error('Error fetching booking profile with curves:', error);
        throw error;
      }
    },

    targetProfiles: async (parent: any, args: any) => {
      const { filters = {} } = args;
      try {
        const profiles = await supabaseDataService.getTargetProfiles(filters);
        return profiles;
      } catch (error) {
        console.error('Error fetching target profiles:', error);
        throw error;
      }
    },

    targetProfile: async (parent: any, args: any) => {
      const { id } = args;
      try {
        const profile = await supabaseDataService.getTargetProfile(id);
        return profile;
      } catch (error) {
        console.error('Error fetching target profile:', error);
        throw error;
      }
    },

    competitorPricing: async (parent: any, args: any) => {
      const { filters = {} } = args;
      try {
        const pricing = await supabaseDataService.getCompetitorPricing(filters);
        console.log(`[resolver] competitorPricing: ${pricing?.length || 0} records`);
        return pricing;
      } catch (error) {
        console.error('Error fetching competitor pricing:', error);
        throw error;
      }
    },

    // Legacy queries (for backward compatibility)
    books: () => {
      return [
        { title: 'The Awakening', author: 'Kate Chopin' },
        { title: 'City of Glass', author: 'Paul Auster' },
        { title: 'The Art of War', author: 'Sun Tzu' },
      ];
    }
  },

  Mutation: {
    // Focus Management
    createFocus: async (parent: any, args: any, context: any) => {
      const { input } = args;
      try {
        // In a real app, get current user from context
        // For now, use null if user ID is not a valid UUID
        const userId = context?.user?.id || null;
        
        // Map GraphQL input to database format
        const dbFocusData = mapGraphQLFocusToDb(input, userId);
        
        // Create focus in Supabase
        const dbFocus = await supabaseDataService.createFocus(dbFocusData);
        
        if (!dbFocus) {
          throw new Error('Failed to create focus - no data returned from database');
        }
        
        // Map back to GraphQL format
        const graphQLFocus = mapDbFocusToGraphQL(dbFocus);
        
        if (!graphQLFocus) {
          throw new Error('Failed to map created focus to GraphQL format');
        }
        
        console.log('[createFocus] Successfully created focus:', {
          id: graphQLFocus.id,
          name: graphQLFocus.name,
          type: graphQLFocus.type,
          role: graphQLFocus.role
        });
        
        return graphQLFocus;
      } catch (error: any) {
        console.error('Error creating focus:', error);
        throw new Error(`Failed to create focus: ${error.message}`);
      }
    },

    updateFocus: async (parent: any, args: any) => {
      const { id, input } = args;
      try {
        // Get current focus to preserve existing layoutData.dockviewLayout if not being updated
        const currentFocus = await supabaseDataService.getFocusById(id);
        
        // Map GraphQL input to database format
        const updateData: any = {};
        
        if (input.name !== undefined) updateData.name = input.name;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.type !== undefined) updateData.type = input.type.toLowerCase();
        if (input.isPublic !== undefined) updateData.isStandard = input.isPublic;
        if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;
        if (input.isActive !== undefined) updateData.isActive = input.isActive;
        if (input.assignedRoles !== undefined) {
          updateData.assignedRoles = input.assignedRoles.map((r: string) => r.toUpperCase());
        } else if (input.role !== undefined) {
          updateData.assignedRoles = [input.role.toUpperCase()];
        }
        if (input.components !== undefined) {
          // Preserve existing layoutData completely
          const existingLayoutData = currentFocus?.layout_data || {};
          
          // Extract dockviewLayout from first component's settings if present (new save)
          let dockviewLayout = null;
          let hasNewDockviewLayout = false;
          
          if (input.components.length > 0 && input.components[0]?.settings?._dockviewLayout) {
            dockviewLayout = input.components[0].settings._dockviewLayout;
            hasNewDockviewLayout = true;
            // Remove it from settings
            delete input.components[0].settings._dockviewLayout;
            // If this was a dummy component created just to store layout, remove it
            // Check by checking if it's the first component with only _dockviewLayout in settings
            const firstCompSettings = input.components[0].settings || {};
            const settingsKeys = Object.keys(firstCompSettings);
            if (settingsKeys.length === 1 && settingsKeys[0] === '_dockviewLayout') {
              input.components = input.components.slice(1); // Remove the dummy component
            } else if (Object.keys(firstCompSettings).length === 0) {
              input.components[0].settings = null;
            }
          } else {
            // If no new dockviewLayout provided, preserve existing one
            dockviewLayout = existingLayoutData.dockviewLayout || null;
          }
          
          // CRITICAL: Preserve ALL existing layoutData properties (grid, etc.)
          // Update components and dockviewLayout
          updateData.layoutData = {
            ...existingLayoutData, // Preserve grid and any other properties
            components: input.components, // Update components
            dockviewLayout: dockviewLayout // Always set dockviewLayout (even if null)
          };
          
          console.log('[updateFocus] Saving layoutData:', {
            componentsCount: input.components.length,
            hasDockviewLayout: !!dockviewLayout,
            hasNewDockviewLayout: hasNewDockviewLayout,
            existingHasDockviewLayout: !!existingLayoutData.dockviewLayout,
            preservedKeys: Object.keys(existingLayoutData),
            dockviewLayoutKeys: dockviewLayout ? Object.keys(dockviewLayout) : [],
            dockviewLayoutPanels: dockviewLayout?.panels ? Object.keys(dockviewLayout.panels).length : 0
          });
        }
        
        // Update focus in Supabase
        const dbFocus = await supabaseDataService.updateFocus(id, updateData);
        
        if (!dbFocus) {
          throw new Error(`Focus with ID ${id} was not found or could not be updated`);
        }
        
        // Map back to GraphQL format
        const graphQLFocus = mapDbFocusToGraphQL(dbFocus);
        
        if (!graphQLFocus) {
          throw new Error(`Failed to map updated focus to GraphQL format`);
        }
        
        console.log('[updateFocus] Successfully updated focus:', {
          id: graphQLFocus.id,
          name: graphQLFocus.name,
          hasLayoutData: !!graphQLFocus.layoutData,
          hasDockviewLayout: !!graphQLFocus.layoutData?.dockviewLayout
        });
        
        return graphQLFocus;
      } catch (error) {
        console.error('Error updating focus:', error);
        throw new Error(`Failed to update focus: ${error.message}`);
      }
    },

    deleteFocus: async (parent: any, args: any) => {
      const { id } = args;
      try {
        await supabaseDataService.deleteFocus(id);
        return true;
      } catch (error) {
        console.error('Error deleting focus:', error);
        throw new Error(`Failed to delete focus: ${error.message}`);
      }
    },

    shareFocus: async (parent: any, args: any) => {
      const { id, isPublic } = args;
      try {
        // Update is_standard field to reflect public/private status
        const dbFocus = await supabaseDataService.updateFocus(id, { isStandard: isPublic });
        return mapDbFocusToGraphQL(dbFocus);
      } catch (error) {
        console.error('Error sharing focus:', error);
        throw new Error(`Failed to share focus: ${error.message}`);
      }
    },

    // User Management
    updateUserPreferences: (parent: any, args: any) => {
      const { input } = args;
      const userIndex = 0; // In real app, get current user index
      
      sampleData.users[userIndex].preferences = {
        ...sampleData.users[userIndex].preferences,
        ...input
      };
      sampleData.users[userIndex].updatedAt = new Date().toISOString();
      
      return sampleData.users[userIndex];
    },

    // Focus Preferences
    updateFocusPreference: async (parent: any, args: any, context: any) => {
      try {
        const { focusId, preferences } = args;
        const userId = context.user?.id;
        if (!userId) throw new Error('Authentication required to update focus preferences.');
        
        const updated = await supabaseDataService.updateUserFocusPreference(
          userId,
          focusId,
          {
            isFavorite: preferences.isFavorite,
            lastUsed: preferences.lastUsed,
            customLayout: preferences.customLayout
          }
        );
        
        return {
          id: updated.id,
          userId: updated.user_id,
          focusId: updated.focus_id,
          isFavorite: updated.is_favorite,
          lastUsed: updated.last_used,
          customLayout: updated.custom_layout,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at
        };
      } catch (error) {
        console.error('Error updating focus preference:', error);
        throw new Error(`Failed to update focus preference: ${error.message}`);
      }
    },

    toggleFavorite: async (parent: any, args: any, context: any) => {
      try {
        const { focusId } = args;
        const userId = context.user?.id;
        if (!userId) throw new Error('Authentication required to toggle favorite.');
        
        const updated = await supabaseDataService.toggleFavorite(userId, focusId);
        
        return {
          id: updated.id,
          userId: updated.user_id,
          focusId: updated.focus_id,
          isFavorite: updated.is_favorite,
          lastUsed: updated.last_used,
          customLayout: updated.custom_layout,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at
        };
      } catch (error) {
        console.error('Error toggling favorite:', error);
        throw new Error(`Failed to toggle favorite: ${error.message}`);
      }
    },

    // Focus Groups (Admin)
    createFocusGroup: async (parent: any, args: any, context: any) => {
      try {
        const { groupData } = args;
        const userId = context.user?.id;
        if (!userId) throw new Error('Authentication required to create focus group.');
        
        // TODO: Check if user is admin
        const group = await supabaseDataService.createFocusGroup({
          name: groupData.name,
          description: groupData.description,
          isActive: groupData.isActive !== undefined ? groupData.isActive : true,
          createdBy: userId
        });
        
        return {
          id: group.id,
          name: group.name,
          description: group.description,
          isActive: group.is_active,
          createdBy: group.created_by,
          createdAt: group.created_at,
          updatedAt: group.updated_at
        };
      } catch (error) {
        console.error('Error creating focus group:', error);
        throw new Error(`Failed to create focus group: ${error.message}`);
      }
    },

    updateFocusGroup: async (parent: any, args: any, context: any) => {
      try {
        const { groupId, updateData } = args;
        const userId = context.user?.id;
        if (!userId) throw new Error('Authentication required to update focus group.');
        
        // TODO: Check if user is admin
        const group = await supabaseDataService.updateFocusGroup(groupId, {
          name: updateData.name,
          description: updateData.description,
          isActive: updateData.isActive
        });
        
        return {
          id: group.id,
          name: group.name,
          description: group.description,
          isActive: group.is_active,
          createdBy: group.created_by,
          createdAt: group.created_at,
          updatedAt: group.updated_at
        };
      } catch (error) {
        console.error('Error updating focus group:', error);
        throw new Error(`Failed to update focus group: ${error.message}`);
      }
    },

    deleteFocusGroup: async (parent: any, args: any, context: any) => {
      try {
        const { groupId } = args;
        const userId = context.user?.id;
        if (!userId) throw new Error('Authentication required to delete focus group.');
        
        // TODO: Check if user is admin
        await supabaseDataService.deleteFocusGroup(groupId);
        return true;
      } catch (error) {
        console.error('Error deleting focus group:', error);
        throw new Error(`Failed to delete focus group: ${error.message}`);
      }
    },

    syncTable: async (parent: any, args: any) => {
      const { tableName, dataset, forceFullSync } = args;
      
      try {
        // Validate required parameter
        if (!tableName || typeof tableName !== 'string') {
          return {
            success: false,
            tableName: tableName || 'unknown',
            message: 'Invalid table name provided',
            recordsProcessed: null,
            duration: null,
            error: 'tableName parameter is required and must be a string',
            detailedLogs: []
          };
        }
        
        // Map Supabase table names to sync config table names
        const tableNameMap: Record<string, string> = {
          'ship': 'ships',
          'cabin_availability': 'cabinAvailability',
          'reservation': 'reservations',
          'reservation_promotion': 'reservationPromotion',
          'master_sail': 'masterSail',
          'sail_by_cabin_occupancy': 'sailByCabinOccupancy',
          'reservation_changes': 'reservationChanges',
          'reservation_current_state': 'reservationChanges', // Uses same sync
          'published_rates': 'publishedRates',
          'published_rates_changes': 'publishedRates', // Uses same sync
          'published_rates_current_state': 'publishedRates', // Uses same sync
          'competitor': 'competitor',
          'competitor_current_state': 'competitor' // Uses same sync
        };

        // Check if table has a sync configuration BEFORE using it
        if (!tableNameMap[tableName]) {
          return {
            success: false,
            tableName,
            message: `Table "${tableName}" does not have a sync configuration`,
            recordsProcessed: null,
            duration: null,
            error: `No sync configuration found for table: ${tableName}. Available tables: ${Object.keys(tableNameMap).join(', ')}`,
            detailedLogs: []
          };
        }

        const syncTableName = tableNameMap[tableName];
        
        // Check for concurrent sync
        const existingSync = synapseSyncService.getSyncStatus(syncTableName);
        if (existingSync && existingSync.status === 'running') {
          return {
            success: false,
            tableName,
            message: `Sync already in progress for "${tableName}"`,
            recordsProcessed: null,
            duration: null,
            error: `A sync is already running for ${tableName}. Please wait for it to complete.`,
            detailedLogs: []
          };
        }

        // Handle dataset parameter - use undefined instead of null
        const datasetName = dataset && dataset !== 'null' ? dataset : undefined;
        
        // CRITICAL: Pass original tableName for event emission (UI listens to this)
        // syncTableName is used for sync config lookup, but tableName is used for logger/events
        const result = await synapseSyncService.syncTable(syncTableName, datasetName, { 
          forceFullSync: forceFullSync || false,
          uiTableName: tableName // Pass original tableName for event emission
        });

        return {
          success: result.success,
          tableName,
          message: result.message || 'Sync completed',
          recordsProcessed: result.recordsProcessed || null,
          duration: result.duration || null,
          error: result.error || null,
          detailedLogs: result.detailedLogs || []
        };
      } catch (error: any) {
        console.error('Error syncing table:', error);
        return {
          success: false,
          tableName,
          message: `Sync failed: ${error.message}`,
          recordsProcessed: null,
          duration: null,
          error: error.message
        };
      }
    },

    createTargetProfile: async (parent: any, args: any, context: any) => {
      const { input } = args;
      try {
        // Get user ID from context (if available)
        const userId = context?.user?.id || null;
        const profile = await supabaseDataService.createTargetProfile(input, userId);
        return profile;
      } catch (error) {
        console.error('Error creating target profile:', error);
        throw error;
      }
    },

    updateTargetProfile: async (parent: any, args: any) => {
      const { id, input } = args;
      try {
        const profile = await supabaseDataService.updateTargetProfile(id, input);
        return profile;
      } catch (error) {
        console.error('Error updating target profile:', error);
        throw error;
      }
    },

    deleteTargetProfile: async (parent: any, args: any) => {
      const { id } = args;
      try {
        const success = await supabaseDataService.deleteTargetProfile(id);
        return success;
      } catch (error) {
        console.error('Error deleting target profile:', error);
        throw error;
      }
    },

    trackGoogleSearch: async (parent: any, args: any) => {
      const { query, trackTrend = true } = args;
      try {
        if (!query || query.trim() === '') {
          throw new Error('Search query is required');
        }

        // Perform the search
        const searchOptions = {
          query: query.trim(),
          num: 10,
          start: 1
        };

        const results = await googleSearchService.searchPublic(searchOptions);

        // Store trend data if tracking is enabled
        if (trackTrend) {
          try {
            const trendData = await supabaseDataService.storeSearchTrend({
              query: query.trim(),
              total_results: results.totalResults,
              search_time: results.searchTime,
              search_date: new Date().toISOString().split('T')[0],
              search_timestamp: new Date().toISOString()
            });

            return {
              success: true,
              trendId: trendData.id,
              message: `Search tracked successfully. Found ${results.totalResults.toLocaleString()} results.`
            };
          } catch (error) {
            console.error('Error storing search trend:', error);
            return {
              success: false,
              trendId: null,
              message: `Search completed but failed to track: ${error.message}`
            };
          }
        }

        return {
          success: true,
          trendId: null,
          message: `Search completed. Found ${results.totalResults.toLocaleString()} results.`
        };
      } catch (error) {
        console.error('Error tracking Google search:', error);
        throw error;
      }
    },

    backfillHistoricalTrends: async (parent: any, args: any) => {
      const { query, monthsBack = 6 } = args;
      try {
        if (!query || query.trim() === '') {
          throw new Error('Search query is required');
        }

        const result = await googleTrendsService.backfillHistoricalTrends(
          query.trim(),
          { monthsBack },
          supabaseDataService
        );

        return result;
      } catch (error) {
        console.error('Error backfilling historical trends:', error);
        throw error;
      }
    },

    // Google Trends Mutations
    fetchGoogleTrends: async (parent: any, args: any) => {
      const { queries, startDate, endDate, region = '', storeResults = true } = args;
      try {
        if (!queries || queries.length === 0) {
          throw new Error('At least one query is required');
        }

        const results = [];
        
        for (const query of queries) {
          const trends = await googleTrendsApiService.getHistoricalTrends(query, {
            startDate: startDate || new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            endDate: endDate || new Date().toISOString().split('T')[0],
            region
          });

          // Store in database if requested
          if (storeResults && trends && trends.length > 0) {
            const trendsToStore = trends.map(point => ({
              search_query: query,
              date: point.date,
              interest_score: point.interestScore,
              region: region || ''
            }));

            await supabaseDataService.storeGoogleTrendsDataBatch(trendsToStore);
          }

          results.push(...trends.map(point => ({
            searchQuery: query,
            date: point.date,
            interestScore: point.interestScore,
            region: region || ''
          })));
        }

        // Group by query for series
        const seriesMap = new Map();
        results.forEach(point => {
          if (!seriesMap.has(point.searchQuery)) {
            seriesMap.set(point.searchQuery, []);
          }
          seriesMap.get(point.searchQuery).push(point);
        });

        const series = queries.map(query => {
          const dataPoints = seriesMap.get(query) || [];
          const scores = dataPoints.map(p => p.interestScore).filter(s => s !== null && s !== undefined);
          
          return {
            query,
            dataPoints: dataPoints.sort((a, b) => a.date.localeCompare(b.date)).map(p => ({
              id: null,
              searchQuery: p.searchQuery,
              date: p.date,
              interestScore: p.interestScore,
              region: p.region,
              category: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })),
            minScore: scores.length > 0 ? Math.min(...scores) : 0,
            maxScore: scores.length > 0 ? Math.max(...scores) : 0,
            avgScore: scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0
          };
        });

        const allDates = results.map(r => r.date).sort();
        const dateRange = {
          from: allDates[0] || (startDate || new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
          to: allDates[allDates.length - 1] || (endDate || new Date().toISOString().split('T')[0])
        };

        return {
          queries,
          series,
          dateRange,
          region: region || '',
          totalDataPoints: results.length
        };
      } catch (error) {
        console.error('Error fetching Google Trends:', error);
        throw error;
      }
    },

    backfillGoogleTrends: async (parent: any, args: any) => {
      const { queries, startDate, endDate, region = '' } = args;
      try {
        if (!queries || queries.length === 0) {
          throw new Error('At least one query is required');
        }

        let totalStored = 0;
        
        for (const query of queries) {
          const trends = await googleTrendsApiService.getHistoricalTrends(query, {
            startDate: startDate || new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            endDate: endDate || new Date().toISOString().split('T')[0],
            region
          });

          if (trends && trends.length > 0) {
            const trendsToStore = trends.map(point => ({
              search_query: query,
              date: point.date,
              interest_score: point.interestScore,
              region: region || ''
            }));

            await supabaseDataService.storeGoogleTrendsDataBatch(trendsToStore);
            totalStored += trends.length;
          }

          // Rate limiting - wait between queries
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return {
          query: queries.join(', '),
          dataPointsStored: totalStored,
          dateRange: {
            from: startDate || new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            to: endDate || new Date().toISOString().split('T')[0]
          }
        };
      } catch (error) {
        console.error('Error backfilling Google Trends:', error);
        throw error;
      }
    },

    fetchTrendsForCategory: async (parent: any, args: any) => {
      const { category, startDate, endDate, region = '' } = args;
      try {
        if (!category) {
          throw new Error('Category is required');
        }

        const queries = getQueriesByCategory(category);
        if (!queries || queries.length === 0) {
          throw new Error(`No queries found for category: ${category}`);
        }

        let totalStored = 0;
        
        for (const query of queries) {
          try {
            const trends = await googleTrendsApiService.getHistoricalTrends(query, {
              startDate: startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              endDate: endDate || new Date().toISOString().split('T')[0],
              region
            });

            if (trends && trends.length > 0) {
              const trendsToStore = trends.map(point => ({
                search_query: query,
                date: point.date,
                interest_score: point.interestScore,
                region: region || ''
              }));

              await supabaseDataService.storeGoogleTrendsDataBatch(trendsToStore);
              totalStored += trends.length;
            }

            // Rate limiting - wait between queries
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error) {
            console.error(`Error fetching trends for "${query}":`, error.message);
            // Continue with next query
          }
        }

        return {
          query: `${category} (${queries.length} queries)`,
          dataPointsStored: totalStored,
          dateRange: {
            from: startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            to: endDate || new Date().toISOString().split('T')[0]
          }
        };
      } catch (error) {
        console.error('Error fetching trends for category:', error);
        throw error;
      }
    },

    fetchTrendsForAllQueries: async (parent: any, args: any) => {
      const { startDate, endDate, region = '' } = args;
      try {
        const queries = ALL_QUERIES;
        
        console.log(`[GoogleTrends] Fetching trends for all ${queries.length} queries...`);

        let totalStored = 0;
        let successCount = 0;
        let errorCount = 0;
        
        for (const query of queries) {
          try {
            // Check if data already exists
            const existing = await supabaseDataService.getGoogleTrendsData({
              queries: [query],
              startDate: startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              endDate: endDate || new Date().toISOString().split('T')[0],
              region
            });

            if (existing && existing.length > 0) {
              console.log(`[GoogleTrends] Skipping "${query}" - already has ${existing.length} data points`);
              continue;
            }

            const trends = await googleTrendsApiService.getHistoricalTrends(query, {
              startDate: startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              endDate: endDate || new Date().toISOString().split('T')[0],
              region
            });

            if (trends && trends.length > 0) {
              const trendsToStore = trends.map(point => ({
                search_query: query,
                date: point.date,
                interest_score: point.interestScore,
                region: region || ''
              }));

              await supabaseDataService.storeGoogleTrendsDataBatch(trendsToStore);
              totalStored += trends.length;
              successCount++;
            }

            // Rate limiting - wait between queries
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error) {
            console.error(`[GoogleTrends] Error fetching trends for "${query}":`, error.message);
            errorCount++;
            // Continue with next query
          }
        }

        return {
          query: `All queries (${queries.length} total)`,
          dataPointsStored: totalStored,
          dateRange: {
            from: startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            to: endDate || new Date().toISOString().split('T')[0]
          }
        };
      } catch (error) {
        console.error('Error fetching trends for all queries:', error);
        throw error;
      }
    },

    restartServer: async () => {
      try {
        console.log('🔄 Restart request received from UI...');
        console.log('⏳ Server will restart in 2 seconds...');
        
        // Give time for the response to be sent, then execute restart script
        setTimeout(async () => {
          try {
            console.log('🔄 Executing restart script...');
            
            // Import child_process dynamically (ES modules)
            const { spawn } = await import('child_process');
            const { fileURLToPath } = await import('url');
            const { dirname } = await import('path');
            const { resolve } = await import('path');
            
            const serverDir = process.cwd();
            const restartScriptPath = resolve(serverDir, 'restart-server-now.sh');
            
            // Execute the restart script
            const restartProcess = spawn('sh', [restartScriptPath], {
              detached: true,
              stdio: 'ignore',
              cwd: serverDir
            });
            
            // Unref the restart process so it can run independently
            restartProcess.unref();
            
            // Exit this process immediately - the script will handle killing and restarting
            console.log('✅ Restart script executed, exiting current process...');
            process.exit(0);
          } catch (spawnError: any) {
            console.error('❌ Error executing restart script:', spawnError);
            console.log('⚠️  Falling back to simple exit - please restart server manually');
            process.exit(0);
          }
        }, 2000);
        
        return true;
      } catch (error: any) {
        console.error('Error restarting server:', error);
        throw new Error(`Failed to restart server: ${error.message}`);
      }
    }
  },

  // Custom scalar for JSON
  JSON: {
    serialize: (value: any) => value,
    parseValue: (value: any) => value,
    parseLiteral: (ast: any) => {
      switch (ast.kind) {
        case 'StringValue':
        case 'BooleanValue':
          return ast.value;
        case 'IntValue':
        case 'FloatValue':
          return parseFloat(ast.value);
        case 'ObjectValue':
          return ast.fields.reduce((obj: any, field: any) => {
            obj[field.name.value] = field.value.value;
            return obj;
          }, {});
        case 'ListValue':
          return ast.values.map((value: any) => value.value);
        default:
          return null;
      }
    }
  }
};
