import { sampleData } from '../schema.js';
import { supabaseDataService } from '../../services/supabase.js';

const ALLOWED_ROLES = new Set(['GUEST', 'USER', 'MANAGER', 'ADMIN', 'SUPER_USER', 'SUPERUSER']);

const normalizeStoredRole = (role) => {
  const normalized = String(role || 'USER').trim().toUpperCase();
  if (normalized === 'SUPERUSER') return 'SUPER_USER';
  return ALLOWED_ROLES.has(normalized) ? normalized : 'USER';
};

const mapTaliaUser = (taliaUser) => {
  if (!taliaUser) return null;
  return {
    id: taliaUser.id,
    taliaUserId: taliaUser.talia_user_id,
    email: taliaUser.email,
    role: normalizeStoredRole(taliaUser.role),
    createdAt: taliaUser.created_at,
    updatedAt: taliaUser.updated_at || taliaUser.created_at,
    lastLoginAt: taliaUser.last_login_at || null,
  };
};

export const userQueryResolvers = {
  me: () => {
    // In a real app, this would get the current user from the context
    return sampleData.users[0]; // Return admin user for demo
  },

  users: () => sampleData.users,

  taliaUser: async (_parent: any, args: any) => {
    const { email } = args;
    try {
      const taliaUser = await supabaseDataService.getTaliaUserByEmail(email);
      return mapTaliaUser(taliaUser);
    } catch (error: any) {
      console.error('Error fetching talia user:', error);
      throw new Error(`Failed to fetch talia user: ${error.message}`);
    }
  },

  taliaUsers: async () => {
    try {
      const rows = await supabaseDataService.getAllTaliaUsers();
      return (rows || []).map(mapTaliaUser).filter(Boolean);
    } catch (error) {
      console.error('Error fetching talia users:', error);
      return [];
    }
  },
};

export const userMutationResolvers = {
  updateUserPreferences: (_parent: any, args: any) => {
    const { input } = args;
    const userIndex = 0; // In real app, get current user index

    sampleData.users[userIndex].preferences = {
      ...sampleData.users[userIndex].preferences,
      ...input
    };
    sampleData.users[userIndex].updatedAt = new Date().toISOString();

    return sampleData.users[userIndex];
  },

  updateTaliaUserRole: async (_parent: any, args: any, context: any) => {
    const requesterRole = normalizeStoredRole(context?.user?.role || context?.role);
    const isPrivileged = requesterRole === 'ADMIN'
      || requesterRole === 'SUPER_USER'
      || requesterRole === 'SUPERUSER';
    if (!isPrivileged) {
      throw new Error('Only Admin or Super User can assign Talia user roles');
    }

    const nextRole = normalizeStoredRole(args?.role);
    try {
      let updated = null;
      if (args?.taliaUserId != null && Number.isFinite(Number(args.taliaUserId))) {
        updated = await supabaseDataService.updateTaliaUserRoleByTaliaId(Number(args.taliaUserId), nextRole);
      } else if (args?.email) {
        updated = await supabaseDataService.updateTaliaUserRoleByEmail(String(args.email), nextRole);
      } else {
        throw new Error('email or taliaUserId is required');
      }
      if (!updated) {
        throw new Error('Talia user not found');
      }
      return mapTaliaUser(updated);
    } catch (error: any) {
      console.error('Error updating talia user role:', error);
      throw new Error(`Failed to update talia user role: ${error.message}`);
    }
  },
};
