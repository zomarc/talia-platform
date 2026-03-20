import { sampleData } from '../schema.js';
import { supabaseDataService } from '../../services/supabase.js';

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
      if (!taliaUser) return null;

      return {
        id: taliaUser.id,
        taliaUserId: taliaUser.talia_user_id,
        email: taliaUser.email,
        createdAt: taliaUser.created_at,
        updatedAt: taliaUser.updated_at,
        lastLoginAt: taliaUser.last_login_at
      };
    } catch (error: any) {
      console.error('Error fetching talia user:', error);
      throw new Error(`Failed to fetch talia user: ${error.message}`);
    }
  },

  taliaUsers: async () => {
    try {
      const rows = await supabaseDataService.getAllTaliaUsers();
      return (rows || []).map((row: any) => ({
        id: row.id,
        taliaUserId: row.talia_user_id,
        email: row.email,
        createdAt: row.created_at,
        updatedAt: row.updated_at || row.created_at,
        lastLoginAt: row.last_login_at || null
      }));
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
};
