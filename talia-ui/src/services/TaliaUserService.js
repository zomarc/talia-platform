/**
 * TaliaUserService - Supabase-based service
 * Fetches Talia users from Supabase database
 */

import { supabase } from '../lib/supabase';

class TaliaUserService {
  constructor() {
    this.users = [];
    this.isDevMode = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_MODE === 'true';
  }
  
  /**
   * Check if a user is a local/mock user (development only)
   * @param {Object} user - User object to check
   * @returns {boolean} - True if user is local/mock
   */
  isLocalUser(user) {
    if (!user) return false;
    return user.id === 'dev-user-1' || user.id?.startsWith('dev-user-') || user.email === 'dev@talia.local';
  }
  
  /**
   * Get local mock user data
   * @returns {Object} - Mock user object
   */
  getLocalUser() {
    const savedRole = localStorage.getItem('devUserRole') || 'ADMIN';
    return {
      id: 'dev-user-1',
      taliaUserId: 1000,
      email: 'dev@talia.local',
      name: 'Dev User',
      taliaRole: savedRole.toLowerCase(),
      isActive: true,
      createdAt: new Date().toISOString()
    };
  }

  async getAllTaliaUsers() {
    try {
      // In dev mode, include local user if using mock authentication
      const localUser = this.isDevMode ? this.getLocalUser() : null;
      const users = localUser ? [localUser] : [];
      
      console.log('🔍 Fetching Talia users from Supabase...');
      
      const { data, error } = await supabase
        .from('talia_users')
        .select('*')
        .order('talia_user_id', { ascending: true });

      if (error) {
        console.error('❌ Error fetching Talia users:', error);
        // In dev mode, return local user even if database query fails
        if (this.isDevMode && localUser) {
          console.log('🔧 Dev mode: Returning local user due to database error');
          return users;
        }
        return [];
      }

      console.log(`✅ Found ${data?.length || 0} Talia users`);
      
      // Map Supabase data to expected format
      const dbUsers = (data || []).map(user => ({
        taliaUserId: user.talia_user_id,
        email: user.email,
        name: user.email?.split('@')[0] || 'Unknown',
        taliaRole: this.determineRoleFromEmail(user.email),
        isActive: true,
        createdAt: user.created_at || user.last_login_at,
        id: user.id
      }));
      
      // Combine local user with database users (avoid duplicates)
      const allUsers = [...users];
      for (const dbUser of dbUsers) {
        if (!this.isLocalUser(dbUser)) {
          allUsers.push(dbUser);
        }
      }
      
      return allUsers;
    } catch (error) {
      console.error('❌ Error in getAllTaliaUsers:', error);
      // In dev mode, return local user even if there's an error
      if (this.isDevMode) {
        const localUser = this.getLocalUser();
        console.log('🔧 Dev mode: Returning local user due to error');
        return [localUser];
      }
      return [];
    }
  }

  determineRoleFromEmail(email) {
    // Determine role based on email (admin@talia.dev = admin)
    if (email === 'admin@talia.dev') {
      return 'admin';
    }
    return 'user'; // Default role
  }

  async updateTaliaUserRole(taliaUserId, newRole) {
    try {
      console.log(`🔄 Updating user ${taliaUserId} role to ${newRole}`);
      
      // Check if this is a local user
      const localUser = this.getLocalUser();
      if (localUser && localUser.taliaUserId === taliaUserId) {
        // Update local user role in localStorage
        localStorage.setItem('devUserRole', newRole.toUpperCase());
        console.log('✅ Local user role updated in localStorage');
        return await this.getAllTaliaUsers();
      }
      
      // For database users, find by talia_user_id
      const { data: users, error: fetchError } = await supabase
        .from('talia_users')
        .select('*')
        .eq('talia_user_id', taliaUserId)
        .single();

      if (fetchError || !users) {
        console.error('❌ User not found:', fetchError);
        return [];
      }

      // Roles are managed in-memory/application-level, not stored in database
      // This allows easy testing and will be preserved for future SSO integration
      console.log('✅ Role update applied in-memory (roles managed at application level)');
      
      return await this.getAllTaliaUsers();
    } catch (error) {
      console.error('❌ Error updating user role:', error);
      return [];
    }
  }

  async getAllUsers() {
    return await this.getAllTaliaUsers();
  }

  async getUserById(id) {
    try {
      const { data, error } = await supabase
        .from('talia_users')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        taliaUserId: data.talia_user_id,
        email: data.email,
        name: data.email?.split('@')[0] || 'Unknown',
        taliaRole: this.determineRoleFromEmail(data.email),
        isActive: true,
        createdAt: data.created_at,
        id: data.id
      };
    } catch (error) {
      console.error('❌ Error getting user by ID:', error);
      return null;
    }
  }

  async createUser(userData) {
    try {
      // Get max talia_user_id
      const { data: maxUser } = await supabase
        .from('talia_users')
        .select('talia_user_id')
        .order('talia_user_id', { ascending: false })
        .limit(1)
        .maybeSingle();

      const taliaUserId = maxUser?.talia_user_id ? maxUser.talia_user_id + 1 : 1000;

      const { data, error } = await supabase
        .from('talia_users')
        .insert({
          talia_user_id: taliaUserId,
          email: userData.email,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating user:', error);
        return null;
      }

      return {
        taliaUserId: data.talia_user_id,
        email: data.email,
        name: data.email?.split('@')[0] || 'Unknown',
        taliaRole: this.determineRoleFromEmail(data.email),
        isActive: true,
        createdAt: data.created_at,
        id: data.id
      };
    } catch (error) {
      console.error('❌ Error creating user:', error);
      return null;
    }
  }

  async updateUser(id, userData) {
    try {
      const { data, error } = await supabase
        .from('talia_users')
        .update({
          email: userData.email,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating user:', error);
        return null;
      }

      return {
        taliaUserId: data.talia_user_id,
        email: data.email,
        name: data.email?.split('@')[0] || 'Unknown',
        taliaRole: this.determineRoleFromEmail(data.email),
        isActive: true,
        createdAt: data.created_at,
        id: data.id
      };
    } catch (error) {
      console.error('❌ Error updating user:', error);
      return null;
    }
  }

  async deleteUser(id) {
    try {
      const { error } = await supabase
        .from('talia_users')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Error deleting user:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Error deleting user:', error);
      return false;
    }
  }
}

const taliaUserService = new TaliaUserService();
export default taliaUserService;

