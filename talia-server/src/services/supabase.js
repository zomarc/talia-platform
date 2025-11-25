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

  // Get focuses data
  async getFocuses(filters = {}) {
    try {
      let queryBuilder = this.client.from('focuses').select('*');
      
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
        console.error('Supabase query error for focuses:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error querying focuses:', error);
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
}

// Export singleton instance
export const supabaseDataService = new SupabaseDataService();

