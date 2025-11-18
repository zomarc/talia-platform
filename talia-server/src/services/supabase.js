import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_CONFIG = {
  url: 'http://127.0.0.1:54321',
  anonKey: process.env.SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'
};

// Create Supabase client for server-side operations
export const supabase = createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.serviceRoleKey, // Use service role for server-side operations
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Create Supabase client for client-side operations (if needed)
export const supabaseClient = createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey
);

// Database query utilities
export class SupabaseDataService {
  constructor() {
    this.client = supabase;
  }

  // Generic query method
  async query(table, options = {}) {
    try {
      let queryBuilder = this.client.from(table).select('*');
      
      // Apply filters
      if (options.filters) {
        Object.entries(options.filters).forEach(([column, value]) => {
          queryBuilder = queryBuilder.eq(column, value);
        });
      }
      
      // Apply date range filters
      if (options.dateRange) {
        if (options.dateRange.from) {
          queryBuilder = queryBuilder.gte('created_at', options.dateRange.from);
        }
        if (options.dateRange.to) {
          queryBuilder = queryBuilder.lte('created_at', options.dateRange.to);
        }
      }
      
      // Apply ordering
      if (options.orderBy) {
        queryBuilder = queryBuilder.order(options.orderBy.column, { 
          ascending: options.orderBy.ascending !== false 
        });
      }
      
      // Apply pagination
      if (options.limit) {
        queryBuilder = queryBuilder.limit(options.limit);
      }
      if (options.offset) {
        queryBuilder = queryBuilder.range(options.offset, options.offset + (options.limit || 10) - 1);
      }
      
      const { data, error } = await queryBuilder;
      
      if (error) {
        console.error(`Supabase query error for table ${table}:`, error);
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error(`Error querying ${table}:`, error);
      throw error;
    }
  }

  // Get ships data
  async getShips() {
    return await this.query('ship');
  }

  // Get sailings data
  async getSailings(filters = {}) {
    return await this.query('sailings', {
      filters,
      orderBy: { column: 'depart_date', ascending: true }
    });
  }

  // Get master sail data
  async getMasterSail(filters = {}) {
    try {
      let queryBuilder = this.client.from('master_sail').select('*');
      
      // Apply filters
      if (filters.sail_code) {
        queryBuilder = queryBuilder.eq('sail_code', filters.sail_code);
      }
      if (filters.ship_name) {
        queryBuilder = queryBuilder.ilike('ship_name', `%${filters.ship_name}%`);
      }
      if (filters.ship_code) {
        queryBuilder = queryBuilder.eq('ship_code', filters.ship_code);
      }
      if (filters.package_name) {
        queryBuilder = queryBuilder.ilike('package_name', `%${filters.package_name}%`);
      }
      if (filters.package_type) {
        queryBuilder = queryBuilder.eq('package_type', filters.package_type);
      }
      if (filters.geog_area_code) {
        queryBuilder = queryBuilder.eq('geog_area_code', filters.geog_area_code);
      }
      if (filters.is_active) {
        queryBuilder = queryBuilder.eq('is_active', filters.is_active);
      }
      if (filters.sail_date_from) {
        queryBuilder = queryBuilder.gte('sail_date_from', filters.sail_date_from);
      }
      if (filters.sail_date_to) {
        queryBuilder = queryBuilder.lte('sail_date_to', filters.sail_date_to);
      }
      
      // Apply ordering
      queryBuilder = queryBuilder.order('sail_date_from', { ascending: false });
      
      // Apply limit
      const limit = filters.limit || 100;
      queryBuilder = queryBuilder.limit(limit);
      
      const { data, error } = await queryBuilder;
      
      if (error) {
        console.error('Supabase query error for master_sail:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error querying master_sail:', error);
      throw error;
    }
  }

  // Get cabin availability data
  async getCabinAvailability(filters = {}) {
    return await this.query('cabin_availability', {
      filters,
      orderBy: { column: 'snapshot_date', ascending: false }
    });
  }

  // Get KPIs data
  async getKPIs(userRole = 'GUEST') {
    return await this.query('kpis', {
      filters: { user_role: userRole },
      orderBy: { column: 'created_at', ascending: false }
    });
  }

  // Get exceptions data
  async getExceptions(userRole = 'GUEST') {
    return await this.query('exceptions', {
      filters: { user_role: userRole },
      orderBy: { column: 'created_at', ascending: false }
    });
  }

  // Get revenue data
  async getRevenue(filters = {}) {
    return await this.query('revenue', {
      filters,
      orderBy: { column: 'date', ascending: false }
    });
  }

  // Get occupancy data
  async getOccupancy(filters = {}) {
    return await this.query('occupancy', {
      filters,
      orderBy: { column: 'date', ascending: false }
    });
  }
}

// Export singleton instance
export const supabaseDataService = new SupabaseDataService();

