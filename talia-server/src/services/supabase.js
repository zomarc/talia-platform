import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_CONFIG = {
  url: process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
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

  // Get reservations data
  async getReservations(filters = {}) {
    try {
      let queryBuilder = this.client.from('reservation').select('*');
      
      // Apply filters
      if (filters.sail_code) {
        queryBuilder = queryBuilder.eq('sail_code', filters.sail_code);
      }
      if (filters.ship) {
        queryBuilder = queryBuilder.ilike('ship', `%${filters.ship}%`);
      }
      if (filters.res_status) {
        queryBuilder = queryBuilder.eq('res_status', filters.res_status);
      }
      if (filters.agency_id) {
        queryBuilder = queryBuilder.eq('agency_id', filters.agency_id);
      }
      if (filters.cabin_category) {
        queryBuilder = queryBuilder.eq('cabin_category', filters.cabin_category);
      }
      if (filters.sail_from_date_from) {
        queryBuilder = queryBuilder.gte('sail_from_date', filters.sail_from_date_from);
      }
      if (filters.sail_from_date_to) {
        queryBuilder = queryBuilder.lte('sail_from_date', filters.sail_from_date_to);
      }
      
      // Apply ordering
      queryBuilder = queryBuilder.order('sail_from_date', { ascending: false });
      
      // Apply limit
      const limit = filters.limit || 1000;
      queryBuilder = queryBuilder.limit(limit);
      
      const { data, error } = await queryBuilder;
      
      if (error) {
        console.error('Supabase query error for reservation:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error querying reservation:', error);
      throw error;
    }
  }

  // Get demand heatmap data
  async getDemandHeatmapData(filters = {}, includeMockData = true) {
    try {
      let queryBuilder = this.client.from('demand_heatmap_data').select('*');
      
      // Filter mock data based on includeMockData flag
      if (!includeMockData) {
        queryBuilder = queryBuilder.eq('is_mock_data', false);
      }
      
      // Apply filters
      if (filters.region) {
        queryBuilder = queryBuilder.eq('region', filters.region);
      }
      if (filters.itinerary) {
        queryBuilder = queryBuilder.ilike('itinerary', `%${filters.itinerary}%`);
      }
      if (filters.geog_area_code) {
        queryBuilder = queryBuilder.eq('geog_area_code', filters.geog_area_code);
      }
      if (filters.departure_month_from) {
        queryBuilder = queryBuilder.gte('departure_month', filters.departure_month_from);
      }
      if (filters.departure_month_to) {
        queryBuilder = queryBuilder.lte('departure_month', filters.departure_month_to);
      }
      
      // Apply ordering
      queryBuilder = queryBuilder.order('region', { ascending: true });
      queryBuilder = queryBuilder.order('itinerary', { ascending: true });
      queryBuilder = queryBuilder.order('departure_month', { ascending: true });
      
      // Apply limit
      const limit = filters.limit || 10000;
      queryBuilder = queryBuilder.limit(limit);
      
      const { data, error } = await queryBuilder;
      
      if (error) {
        console.error('Supabase query error for demand_heatmap_data:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error querying demand_heatmap_data:', error);
      throw error;
    }
  }

  // Get focuses data
  async getFocuses(filters = {}) {
    try {
      console.log('[getFocuses] Starting query with filters:', filters);
      let queryBuilder = this.client.from('focuses').select('*');
      
      // Always filter by is_active = true
      queryBuilder = queryBuilder.eq('is_active', true);
      
      // Apply filters
      if (filters.role) {
        // Filter by role if it's in assigned_roles array
        queryBuilder = queryBuilder.contains('assigned_roles', [filters.role]);
      }
      if (filters.type) {
        queryBuilder = queryBuilder.eq('type', filters.type);
      }
      if (filters.isPublic !== undefined) {
        // Note: Database doesn't have isPublic, but we can use is_standard as proxy
        queryBuilder = queryBuilder.eq('is_standard', filters.isPublic);
      }
      if (filters.createdBy) {
        queryBuilder = queryBuilder.eq('created_by', filters.createdBy);
      }
      
      // Apply ordering
      queryBuilder = queryBuilder.order('created_at', { ascending: false });
      
      const { data, error } = await queryBuilder;
      
      if (error) {
        console.error('[getFocuses] Supabase query error:', error);
        throw error;
      }
      
      console.log(`[getFocuses] Retrieved ${data?.length || 0} focuses from Supabase`);
      if (data && data.length > 0) {
        console.log(`[getFocuses] First focus:`, {
          id: data[0].id,
          name: data[0].name,
          assigned_roles: data[0].assigned_roles,
          is_active: data[0].is_active
        });
      }
      
      return data || [];
    } catch (error) {
      console.error('[getFocuses] Error querying focuses:', error);
      throw error;
    }
  }

  // Get a single focus by ID
  async getFocusById(id) {
    try {
      const { data, error } = await this.client
        .from('focuses')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('Supabase query error for focus:', error);
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('Error querying focus:', error);
      throw error;
    }
  }

  // Create a new focus
  async createFocus(focusData) {
    try {
      const insertData = {
        name: focusData.name,
        description: focusData.description,
        type: focusData.type,
        is_standard: focusData.isStandard || false,
        assigned_roles: focusData.assignedRoles || [],
        assigned_user_id: focusData.assignedUserId || null,
        is_default: focusData.isDefault || false,
        is_active: focusData.isActive !== undefined ? focusData.isActive : true,
        layout_data: focusData.layoutData || null
      };
      
      // Only include created_by if it's a valid UUID
      if (focusData.createdBy) {
        // Validate UUID format (basic check)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(focusData.createdBy)) {
          insertData.created_by = focusData.createdBy;
        }
        // If not a valid UUID, leave created_by as null (database allows null)
      }
      
      const { data, error } = await this.client
        .from('focuses')
        .insert(insertData)
        .select()
        .single();
      
      if (error) {
        console.error('Supabase insert error for focus:', error);
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('Error creating focus:', error);
      throw error;
    }
  }

  // Update a focus
  async updateFocus(id, updateData) {
    try {
      const updatePayload = {};
      
      if (updateData.name !== undefined) updatePayload.name = updateData.name;
      if (updateData.description !== undefined) updatePayload.description = updateData.description;
      if (updateData.type !== undefined) updatePayload.type = updateData.type;
      if (updateData.isStandard !== undefined) updatePayload.is_standard = updateData.isStandard;
      if (updateData.assignedRoles !== undefined) updatePayload.assigned_roles = updateData.assignedRoles;
      if (updateData.assignedUserId !== undefined) updatePayload.assigned_user_id = updateData.assignedUserId;
      if (updateData.isDefault !== undefined) updatePayload.is_default = updateData.isDefault;
      if (updateData.isActive !== undefined) updatePayload.is_active = updateData.isActive;
      if (updateData.layoutData !== undefined) updatePayload.layout_data = updateData.layoutData;
      
      updatePayload.updated_at = new Date().toISOString();
      
      const { data, error } = await this.client
        .from('focuses')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Supabase update error for focus:', error);
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('Error updating focus:', error);
      throw error;
    }
  }

  // Delete a focus
  async deleteFocus(id) {
    try {
      const { error } = await this.client
        .from('focuses')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Supabase delete error for focus:', error);
        throw error;
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting focus:', error);
      throw error;
    }
  }

  // ===== Talia User Management =====

  // Get Talia user by email
  async getTaliaUserByEmail(email) {
    try {
      const { data, error } = await this.client
        .from('talia_users')
        .select('*')
        .eq('email', email)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error('Supabase query error for talia_user:', error);
        throw error;
      }
      
      return data || null;
    } catch (error) {
      console.error('Error querying talia_user:', error);
      throw error;
    }
  }

  // Get all Talia users
  async getAllTaliaUsers() {
    try {
      const { data, error } = await this.client
        .from('talia_users')
        .select('*')
        .order('last_login_at', { ascending: false, nullsFirst: false })
        .order('talia_user_id', { ascending: true });

      if (error) {
        console.error('Supabase query error for talia_users:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error querying talia_users:', error);
      throw error;
    }
  }

  async logUiActivityEvent(input) {
    try {
      const payload = {
        at: input.at || new Date().toISOString(),
        user_id: input.userId || null,
        user_email: input.userEmail || null,
        user_role: input.userRole || null,
        kind: input.kind || null,
        report: input.report || null,
        panel_component: input.panelComponent || null,
        purpose: input.purpose || null,
        status: input.status || null,
        performance_ms: Number.isFinite(input.performanceMs) ? input.performanceMs : null,
        query_count: Number.isFinite(input.queryCount) ? input.queryCount : null,
        source_query_id: input.sourceQueryId || null,
        criteria: input.criteria && typeof input.criteria === 'object' ? input.criteria : {}
      };

      const { error } = await this.client
        .from('ui_activity_events')
        .insert(payload);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error logging UI activity event:', error);
      return false;
    }
  }

  async getUiActivityEvents({ sinceMinutes = null, limit = 2000, userId = null, userEmail = null } = {}) {
    try {
      let query = this.client
        .from('ui_activity_events')
        .select('*')
        .order('at', { ascending: false })
        .limit(Math.max(1, Math.min(limit || 2000, 10000)));

      if (Number.isFinite(sinceMinutes) && sinceMinutes > 0) {
        const cutoff = new Date(Date.now() - (sinceMinutes * 60 * 1000)).toISOString();
        query = query.gte('at', cutoff);
      }
      if (userId) query = query.eq('user_id', userId);
      if (userEmail) query = query.ilike('user_email', userEmail);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching UI activity events:', error);
      return [];
    }
  }

  async purgeUiActivityEvents(olderThanHours = 24) {
    try {
      const safeHours = Math.max(1, Number.parseInt(String(olderThanHours || 24), 10) || 24);
      const cutoff = new Date(Date.now() - (safeHours * 60 * 60 * 1000)).toISOString();

      const { count, error: countError } = await this.client
        .from('ui_activity_events')
        .select('id', { count: 'exact', head: true })
        .lt('at', cutoff);

      if (countError) throw countError;
      const total = Number(count || 0);
      if (total <= 0) return 0;

      const { error } = await this.client
        .from('ui_activity_events')
        .delete()
        .lt('at', cutoff);
      if (error) throw error;

      return total;
    } catch (error) {
      console.error('Error purging UI activity events:', error);
      return 0;
    }
  }

  // Get or create Talia user
  async getOrCreateTaliaUser(supabaseUserId, email) {
    try {
      // First try to get existing user
      let taliaUser = await this.getTaliaUserByEmail(email);
      
      if (taliaUser) {
        // Update last_login_at
        await this.client
          .from('talia_users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', taliaUser.id);
        return taliaUser;
      }
      
      // User doesn't exist, create new one
      // Get next talia_user_id - query max and add 1, or start at 1000
      const { data: maxData } = await this.client
        .from('talia_users')
        .select('talia_user_id')
        .order('talia_user_id', { ascending: false })
        .limit(1)
        .single();
      
      const taliaUserId = maxData ? maxData.talia_user_id + 1 : 1000;
      
      const { data, error } = await this.client
        .from('talia_users')
        .insert({
          id: supabaseUserId,
          talia_user_id: taliaUserId,
          email: email,
          last_login_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        console.error('Supabase insert error for talia_user:', error);
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('Error getting/creating talia_user:', error);
      throw error;
    }
  }

  // Get Talia user by ID
  async getTaliaUserById(id) {
    try {
      const { data, error } = await this.client
        .from('talia_users')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Supabase query error for talia_user:', error);
        throw error;
      }
      
      return data || null;
    } catch (error) {
      console.error('Error querying talia_user:', error);
      throw error;
    }
  }

  // ===== User Focus Preferences =====

  // Get user focus preferences
  async getUserFocusPreferences(userId) {
    try {
      const { data, error } = await this.client
        .from('user_focus_preferences')
        .select('*')
        .eq('user_id', userId)
        .order('last_used', { ascending: false, nullsFirst: false });
      
      if (error) {
        console.error('Supabase query error for user_focus_preferences:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error querying user_focus_preferences:', error);
      throw error;
    }
  }

  // Update user focus preference
  async updateUserFocusPreference(userId, focusId, preferences) {
    try {
      const updateData = {
        user_id: userId,
        focus_id: focusId,
        updated_at: new Date().toISOString()
      };
      
      if (preferences.isFavorite !== undefined) {
        updateData.is_favorite = preferences.isFavorite;
      }
      if (preferences.lastUsed !== undefined) {
        updateData.last_used = preferences.lastUsed;
      }
      if (preferences.customLayout !== undefined) {
        updateData.custom_layout = preferences.customLayout;
      }
      
      const { data, error } = await this.client
        .from('user_focus_preferences')
        .upsert(updateData, {
          onConflict: 'user_id,focus_id'
        })
        .select()
        .single();
      
      if (error) {
        console.error('Supabase upsert error for user_focus_preference:', error);
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('Error updating user_focus_preference:', error);
      throw error;
    }
  }

  // Toggle favorite status
  async toggleFavorite(userId, focusId) {
    try {
      // First get current preference
      const { data: existing } = await this.client
        .from('user_focus_preferences')
        .select('is_favorite')
        .eq('user_id', userId)
        .eq('focus_id', focusId)
        .single();
      
      const newFavoriteStatus = existing ? !existing.is_favorite : true;
      
      return await this.updateUserFocusPreference(userId, focusId, {
        isFavorite: newFavoriteStatus
      });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      throw error;
    }
  }

  // ===== Focus Groups =====

  // Get all focus groups
  async getFocusGroups(filters = {}) {
    try {
      let queryBuilder = this.client.from('focus_groups').select('*');
      
      if (filters.isActive !== undefined) {
        queryBuilder = queryBuilder.eq('is_active', filters.isActive);
      }
      
      queryBuilder = queryBuilder.order('name', { ascending: true });
      
      const { data, error } = await queryBuilder;
      
      if (error) {
        console.error('Supabase query error for focus_groups:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error querying focus_groups:', error);
      throw error;
    }
  }

  // Create focus group
  async createFocusGroup(groupData) {
    try {
      const insertData = {
        name: groupData.name,
        description: groupData.description || null,
        is_active: groupData.isActive !== undefined ? groupData.isActive : true
      };
      
      if (groupData.createdBy) {
        insertData.created_by = groupData.createdBy;
      }
      
      const { data, error } = await this.client
        .from('focus_groups')
        .insert(insertData)
        .select()
        .single();
      
      if (error) {
        console.error('Supabase insert error for focus_group:', error);
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('Error creating focus_group:', error);
      throw error;
    }
  }

  // Update focus group
  async updateFocusGroup(groupId, updateData) {
    try {
      const updatePayload = {};
      
      if (updateData.name !== undefined) updatePayload.name = updateData.name;
      if (updateData.description !== undefined) updatePayload.description = updateData.description;
      if (updateData.isActive !== undefined) updatePayload.is_active = updateData.isActive;
      
      updatePayload.updated_at = new Date().toISOString();
      
      const { data, error } = await this.client
        .from('focus_groups')
        .update(updatePayload)
        .eq('id', groupId)
        .select()
        .single();
      
      if (error) {
        console.error('Supabase update error for focus_group:', error);
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('Error updating focus_group:', error);
      throw error;
    }
  }

  // Delete focus group
  async deleteFocusGroup(groupId) {
    try {
      const { error } = await this.client
        .from('focus_groups')
        .delete()
        .eq('id', groupId);
      
      if (error) {
        console.error('Supabase delete error for focus_group:', error);
        throw error;
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting focus_group:', error);
      throw error;
    }
  }

  // Get booking profile for a sailing
  async getBookingProfile(sailCode) {
    try {
      // First, get the sailing details from master_sail
      const { data: sailData, error: sailError } = await this.client
        .from('master_sail')
        .select('sail_code, sail_date_from, ship_name, ship_code')
        .eq('sail_code', sailCode)
        .single();

      if (sailError || !sailData) {
        throw new Error(`Sailing not found: ${sailCode}`);
      }

      // Get reservations for this sailing by joining reservation with master_sail logic
      // Since reservation doesn't have sail_code, we match by ship_code + sail_date_from
      const { data: reservations, error: resError } = await this.client
        .from('reservation')
        .select('res_id, sail_from_date, ship, res_status, guest_count')
        .eq('ship', sailData.ship_code)
        .eq('sail_from_date', sailData.sail_date_from);

      if (resError) {
        console.warn('Error fetching reservations:', resError);
      }

      // Use database function to get aggregated booking profile data
      let bookingDataPoints = [];
      
      if (reservations && reservations.length > 0) {
        const sailDate = new Date(sailData.sail_date_from);
        const sailDateEnd = new Date(sailDate);
        sailDateEnd.setHours(23, 59, 59, 999);
        const sailDateStr = sailDateEnd.toISOString().split('T')[0];
        
        // Query reservation_changes directly - simpler and more reliable
        // Get all changes for these reservations, process in smaller batches to avoid limits
        const resIds = reservations.map(r => r.res_id);
        const batchSize = 500; // Smaller batches for reliability
        let allChanges = [];
        
        for (let i = 0; i < resIds.length; i += batchSize) {
          const batch = resIds.slice(i, i + batchSize);
          
          // Query without date filter first, we'll filter in JS
          let page = 0;
          const pageSize = 1000;
          let hasMore = true;
          
          while (hasMore) {
            const { data: changesData, error: changesError } = await this.client
              .from('reservation_changes')
              .select('snapshot_date, res_id, guest_count, guest_count_delta')
              .in('res_id', batch)
              .order('snapshot_date', { ascending: true })
              .range(page * pageSize, (page + 1) * pageSize - 1);
            
            if (changesError) {
              console.error(`[getBookingProfile] Error batch ${i/batchSize + 1}, page ${page + 1}:`, changesError);
              hasMore = false;
            } else if (changesData && changesData.length > 0) {
              allChanges.push(...changesData);
              hasMore = changesData.length === pageSize;
              page++;
            } else {
              hasMore = false;
            }
          }
        }
        
        console.log(`[getBookingProfile] Total changes loaded: ${allChanges.length}`);
        
        // Get latest snapshot per reservation per date
        const latestSnapshots = new Map();
        allChanges.forEach(change => {
          const date = change.snapshot_date ? change.snapshot_date.split('T')[0] : null;
          if (!date || date > sailDateStr) return;
          
          const key = `${date}_${change.res_id}`;
          const existing = latestSnapshots.get(key);
          if (!existing || parseFloat(change.guest_count || 0) >= parseFloat(existing.guest_count || 0)) {
            latestSnapshots.set(key, change);
          }
        });
        
        // Group by date
        const groupedByDate = {};
        latestSnapshots.forEach((change, key) => {
          const date = change.snapshot_date ? change.snapshot_date.split('T')[0] : null;
          if (!date) return;
          
          if (!groupedByDate[date]) {
            groupedByDate[date] = {
              date,
              bookings: new Set(),
              guests: 0,
              newBookings: 0,
              cancellations: 0,
              netBookings: 0
            };
          }
          
          groupedByDate[date].bookings.add(change.res_id);
          groupedByDate[date].guests += parseFloat(change.guest_count || 0);
          
          const delta = parseFloat(change.guest_count_delta || 0);
          if (delta > 0) groupedByDate[date].newBookings++;
          if (delta < 0) groupedByDate[date].cancellations++;
        });
        
        // Convert Sets to counts and calculate netBookings
        Object.keys(groupedByDate).forEach(date => {
          groupedByDate[date].bookings = groupedByDate[date].bookings.size;
          groupedByDate[date].netBookings = groupedByDate[date].newBookings - groupedByDate[date].cancellations;
        });
        
        // Find the actual earliest date from the data
        const actualDates = Object.keys(groupedByDate).sort();
        console.log(`[getBookingProfile] Found ${actualDates.length} unique dates`);
        
        if (actualDates.length === 0) {
          // No data found - return empty array
          bookingDataPoints = [];
        } else {
          const actualFirstDate = new Date(actualDates[0]);
          actualFirstDate.setHours(0, 0, 0, 0);
          const sailDateEndForRange = new Date(sailDate);
          sailDateEndForRange.setHours(23, 59, 59, 999);
          
          // Generate date range from actual first booking date to sail date
          const dateRange = [];
          const currentDate = new Date(actualFirstDate);
          while (currentDate <= sailDateEndForRange) {
            dateRange.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          console.log(`[getBookingProfile] Date range: ${actualDates[0]} to ${sailDateEndForRange.toISOString().split('T')[0]}, ${dateRange.length} days`);
          
          // Build data points - use actual state for dates with data, last known state for missing dates
          let lastBookings = 0;
          let lastGuests = 0;
          
          dateRange.forEach(date => {
            const dateStr = date.toISOString().split('T')[0];
            const dayData = groupedByDate[dateStr];
            
            if (dayData) {
              // Use actual state for this date
              lastBookings = dayData.bookings;
              lastGuests = dayData.guests;
              
              bookingDataPoints.push({
                date: dateStr,
                bookings: lastBookings,
                guests: Math.round(lastGuests),
                newBookings: dayData.newBookings,
                cancellations: dayData.cancellations,
                netBookings: dayData.netBookings
              });
            } else {
              // Fill missing dates with last known state (not zero)
              bookingDataPoints.push({
                date: dateStr,
                bookings: lastBookings,
                guests: Math.round(lastGuests),
                newBookings: 0,
                cancellations: 0,
                netBookings: 0
              });
            }
          });
          
          console.log(`[getBookingProfile] Created ${bookingDataPoints.length} data points`);
        }
      }

      // Calculate current bookings and guests
      const currentBookings = (reservations || []).length;
      const currentGuests = (reservations || []).reduce((sum, r) => sum + parseFloat(r.guest_count || 0), 0);

      // Calculate booking velocity (bookings per day)
      const totalNewBookings = bookingDataPoints.reduce((sum, dp) => sum + dp.newBookings, 0);
      const daysWithBookings = bookingDataPoints.length;
      const bookingVelocity = daysWithBookings > 0 ? totalNewBookings / daysWithBookings : 0;

      // Calculate cancellation rate
      const totalCancellations = bookingDataPoints.reduce((sum, dp) => sum + dp.cancellations, 0);
      const cancellationRate = currentBookings > 0 ? (totalCancellations / (currentBookings + totalCancellations)) * 100 : 0;

      // Calculate days until sailing
      const sailDate = new Date(sailData.sail_date_from);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysUntilSailing = Math.ceil((sailDate - today) / (1000 * 60 * 60 * 24));

      return {
        sailCode: sailData.sail_code,
        sailDate: sailData.sail_date_from,
        shipName: sailData.ship_name,
        shipCode: sailData.ship_code,
        currentBookings,
        currentGuests: Math.round(currentGuests),
        bookingDataPoints,
        bookingVelocity: Math.round(bookingVelocity * 100) / 100,
        cancellationRate: Math.round(cancellationRate * 100) / 100,
        daysUntilSailing
      };
    } catch (error) {
      console.error('Error getting booking profile:', error);
      throw error;
    }
  }

  /**
   * Get booking profile with build curves at week intervals (W-12, W-10, W-8, W-6, W-4, W-2, Sail)
   * @param {string} sailCode - Sail code
   * @returns {Promise<Object>} Booking profile with build curves
   */
  async getBookingProfileWithCurves(sailCode) {
    try {
      // Get base booking profile
      const profile = await this.getBookingProfile(sailCode);
      
      if (!profile || !profile.sailDate) {
        throw new Error(`Sailing not found: ${sailCode}`);
      }

      const sailDate = new Date(profile.sailDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Define week intervals: W-12, W-10, W-8, W-6, W-4, W-2, Sail (0)
      const weekIntervals = [12, 10, 8, 6, 4, 2, 0];
      const buildCurves = [];

      // Calculate bookings at each week interval
      for (const weeks of weekIntervals) {
        const targetDate = new Date(sailDate);
        targetDate.setDate(targetDate.getDate() - (weeks * 7));
        targetDate.setHours(23, 59, 59, 999);
        const targetDateStr = targetDate.toISOString().split('T')[0];

        // Find the closest data point on or before this date
        let bookings = 0;
        let guests = 0;
        
        // Find the latest data point on or before target date
        for (let i = profile.bookingDataPoints.length - 1; i >= 0; i--) {
          const point = profile.bookingDataPoints[i];
          if (point.date <= targetDateStr) {
            bookings = point.bookings;
            guests = point.guests;
            break;
          }
        }

        const weekLabel = weeks === 0 ? 'Sail' : `W-${weeks}`;
        buildCurves.push({
          weekLabel,
          weeksUntilSailing: weeks,
          bookings,
          guests: Math.round(guests),
          percentageOfTarget: null, // Will be calculated if target profile exists
          actualVsTarget: null
        });
      }

      return {
        ...profile,
        buildCurves
      };
    } catch (error) {
      console.error('Error getting booking profile with curves:', error);
      throw error;
    }
  }

  /**
   * Get all target profiles with optional filters
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of target profiles
   */
  async getTargetProfiles(filters = {}) {
    try {
      let query = this.client
        .from('target_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.sailCode) {
        query = query.eq('sail_code', filters.sailCode);
      }
      if (filters.shipCode) {
        query = query.eq('ship_code', filters.shipCode);
      }
      if (filters.packageType) {
        query = query.eq('package_type', filters.packageType);
      }
      if (filters.seasonCode) {
        query = query.eq('season_code', filters.seasonCode);
      }
      if (filters.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      } else {
        // Default to active only
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Transform to GraphQL format
      return (data || []).map(profile => ({
        id: profile.id,
        name: profile.name,
        description: profile.description,
        sailCode: profile.sail_code,
        shipCode: profile.ship_code,
        packageType: profile.package_type,
        seasonCode: profile.season_code,
        geogAreaCode: profile.geog_area_code,
        buildCurves: profile.build_curves || [],
        basedOnHistoric: profile.based_on_historic || [],
        createdBy: profile.created_by,
        profileScope: (() => {
          const s = String(profile.profile_scope || 'system').toLowerCase();
          if (s === 'system') return 'SYSTEM';
          if (s === 'global') return 'GLOBAL';
          return 'USER';
        })(),
        lastEditedBy: profile.last_edited_by || null,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
        isActive: profile.is_active
      }));
    } catch (error) {
      console.error('Error getting target profiles:', error);
      throw error;
    }
  }

  /**
   * Get single target profile by ID
   * @param {string} id - Target profile ID
   * @returns {Promise<Object>} Target profile
   */
  async getTargetProfile(id) {
    try {
      const { data, error } = await this.client
        .from('target_profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        return null;
      }

      // Transform to GraphQL format
      return {
        id: data.id,
        name: data.name,
        description: data.description,
        sailCode: data.sail_code,
        shipCode: data.ship_code,
        packageType: data.package_type,
        seasonCode: data.season_code,
        geogAreaCode: data.geog_area_code,
        buildCurves: data.build_curves || [],
        basedOnHistoric: data.based_on_historic || [],
        createdBy: data.created_by,
        profileScope: (() => {
          const s = String(data.profile_scope || 'system').toLowerCase();
          if (s === 'system') return 'SYSTEM';
          if (s === 'global') return 'GLOBAL';
          return 'USER';
        })(),
        lastEditedBy: data.last_edited_by || null,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        isActive: data.is_active
      };
    } catch (error) {
      console.error('Error getting target profile:', error);
      throw error;
    }
  }

  /**
   * Create new target profile
   * @param {Object} input - Target profile input
   * @param {string} createdBy - User ID who created this
   * @returns {Promise<Object>} Created target profile
   */
  async createTargetProfile(input, lastEditedBy = null) {
    try {
      const { data, error } = await this.client
        .from('target_profiles')
        .insert({
          name: input.name,
          description: input.description || null,
          sail_code: input.sailCode || null,
          ship_code: input.shipCode || null,
          package_type: input.packageType || null,
          season_code: input.seasonCode || null,
          geog_area_code: input.geogAreaCode || null,
          build_curves: input.buildCurves || [],
          based_on_historic: input.basedOnHistoric || [],
          created_by: null,
          profile_scope: 'system',
          last_edited_by: lastEditedBy || null,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Transform to GraphQL format
      return {
        id: data.id,
        name: data.name,
        description: data.description,
        sailCode: data.sail_code,
        shipCode: data.ship_code,
        packageType: data.package_type,
        seasonCode: data.season_code,
        geogAreaCode: data.geog_area_code,
        buildCurves: data.build_curves || [],
        basedOnHistoric: data.based_on_historic || [],
        createdBy: data.created_by,
        profileScope: String(data.profile_scope || 'system').toUpperCase() === 'GLOBAL'
          ? 'GLOBAL'
          : (String(data.profile_scope || 'system').toUpperCase() === 'SYSTEM' ? 'SYSTEM' : 'USER'),
        lastEditedBy: data.last_edited_by || null,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        isActive: data.is_active
      };
    } catch (error) {
      console.error('Error creating target profile:', error);
      throw error;
    }
  }

  /**
   * Update target profile
   * @param {string} id - Target profile ID
   * @param {Object} input - Target profile input
   * @returns {Promise<Object>} Updated target profile
   */
  async updateTargetProfile(id, input, lastEditedBy = null) {
    try {
      const updateData = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.sailCode !== undefined) updateData.sail_code = input.sailCode;
      if (input.shipCode !== undefined) updateData.ship_code = input.shipCode;
      if (input.packageType !== undefined) updateData.package_type = input.packageType;
      if (input.seasonCode !== undefined) updateData.season_code = input.seasonCode;
      if (input.geogAreaCode !== undefined) updateData.geog_area_code = input.geogAreaCode;
      if (input.buildCurves !== undefined) updateData.build_curves = input.buildCurves;
      if (input.basedOnHistoric !== undefined) updateData.based_on_historic = input.basedOnHistoric;
      if (input.profileScope !== undefined) {
        const ps = String(input.profileScope).toUpperCase();
        updateData.profile_scope = ps === 'GLOBAL' ? 'global' : (ps === 'SYSTEM' ? 'system' : 'user');
      }
      if (lastEditedBy) updateData.last_edited_by = lastEditedBy;

      const { data, error } = await this.client
        .from('target_profiles')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Transform to GraphQL format
      return {
        id: data.id,
        name: data.name,
        description: data.description,
        sailCode: data.sail_code,
        shipCode: data.ship_code,
        packageType: data.package_type,
        seasonCode: data.season_code,
        geogAreaCode: data.geog_area_code,
        buildCurves: data.build_curves || [],
        basedOnHistoric: data.based_on_historic || [],
        createdBy: data.created_by,
        profileScope: (() => {
          const s = String(data.profile_scope || 'system').toLowerCase();
          if (s === 'system') return 'SYSTEM';
          if (s === 'global') return 'GLOBAL';
          return 'USER';
        })(),
        lastEditedBy: data.last_edited_by || null,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        isActive: data.is_active
      };
    } catch (error) {
      console.error('Error updating target profile:', error);
      throw error;
    }
  }

  /**
   * Delete target profile (soft delete)
   * @param {string} id - Target profile ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteTargetProfile(id) {
    try {
      const { error } = await this.client
        .from('target_profiles')
        .update({ is_active: false })
        .eq('id', id);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error deleting target profile:', error);
      throw error;
    }
  }

  /**
   * Import booking targets supplied (CSV data) into booking_targets_supplied table
   * @param {Array} rows - Array of { sailCode, shipCode, weekLabel, weeksUntilSailing, targetBookings, targetGuests }
   * @param {string} batchId - UUID for this import batch
   * @param {string} userId - Optional user ID
   * @returns {Promise<{ rowsImported: number, batchId: string }>}
   */
  async importBookingTargetsSupplied(rows, batchId, userId = null) {
    try {
      const id = batchId || crypto.randomUUID();
      if (!rows || rows.length === 0) {
        return { rowsImported: 0, batchId: id };
      }
      // Replace mode: clear existing before insert
      const { error: delError } = await this.client
        .from('booking_targets_supplied')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all
      if (delError) throw delError;
      const records = rows.map((r) => ({
        sail_code: String(r.sailCode || '').trim(),
        ship_code: r.shipCode ? String(r.shipCode).trim() : null,
        week_label: String(r.weekLabel || '').trim(),
        weeks_until_sailing: r.weeksUntilSailing != null ? parseInt(r.weeksUntilSailing, 10) : null,
        target_bookings: parseInt(r.targetBookings, 10) || 0,
        target_guests: parseInt(r.targetGuests, 10) || 0,
        import_batch_id: id,
        imported_by: userId || null,
      })).filter((r) => r.sail_code && r.week_label);
      const batchSize = 100;
      let rowsImported = 0;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { error } = await this.client
          .from('booking_targets_supplied')
          .insert(batch);
        if (error) throw error;
        rowsImported += batch.length;
      }
      return { rowsImported, batchId: id };
    } catch (error) {
      console.error('Error importing booking targets supplied:', error);
      throw error;
    }
  }

  /**
   * Get booking targets supplied (optionally by sail code)
   */
  async getBookingTargetsSupplied(sailCode = null) {
    try {
      let query = this.client
        .from('booking_targets_supplied')
        .select('*')
        .order('sail_code')
        .order('weeks_until_sailing', { ascending: false });
      if (sailCode) {
        query = query.eq('sail_code', sailCode);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((r) => ({
        id: r.id,
        sailCode: r.sail_code,
        shipCode: r.ship_code,
        weekLabel: r.week_label,
        weeksUntilSailing: r.weeks_until_sailing,
        targetBookings: r.target_bookings,
        targetGuests: r.target_guests,
        importBatchId: r.import_batch_id,
        importedAt: r.imported_at,
      }));
    } catch (error) {
      console.error('Error getting booking targets supplied:', error);
      throw error;
    }
  }

  /**
   * Get target mapping configs
   */
  async getTargetMappingConfigs() {
    try {
      const { data, error } = await this.client
        .from('target_mapping_config')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        config: r.config || {},
        isActive: r.is_active,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    } catch (error) {
      console.error('Error getting target mapping configs:', error);
      throw error;
    }
  }

  // ===== Inventory Item Mapping + Memos =====

  async getShipTrackingTargets(filters = {}) {
    try {
      let query = this.client
        .from('ship_tracking_target')
        .select('*')
        .order('display_order', { ascending: true })
        .order('ship_code', { ascending: true });

      if (filters.enabled !== undefined) {
        query = query.eq('enabled', Boolean(filters.enabled));
      } else {
        query = query.eq('enabled', true);
      }

      if (filters.ship_code) {
        query = query.eq('ship_code', String(filters.ship_code).toUpperCase());
      }

      if (Array.isArray(filters.ship_codes) && filters.ship_codes.length) {
        const shipCodes = filters.ship_codes.map((code) => String(code).toUpperCase());
        query = query.in('ship_code', shipCodes);
      }

      query = query.limit(filters.limit || 500);

      const { data, error } = await query;
      if (error) {
        throw new Error(error.message || 'Failed to fetch ship_tracking_target rows');
      }
      return data || [];
    } catch (error) {
      console.error('Error getting ship tracking targets:', error);
      throw new Error(error?.message || 'Failed to load ship tracking targets');
    }
  }

  async getInventoryItems(filters = {}) {
    try {
      let query = this.client
        .from('inventory_item')
        .select('*')
        .order('updated_at', { ascending: false });

      if (filters.id) {
        query = query.eq('id', filters.id);
      }
      if (filters.local_key) {
        query = query.eq('local_key', filters.local_key);
      }
      if (filters.sail_code) {
        query = query.eq('sail_code', filters.sail_code);
      }
      if (filters.reference_sail_code) {
        query = query.eq('reference_sail_code', filters.reference_sail_code);
      }
      if (filters.mmsi) {
        query = query.eq('mmsi', String(filters.mmsi));
      }
      if (filters.ship_code) {
        query = query.eq('ship_code', filters.ship_code);
      }
      if (filters.master_sail_id) {
        query = query.eq('master_sail_id', filters.master_sail_id);
      }

      query = query.limit(filters.limit || 200);

      const { data, error } = await query;
      if (error) {
        throw new Error(error.message || 'Failed to fetch inventory_item rows');
      }
      return data || [];
    } catch (error) {
      console.error('Error getting inventory items:', error);
      throw new Error(error?.message || 'Failed to load inventory items');
    }
  }

  async upsertInventoryItem(input = {}) {
    try {
      const normalizedMmsi = input.mmsi ? String(input.mmsi) : null;

      const payload = {
        sail_code: input.sailCode || null,
        reference_sail_code: input.referenceSailCode || null,
        mmsi: normalizedMmsi,
        imo_number: input.imoNumber || null,
        ship_code: input.shipCode || null,
        ship_name: input.shipName || null,
        master_sail_id: input.masterSailId ?? null,
        package_id: input.packageId ?? null,
        source_table: input.sourceTable || 'manual',
        source_row_id: input.sourceRowId || null,
        metadata: input.metadata || {}
      };

      // If an explicit ID is provided, update this row directly
      if (input.id) {
        const { data, error } = await this.client
          .from('inventory_item')
          .update(payload)
          .eq('id', input.id)
          .select('*')
          .single();
        if (error) throw new Error(error.message || 'Failed to update inventory_item');
        return data;
      }

      // Resolve existing row using canonical mapping keys
      let existing = null;
      if (payload.sail_code && payload.ship_code) {
        const { data } = await this.client
          .from('inventory_item')
          .select('*')
          .eq('sail_code', payload.sail_code)
          .eq('ship_code', payload.ship_code)
          .limit(1)
          .maybeSingle();
        existing = data || null;
      } else if (payload.sail_code && payload.mmsi) {
        const { data } = await this.client
          .from('inventory_item')
          .select('*')
          .eq('sail_code', payload.sail_code)
          .eq('mmsi', payload.mmsi)
          .limit(1)
          .maybeSingle();
        existing = data || null;
      }

      if (existing?.id) {
        const { data, error } = await this.client
          .from('inventory_item')
          .update(payload)
          .eq('id', existing.id)
          .select('*')
          .single();
        if (error) throw new Error(error.message || 'Failed to update inventory_item');
        return data;
      }

      const { data, error } = await this.client
        .from('inventory_item')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw new Error(error.message || 'Failed to insert inventory_item');
      return data;
    } catch (error) {
      console.error('Error upserting inventory item:', error);
      throw new Error(error?.message || 'Failed to upsert inventory item');
    }
  }

  async getInventoryMemos(inventoryItemId, limit = 200) {
    try {
      const { data, error } = await this.client
        .from('inventory_item_memo')
        .select('*')
        .eq('inventory_item_id', inventoryItemId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message || 'Failed to fetch inventory_item_memo rows');
      return data || [];
    } catch (error) {
      console.error('Error getting inventory memos:', error);
      throw new Error(error?.message || 'Failed to load inventory memos');
    }
  }

  async createInventoryMemo(input = {}, createdBy = null) {
    try {
      const payload = {
        inventory_item_id: input.inventoryItemId,
        memo_text: input.memoText,
        memo_type: input.memoType || 'note',
        created_by: createdBy || null
      };
      const { data, error } = await this.client
        .from('inventory_item_memo')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw new Error(error.message || 'Failed to insert inventory_item_memo');
      return data;
    } catch (error) {
      console.error('Error creating inventory memo:', error);
      throw new Error(error?.message || 'Failed to create inventory memo');
    }
  }

  async getInventoryProfileSeriesPoints(inventoryItemId) {
    try {
      const { data, error } = await this.client
        .from('inventory_item_profile_curve_point')
        .select('*')
        .eq('inventory_item_id', inventoryItemId)
        .order('series_kind', { ascending: true })
        .order('model_key', { ascending: true })
        .order('point_order', { ascending: true });
      if (error) throw new Error(error.message || 'Failed to fetch inventory profile curve points');
      return data || [];
    } catch (error) {
      console.error('Error getting inventory profile series points:', error);
      throw new Error(error?.message || 'Failed to load inventory profile series points');
    }
  }

  async upsertInventoryProfileSeries(input = {}) {
    try {
      const inventoryItemId = Number(input.inventoryItemId);
      if (!Number.isFinite(inventoryItemId)) {
        throw new Error('inventoryItemId is required');
      }
      const kind = String(input.kind || '').toUpperCase();
      const modelKey = input.modelKey ? String(input.modelKey).trim() : null;
      const modelLabel = input.modelLabel ? String(input.modelLabel).trim() : null;
      const points = Array.isArray(input.points) ? input.points : [];
      const profileScope = String(input.profileScope || 'system').toLowerCase();
      const ownerKey = String(input.ownerKey || 'talia');
      const lastEditedBy = input.lastEditedBy || null;

      let deleteQuery = this.client
        .from('inventory_item_profile_curve_point')
        .delete()
        .eq('inventory_item_id', inventoryItemId)
        .eq('series_kind', kind)
        .eq('profile_scope', profileScope)
        .eq('owner_key', ownerKey);
      if (kind === 'MODEL') {
        deleteQuery = deleteQuery.eq('model_key', modelKey || 'default');
      } else {
        deleteQuery = deleteQuery.is('model_key', null);
      }
      const { error: deleteError } = await deleteQuery;
      if (deleteError) throw new Error(deleteError.message || 'Failed to clear previous series points');

      if (points.length === 0) {
        return [];
      }

      const rows = points.map((p, idx) => ({
        inventory_item_id: inventoryItemId,
        series_kind: kind,
        model_key: kind === 'MODEL' ? (modelKey || 'default') : null,
        model_label: kind === 'MODEL' ? modelLabel : null,
        profile_scope: profileScope,
        owner_key: ownerKey,
        created_by: null,
        last_edited_by: lastEditedBy,
        point_order: p.pointOrder ?? idx,
        week_label: p.weekLabel,
        weeks_until_sailing: p.weeksUntilSailing ?? null,
        value_bookings: p.valueBookings ?? null,
        value_guests: p.valueGuests ?? null,
        as_of_date: p.asOfDate || null,
        source: p.source || null,
        metadata: p.metadata || {},
      }));

      const { data, error } = await this.client
        .from('inventory_item_profile_curve_point')
        .insert(rows)
        .select('*')
        .order('point_order', { ascending: true });
      if (error) throw new Error(error.message || 'Failed to insert inventory profile curve points');
      return data || [];
    } catch (error) {
      console.error('Error upserting inventory profile series:', error);
      throw new Error(error?.message || 'Failed to upsert inventory profile series');
    }
  }

  async deleteInventoryProfileSeries(inventoryItemId, kind, modelKey = null) {
    try {
      let query = this.client
        .from('inventory_item_profile_curve_point')
        .delete()
        .eq('inventory_item_id', inventoryItemId)
        .eq('series_kind', String(kind || '').toUpperCase())
        .eq('profile_scope', 'system')
        .eq('owner_key', 'talia');

      if (String(kind || '').toUpperCase() === 'MODEL') {
        query = query.eq('model_key', modelKey || 'default');
      } else {
        query = query.is('model_key', null);
      }

      const { error } = await query;
      if (error) throw new Error(error.message || 'Failed to delete inventory profile series');
      return true;
    } catch (error) {
      console.error('Error deleting inventory profile series:', error);
      throw new Error(error?.message || 'Failed to delete inventory profile series');
    }
  }

  // Get competitor pricing data
  async getCompetitorPricing(filters = {}) {
    try {
      let queryBuilder = this.client.from('competitor_current_state').select('*');
      
      // Apply filters
      if (filters.currency) {
        queryBuilder = queryBuilder.eq('currency', filters.currency);
      }
      if (filters.duration) {
        queryBuilder = queryBuilder.eq('duration', filters.duration);
      }
      if (filters.destination) {
        queryBuilder = queryBuilder.ilike('destination', `%${filters.destination}%`);
      }
      if (filters.cruiseLine) {
        queryBuilder = queryBuilder.ilike('cruise_line', `%${filters.cruiseLine}%`);
      }
      if (filters.market) {
        queryBuilder = queryBuilder.eq('market', filters.market);
      }
      if (filters.isLatest !== undefined && filters.isLatest) {
        // Get the latest snapshot_date
        const { data: latestSnapshot } = await this.client
          .from('competitor_current_state')
          .select('snapshot_date')
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .single();
        
        if (latestSnapshot) {
          queryBuilder = queryBuilder.eq('snapshot_date', latestSnapshot.snapshot_date);
        }
      }
      
      // Filter by departure month if provided
      if (filters.departureMonth) {
        // We'll filter this in JavaScript after fetching, as Supabase doesn't have easy month extraction
      }
      
      // Apply ordering
      queryBuilder = queryBuilder.order('departure_date', { ascending: true });
      
      const { data, error } = await queryBuilder;
      
      if (error) {
        console.error('Supabase query error for competitor pricing:', error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        return [];
      }
      
      // Filter by departure month if provided
      let filteredData = data;
      if (filters.departureMonth) {
        filteredData = data.filter(row => {
          if (!row.departure_date) return false;
          const date = new Date(row.departure_date);
          return date.getMonth() + 1 === filters.departureMonth; // getMonth() returns 0-11
        });
      }
      
      // Transform data to include all cabin types and calculate PPPD
      const result = [];
      const cabinTypes = ['INSIDE', 'OUTSIDE', 'BALCONY', 'SUITE'];
      const cabinTypeFields = {
        'INSIDE': 'lowest_inside',
        'OUTSIDE': 'lowest_outside',
        'BALCONY': 'lowest_balcony',
        'SUITE': 'lowest_suite'
      };
      
      for (const row of filteredData) {
        const duration = parseFloat(row.duration) || 1;
        
        // If cabinType filter is "ALL" or not specified, include all cabin types
        // Otherwise, only include the specified cabin type
        const cabinTypesToInclude = filters.cabinType && filters.cabinType !== 'ALL'
          ? [filters.cabinType]
          : cabinTypes;
        
        for (const cabinType of cabinTypesToInclude) {
          const priceField = cabinTypeFields[cabinType];
          const price = parseFloat(row[priceField]);
          
          // Only include rows with valid prices
          if (price && price > 0 && duration > 0) {
            const pppd = price / duration;
            const totalRatePP = price;
            
            // Generate a unique ID for this record
            const id = `${row.competitor_key}-${cabinType}`;
            
            result.push({
              id,
              cruiseLine: row.cruise_line || '',
              currency: row.currency || '',
              shipCode: null, // Not in competitor_current_state
              shipName: row.ship_name || '',
              cabinType: cabinType,
              departureDate: row.departure_date || '',
              departurePort: row.departure_port || '',
              destination: row.destination || '',
              market: row.market || '',
              duration: duration,
              pppd: Math.round(pppd * 100) / 100, // Round to 2 decimal places
              totalRatePP: Math.round(totalRatePP * 100) / 100,
              snapshotDate: row.snapshot_date || '',
              availableOffer: null, // Not in competitor_current_state
              itineraryCode: null // Not in competitor_current_state
            });
          }
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error querying competitor pricing:', error);
      throw error;
    }
  }

  // ===== Google Search Trends =====

  /**
   * Store a search trend data point
   * @param {Object} trendData - Trend data to store
   * @returns {Promise<Object>} Stored trend record
   */
  async storeSearchTrend(trendData) {
    try {
      const { data, error } = await this.client
        .from('google_search_trends')
        .upsert({
          query: trendData.query,
          total_results: trendData.total_results,
          search_time: trendData.search_time || null,
          search_date: trendData.search_date || new Date().toISOString().split('T')[0],
          search_timestamp: trendData.search_timestamp || new Date().toISOString(),
          notes: trendData.notes || null,
          created_by: trendData.created_by || null
        }, {
          onConflict: 'query,search_date'
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error storing search trend:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error storing search trend:', error);
      throw error;
    }
  }

  /**
   * Get search trends data
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of trend data points
   */
  async getSearchTrends(filters = {}) {
    try {
      let queryBuilder = this.client
        .from('google_search_trends')
        .select('*');

      // Filter by query
      if (filters.query) {
        queryBuilder = queryBuilder.eq('query', filters.query);
      }

      // Filter by queries (multiple)
      if (filters.queries && Array.isArray(filters.queries) && filters.queries.length > 0) {
        queryBuilder = queryBuilder.in('query', filters.queries);
      }

      // Filter by date range
      if (filters.dateFrom) {
        queryBuilder = queryBuilder.gte('search_date', filters.dateFrom);
      }
      if (filters.dateTo) {
        queryBuilder = queryBuilder.lte('search_date', filters.dateTo);
      }

      // Order by date
      queryBuilder = queryBuilder.order('search_date', { ascending: true });
      queryBuilder = queryBuilder.order('search_timestamp', { ascending: true });

      // Apply limit
      const limit = filters.limit || 1000;
      queryBuilder = queryBuilder.limit(limit);

      const { data, error } = await queryBuilder;

      if (error) {
        console.error('Supabase error getting search trends:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error getting search trends:', error);
      throw error;
    }
  }

  /**
   * Get unique search queries from trends
   * @returns {Promise<Array>} Array of unique query strings
   */
  async getTrackedQueries() {
    try {
      const { data, error } = await this.client
        .from('google_search_trends')
        .select('query')
        .order('query', { ascending: true });

      if (error) {
        console.error('Supabase error getting tracked queries:', error);
        throw error;
      }

      // Get unique queries
      const uniqueQueries = [...new Set((data || []).map(item => item.query))];
      return uniqueQueries;
    } catch (error) {
      console.error('Error getting tracked queries:', error);
      throw error;
    }
  }

  // ===== Google Trends Data =====

  /**
   * Store Google Trends data point
   * @param {Object} trendData - Trend data to store
   * @param {string} trendData.search_query - Search query
   * @param {string} trendData.date - Date (YYYY-MM-DD)
   * @param {number} trendData.interest_score - Interest score (0-100)
   * @param {string} trendData.region - Geographic region (default: '')
   * @param {string} trendData.category - Category (optional)
   * @returns {Promise<Object>} Stored trend record
   */
  async storeGoogleTrendsData(trendData) {
    try {
      const { data, error } = await this.client
        .from('google_trends_data')
        .upsert({
          search_query: trendData.search_query,
          date: trendData.date,
          interest_score: trendData.interest_score,
          region: trendData.region || '',
          category: trendData.category || null
        }, {
          onConflict: 'search_query,date,region'
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error storing Google Trends data:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error storing Google Trends data:', error);
      throw error;
    }
  }

  /**
   * Store multiple Google Trends data points in batch
   * @param {Array<Object>} trendsData - Array of trend data points
   * @returns {Promise<Array>} Array of stored records
   */
  async storeGoogleTrendsDataBatch(trendsData) {
    try {
      if (!trendsData || trendsData.length === 0) {
        return [];
      }

      // Get unique search queries
      const uniqueQueries = [...new Set(trendsData.map(t => t.search_query).filter(Boolean))];
      
      // Get or create search terms and map to IDs
      const searchTermMap = new Map();
      
      for (const query of uniqueQueries) {
        // Try to get existing search term
        let { data: existing, error: getError } = await this.client
          .from('google_trends_search_terms')
          .select('id')
          .eq('search_term', query)
          .single();

        let searchTermId;
        
        if (existing && !getError) {
          searchTermId = existing.id;
          // Update last_queried_date
          await this.client
            .from('google_trends_search_terms')
            .update({ 
              last_queried_date: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', searchTermId);
        } else {
          // Create new search term
          const { data: newTerm, error: createError } = await this.client
            .from('google_trends_search_terms')
            .insert({
              search_term: query,
              category: trendsData.find(t => t.search_query === query)?.category || null,
              is_active: true,
              last_queried_date: new Date().toISOString()
            })
            .select()
            .single();

          if (createError) {
            console.error(`Error creating search term "${query}":`, createError);
            continue;
          }
          searchTermId = newTerm.id;
        }
        
        searchTermMap.set(query, searchTermId);
      }

      // Build records with search_term_id
      const records = trendsData
        .filter(trend => searchTermMap.has(trend.search_query))
        .map(trend => ({
          search_term_id: searchTermMap.get(trend.search_query),
          date: trend.date,
          interest_score: trend.interest_score,
          region: trend.region || '',
          category: trend.category || null
        }));

      if (records.length === 0) {
        return [];
      }

      // Upsert using search_term_id, date, region as unique constraint
      // Same pattern as other upserts in this file (e.g., storeSearchTrend)
      const { data, error } = await this.client
        .from('google_trends_data')
        .upsert(records, {
          onConflict: 'search_term_id,date,region'
        })
        .select();

      if (error) {
        console.error('Supabase error storing Google Trends data batch:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error storing Google Trends data batch:', error);
      throw error;
    }
  }

  /**
   * Get Google Trends data
   * @param {Object} filters - Filter options
   * @param {string|Array<string>} filters.queries - Query or queries to filter by
   * @param {string} filters.startDate - Start date (YYYY-MM-DD)
   * @param {string} filters.endDate - End date (YYYY-MM-DD)
   * @param {string} filters.region - Geographic region filter
   * @param {number} filters.limit - Limit results
   * @returns {Promise<Array>} Array of trend data points
   */
  async getGoogleTrendsData(filters = {}) {
    try {
      // Join with search_terms table to get search_term
      let queryBuilder = this.client
        .from('google_trends_data')
        .select(`
          *,
          google_trends_search_terms!inner(search_term, category)
        `);

      // Filter by query/queries - need to join with search_terms
      if (filters.queries) {
        // First get search_term_ids for the queries
        const { data: searchTerms, error: searchTermsError } = await this.client
          .from('google_trends_search_terms')
          .select('id, search_term')
          .in('search_term', Array.isArray(filters.queries) ? filters.queries : [filters.queries])
          .eq('is_active', true);

        if (searchTermsError) {
          throw searchTermsError;
        }

        const searchTermIds = (searchTerms || []).map(st => st.id);
        
        if (searchTermIds.length > 0) {
          queryBuilder = queryBuilder.in('search_term_id', searchTermIds);
        } else {
          // No matching search terms, return empty
          return [];
        }
      }

      // Filter by date range
      if (filters.startDate) {
        queryBuilder = queryBuilder.gte('date', filters.startDate);
      }
      if (filters.endDate) {
        queryBuilder = queryBuilder.lte('date', filters.endDate);
      }

      // Filter by region
      if (filters.region !== undefined) {
        queryBuilder = queryBuilder.eq('region', filters.region || '');
      }

      // Order by date
      queryBuilder = queryBuilder.order('date', { ascending: true });

      // Apply limit - Supabase defaults to 1000 rows, so we need to set a high limit to get all data
      const limit = filters.limit || 100000; // Default to 100k to get all data (no practical limit)
      queryBuilder = queryBuilder.limit(limit);

      const { data, error } = await queryBuilder;

      if (error) {
        console.error('Supabase error getting Google Trends data:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Flatten the response - extract search_term from joined table
      // Supabase returns nested object: { google_trends_search_terms: { search_term: ... } }
      const flattenedData = (data || []).map(item => {
        // Handle nested structure from Supabase join
        const searchTermObj = item.google_trends_search_terms;
        const searchTerm = searchTermObj?.search_term || item.search_term || item.search_query;
        const category = searchTermObj?.category || item.category;
        
        return {
          id: item.id,
          search_term_id: item.search_term_id,
          date: item.date,
          interest_score: item.interest_score,
          region: item.region || '',
          category: category,
          created_at: item.created_at,
          updated_at: item.updated_at,
          search_query: searchTerm || '' // Ensure search_query is set for resolver compatibility
        };
      });

      return flattenedData;
    } catch (error) {
      console.error('Error getting Google Trends data:', error);
      throw error;
    }
  }

  /**
   * Get unique search queries from Google Trends data
   * @returns {Promise<Array>} Array of unique query strings
   */
  async getGoogleTrendsQueries() {
    try {
      // Get search terms from search_terms table
      const { data, error } = await this.client
        .from('google_trends_search_terms')
        .select('search_term')
        .eq('is_active', true)
        .order('search_term', { ascending: true });

      if (error) {
        console.error('Supabase error getting Google Trends queries:', error);
        throw error;
      }

      return (data || []).map(item => item.search_term);
    } catch (error) {
      console.error('Error getting Google Trends queries:', error);
      throw error;
    }
  }

  // ===== Google Trends Search Terms =====

  /**
   * Get all search terms
   * @returns {Promise<Array>} Array of search terms
   */
  async getGoogleTrendsSearchTerms() {
    try {
      const { data, error } = await this.client
        .from('google_trends_search_terms')
        .select('*')
        .eq('is_active', true)
        .order('search_term', { ascending: true });

      if (error) {
        console.error('Supabase error getting search terms:', error);
        throw error;
      }

      return (data || []).map(item => ({
        id: item.id,
        searchTerm: item.search_term,
        category: item.category,
        isActive: item.is_active,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        lastQueriedDate: item.last_queried_date
      }));
    } catch (error) {
      console.error('Error getting search terms:', error);
      throw error;
    }
  }

  /**
   * Create a search term
   * @param {Object} input - Search term data
   * @returns {Promise<Object>} Created search term
   */
  async createGoogleTrendsSearchTerm(input) {
    try {
      const { data, error } = await this.client
        .from('google_trends_search_terms')
        .insert({
          search_term: input.searchTerm,
          category: input.category || null,
          is_active: input.isActive !== undefined ? input.isActive : true
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error creating search term:', error);
        throw error;
      }

      return {
        id: data.id,
        searchTerm: data.search_term,
        category: data.category,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error) {
      console.error('Error creating search term:', error);
      throw error;
    }
  }

  /**
   * Update a search term
   * @param {number} id - Search term ID
   * @param {Object} input - Updated search term data
   * @returns {Promise<Object>} Updated search term
   */
  async updateGoogleTrendsSearchTerm(id, input) {
    try {
      const updateData = {};
      if (input.searchTerm !== undefined) updateData.search_term = input.searchTerm;
      if (input.category !== undefined) updateData.category = input.category;
      if (input.isActive !== undefined) updateData.is_active = input.isActive;

      const { data, error } = await this.client
        .from('google_trends_search_terms')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase error updating search term:', error);
        throw error;
      }

      return {
        id: data.id,
        searchTerm: data.search_term,
        category: data.category,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error) {
      console.error('Error updating search term:', error);
      throw error;
    }
  }

  /**
   * Delete a search term
   * @param {number} id - Search term ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteGoogleTrendsSearchTerm(id) {
    try {
      const { error } = await this.client
        .from('google_trends_search_terms')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase error deleting search term:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error deleting search term:', error);
      throw error;
    }
  }

  // ===== Data Refresh Metadata =====

  /**
   * Get refresh metadata for a data source
   * @param {string} dataSource - Data source identifier (e.g., 'google_trends')
   * @returns {Promise<Object|null>} Refresh metadata or null if not found
   */
  async getRefreshMetadata(dataSource) {
    try {
      const { data, error } = await this.client
        .from('operation_metadata')
        .select('*')
        .eq('operation_type', 'refresh')
        .eq('operation_name', dataSource)
        .single();

      // PGRST116 = not found (this is OK - means no metadata yet)
      if (error && error.code !== 'PGRST116') {
        // Check if table doesn't exist (42P01 = undefined table)
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.warn('Operation metadata table does not exist yet. Run migration: 20251207000000_create_unified_operation_metadata.sql');
          return null;
        }
        console.error('Supabase error getting refresh metadata:', error);
        throw error;
      }

      // Map unified schema back to legacy format for backward compatibility
      if (data) {
        return {
          data_source: data.operation_name,
          last_refreshed_at: data.last_run_at,
          refresh_status: data.status,
          refresh_error: data.error,
          records_updated: data.records_updated,
          metadata: data.metadata || {},
          created_at: data.created_at,
          updated_at: data.updated_at
        };
      }

      return null;
    } catch (error) {
      // If table doesn't exist, return null instead of throwing
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Operation metadata table does not exist yet.');
        return null;
      }
      console.error('Error getting refresh metadata:', error);
      throw error;
    }
  }

  /**
   * Update or create refresh metadata
   * @param {string} dataSource - Data source identifier
   * @param {Object} metadata - Metadata to store
   * @returns {Promise<Object>} Updated metadata
   */
  async updateRefreshMetadata(dataSource, metadata) {
    try {
      const { data, error } = await this.client
        .from('operation_metadata')
        .upsert({
          operation_type: 'refresh',
          operation_name: dataSource,
          last_run_at: metadata.lastRefreshedAt || new Date().toISOString(),
          status: metadata.refreshStatus || 'success',
          error: metadata.refreshError || null,
          records_updated: metadata.recordsUpdated || 0,
          metadata: metadata.metadata || {}
        }, {
          onConflict: 'operation_type,operation_name'
        })
        .select()
        .single();

      if (error) {
        // If table doesn't exist, log warning but don't throw (migration may not be run yet)
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.warn('Operation metadata table does not exist yet. Run migration: 20251207000000_create_unified_operation_metadata.sql');
          return null;
        }
        console.error('Supabase error updating refresh metadata:', error);
        throw error;
      }

      // Map back to legacy format
      if (data) {
        return {
          data_source: data.operation_name,
          last_refreshed_at: data.last_run_at,
          refresh_status: data.status,
          refresh_error: data.error,
          records_updated: data.records_updated,
          metadata: data.metadata || {}
        };
      }

      return data;
    } catch (error) {
      // If table doesn't exist, return null instead of throwing
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Operation metadata table does not exist yet. Metadata will not be stored.');
        return null;
      }
      console.error('Error updating refresh metadata:', error);
      throw error;
    }
  }

  /**
   * Set refresh status to in_progress
   * @param {string} dataSource - Data source identifier
   */
  async setRefreshInProgress(dataSource) {
    try {
      await this.client
        .from('operation_metadata')
        .upsert({
          operation_type: 'refresh',
          operation_name: dataSource,
          status: 'in_progress',
          last_run_at: null
        }, {
          onConflict: 'operation_type,operation_name'
        });
    } catch (error) {
      console.error('Error setting refresh in progress:', error);
      // Don't throw - this is not critical
    }
  }
}

// Export singleton instance
export const supabaseDataService = new SupabaseDataService();

