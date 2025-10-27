import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_CONFIG = {
  url: 'http://127.0.0.1:54323',
  anonKey: process.env.SUPABASE_ANON_KEY || 'your-anon-key-here',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key-here'
};

// Create Supabase client for server-side operations
export const supabase = createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Simple database query utilities
export class SupabaseDataService {
  constructor() {
    this.client = supabase;
  }

  // Get ships data
  async getShips() {
    try {
      const { data, error } = await this.client
        .from('ships')
        .select('*')
        .order('Ship_Name', { ascending: true });
      
      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching ships:', error);
      throw error;
    }
  }

  // Get sailings data
  async getSailings(filters = {}) {
    try {
      let query = this.client.from('sailings').select('*');
      
      if (filters.shipId) {
        query = query.eq('Ship_Id', filters.shipId);
      }
      if (filters.dateFrom) {
        query = query.gte('Depart_Date', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('Depart_Date', filters.dateTo);
      }
      
      const { data, error } = await query.order('Depart_Date', { ascending: true });
      
      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching sailings:', error);
      throw error;
    }
  }

  // Get cabin availability data
  async getCabinAvailability(filters = {}) {
    try {
      let query = this.client.from('cabin_availability').select('*');
      
      if (filters.sailingId) {
        query = query.eq('Sailing_Id', filters.sailingId);
      }
      if (filters.dateFrom) {
        query = query.gte('Snapshot_Date', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('Snapshot_Date', filters.dateTo);
      }
      
      const { data, error } = await query.order('Snapshot_Date', { ascending: false });
      
      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching cabin availability:', error);
      throw error;
    }
  }

  // Get KPIs data
  async getKPIs(userRole = 'GUEST') {
    try {
      const { data, error } = await this.client
        .from('kpis')
        .select('*')
        .or(`User_Role.eq.${userRole},User_Role.eq.ALL`)
        .order('Created_Date', { ascending: false });
      
      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching KPIs:', error);
      throw error;
    }
  }

  // Get exceptions data
  async getExceptions(userRole = 'GUEST') {
    try {
      const { data, error } = await this.client
        .from('exceptions')
        .select('*')
        .or(`User_Role.eq.${userRole},User_Role.eq.ALL`)
        .order('Created_Date', { ascending: false });
      
      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching exceptions:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const supabaseDataService = new SupabaseDataService();

