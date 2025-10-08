/**
 * Talia User Service
 * Manages Talia internal user system with numerical IDs
 */

class TaliaUserService {
  constructor() {
    // For now, just manage users in memory since we don't have proper querying
    this.users = new Map(); // taliaUserId -> user object
  }

  /**
   * Create a new Talia user
   * @param {number} taliaUserId - Talia user ID
   * @param {string} email - User email
   * @param {string} role - User role
   * @returns {Object} Created Talia user
   */
  createTaliaUser(taliaUserId, email, role = 'user') {
    const taliaUser = {
      taliaUserId: taliaUserId,
      email: email,
      name: email.split('@')[0], // Use email prefix as name
      taliaRole: role,
      isActive: true,
      createdAt: new Date()
    };

    this.users.set(taliaUserId, taliaUser);
    console.log(`✅ Created Talia user: ${taliaUserId} (${email}) with role: ${role}`);
    
    return taliaUser;
  }

  /**
   * Get Talia user by Talia user ID
   * @param {number} taliaUserId - Talia user ID
   * @returns {Object|null} Talia user or null if not found
   */
  getTaliaUserById(taliaUserId) {
    return this.users.get(taliaUserId) || null;
  }

  /**
   * Update Talia user role
   * @param {number} taliaUserId - Talia user ID
   * @param {string} newRole - New role
   * @returns {boolean} Success status
   */
  updateTaliaUserRole(taliaUserId, newRole) {
    const user = this.users.get(taliaUserId);
    if (user) {
      user.taliaRole = newRole;
      console.log(`✅ Updated Talia user ${taliaUserId} role to: ${newRole}`);
      return true;
    }
    return false;
  }

  /**
   * Get all Talia users
   * @returns {Array} Array of Talia users
   */
  getAllTaliaUsers() {
    return Array.from(this.users.values());
  }

  /**
   * Check if user has admin role
   * @param {number} taliaUserId - Talia user ID
   * @returns {boolean} True if user is admin
   */
  isAdmin(taliaUserId) {
    const user = this.users.get(taliaUserId);
    return user && user.taliaRole === 'admin';
  }

  /**
   * Check if user has manager role or higher
   * @param {number} taliaUserId - Talia user ID
   * @returns {boolean} True if user is manager or admin
   */
  isManagerOrAdmin(taliaUserId) {
    const user = this.users.get(taliaUserId);
    return user && (user.taliaRole === 'manager' || user.taliaRole === 'admin');
  }
}

// Create and export a singleton instance
const taliaUserService = new TaliaUserService();
export default taliaUserService;