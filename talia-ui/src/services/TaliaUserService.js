/**
 * TaliaUserService - Stub service
 * Provides a mock interface for TaliaUserService during database restoration
 */

class TaliaUserService {
  constructor() {
    this.users = [];
  }

  getAllTaliaUsers() {
    // Return empty array during database restoration
    console.warn('TaliaUserService: Database not available, returning empty user list');
    return [];
  }

  updateTaliaUserRole(taliaUserId, newRole) {
    console.warn('TaliaUserService: Database not available, cannot update user role');
    // Return empty array to match expected interface
    return [];
  }

  async getAllUsers() {
    return this.getAllTaliaUsers();
  }

  async getUserById(id) {
    console.warn('TaliaUserService: Database not available, returning null');
    return null;
  }

  async createUser(userData) {
    console.warn('TaliaUserService: Database not available, cannot create user');
    return null;
  }

  async updateUser(id, userData) {
    console.warn('TaliaUserService: Database not available, cannot update user');
    return null;
  }

  async deleteUser(id) {
    console.warn('TaliaUserService: Database not available, cannot delete user');
    return false;
  }
}

const taliaUserService = new TaliaUserService();
export default taliaUserService;

