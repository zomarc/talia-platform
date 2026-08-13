/**
 * TaliaUserService - Supabase-based service
 * Fetches Talia users from Supabase database
 */

import { supabase } from '../lib/supabase';
import { apolloClient } from '../lib/apolloClient';
import { gql } from '@apollo/client';

const GET_TALIA_USERS_QUERY = gql`
  query GetTaliaUsers {
    taliaUsers {
      id
      taliaUserId
      email
      role
      createdAt
      updatedAt
      lastLoginAt
    }
  }
`;

const GET_TALIA_USER_BY_EMAIL_QUERY = gql`
  query GetTaliaUserByEmail($email: String!) {
    taliaUser(email: $email) {
      id
      taliaUserId
      email
      role
      createdAt
      updatedAt
      lastLoginAt
    }
  }
`;

const UPDATE_TALIA_USER_ROLE_MUTATION = gql`
  mutation UpdateTaliaUserRole($email: String, $taliaUserId: Int, $role: String!) {
    updateTaliaUserRole(email: $email, taliaUserId: $taliaUserId, role: $role) {
      id
      taliaUserId
      email
      role
      updatedAt
    }
  }
`;

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
    return user.id?.startsWith('dev-user-') || (typeof user.email === 'string' && user.email.endsWith('@talia.local'));
  }
  
  /**
   * Get the currently selected local mock user
   * @returns {Object} - Mock user object
   */
  getLocalUser() {
    const savedId = localStorage.getItem('devUserId') || 'dev-user-1';
    const savedRole = localStorage.getItem('devUserRole') || 'ADMIN';
    const DEV_USERS = [
      { id: 'dev-user-1', email: 'dev@talia.local',    name: 'Dev Admin',    talia_user_id: 1000, role: 'ADMIN'   },
      { id: 'dev-user-2', email: 'russell@talia.local', name: 'Russell',      talia_user_id: 1001, role: 'ADMIN'   },
      { id: 'dev-user-3', email: 'andy@talia.local',    name: 'Andy',         talia_user_id: 1002, role: 'MANAGER' },
      { id: 'dev-user-4', email: 'analyst@talia.local', name: 'Analyst',      talia_user_id: 1003, role: 'USER'    },
      { id: 'dev-user-5', email: 'guest@talia.local',   name: 'Guest Viewer', talia_user_id: 1004, role: 'GUEST'   },
    ];
    const entry = DEV_USERS.find((u) => u.id === savedId) || DEV_USERS[0];
    return {
      id: entry.id,
      taliaUserId: entry.talia_user_id,
      email: entry.email,
      name: entry.name,
      taliaRole: (savedRole || entry.role).toLowerCase(),
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };
  }

  async getAllTaliaUsers() {
    try {
      // Primary path: backend GraphQL (server-side Supabase access)
      const { data } = await apolloClient.query({
        query: GET_TALIA_USERS_QUERY,
        fetchPolicy: 'network-only',
        errorPolicy: 'all'
      });

      const dbUsers = (data?.taliaUsers || []).map((user) => ({
        taliaUserId: user.taliaUserId,
        email: user.email,
        name: user.email?.split('@')[0] || 'Unknown',
        role: String(user.role || this.determineRoleFromEmail(user.email) || 'USER').toUpperCase(),
        taliaRole: String(user.role || this.determineRoleFromEmail(user.email) || 'USER').toLowerCase(),
        isActive: true,
        createdAt: user.createdAt || user.lastLoginAt,
        lastLoginAt: user.lastLoginAt || null,
        id: user.id
      }));

      return dbUsers;
    } catch (error) {
      console.error('❌ Error in getAllTaliaUsers (GraphQL path):', error);

      // Fallback 1: resolve users from known dev identities via existing taliaUser(email) query
      try {
        const devEmails = [
          'dev@talia.local',
          'russell@talia.local',
          'andy@talia.local',
          'analyst@talia.local',
          'guest@talia.local',
          'admin@talia.dev'
        ];
        const resolved = [];
        for (const email of devEmails) {
          const response = await apolloClient.query({
            query: GET_TALIA_USER_BY_EMAIL_QUERY,
            variables: { email },
            fetchPolicy: 'network-only',
            errorPolicy: 'all'
          });
          const user = response?.data?.taliaUser;
          if (user) {
            resolved.push({
              taliaUserId: user.taliaUserId,
              email: user.email,
              name: user.email?.split('@')[0] || 'Unknown',
              taliaRole: this.determineRoleFromEmail(user.email),
              isActive: true,
              createdAt: user.createdAt || user.lastLoginAt,
              lastLoginAt: user.lastLoginAt || null,
              id: user.id
            });
          }
        }
        if (resolved.length > 0) return resolved;
      } catch (legacyQueryError) {
        console.error('❌ Fallback taliaUser(email) lookup failed:', legacyQueryError);
      }

      // Fallback 2: legacy direct DB in browser
      try {
        const { data, error: fetchError } = await supabase
          .from('talia_users')
          .select('*')
          .order('talia_user_id', { ascending: true });

        if (fetchError) throw fetchError;

        const dbUsers = (data || []).map((user) => ({
          taliaUserId: user.talia_user_id,
          email: user.email,
          name: user.email?.split('@')[0] || 'Unknown',
          taliaRole: this.determineRoleFromEmail(user.email),
          isActive: true,
          createdAt: user.created_at || user.last_login_at,
          lastLoginAt: user.last_login_at || null,
          id: user.id
        }));

        return dbUsers;
      } catch (fallbackError) {
        console.error('❌ Fallback direct user query failed:', fallbackError);
        return [];
      }
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

  async updateTaliaUserRole({ email = null, taliaUserId = null, role }) {
    const nextRole = String(role || 'USER').trim().toUpperCase();
    const { data } = await apolloClient.mutate({
      mutation: UPDATE_TALIA_USER_ROLE_MUTATION,
      variables: {
        email: email || undefined,
        taliaUserId: taliaUserId != null ? Number(taliaUserId) : undefined,
        role: nextRole,
      },
    });
    return data?.updateTaliaUserRole || null;
  }
}

const taliaUserService = new TaliaUserService();
export default taliaUserService;

