/**
 * TaliaUserService - Supabase-based service
 * Fetches Talia users from Supabase database
 */

import { supabase } from '../lib/supabase';

class TaliaUserService {
  constructor() {
    this.users = [];
  }

  async getAllTaliaUsers() {
    try {
      console.log('🔍 Fetching Talia users from Supabase...');
      
      const { data, error } = await supabase
        .from('talia_users')
        .select('*')
        .order('talia_user_id', { ascending: true });

      if (error) {
        console.error('❌ Error fetching Talia users:', error);
        return [];
      }

      console.log(`✅ Found ${data?.length || 0} Talia users`);
      
      // Map Supabase data to expected format
      return (data || []).map(user => ({
        taliaUserId: user.talia_user_id,
        email: user.email,
        name: user.email?.split('@')[0] || 'Unknown',
        taliaRole: this.determineRoleFromEmail(user.email),
        isActive: true,
        createdAt: user.created_at || user.last_login_at,
        id: user.id
      }));
    } catch (error) {
      console.error('❌ Error in getAllTaliaUsers:', error);
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
      
      // Find user by talia_user_id
      const { data: users, error: fetchError } = await supabase
        .from('talia_users')
        .select('*')
        .eq('talia_user_id', taliaUserId)
        .single();

      if (fetchError || !users) {
        console.error('❌ User not found:', fetchError);
        return [];
      }

      // Note: We don't have a role column in talia_users table yet
      // For now, we'll just log the update
      // TODO: Add role column to talia_users table or use a separate user_roles table
      console.warn('⚠️ Role update not persisted - talia_users table does not have role column');
      
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

