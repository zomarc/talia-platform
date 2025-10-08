/**
 * Focus Management Service
 * Uses InstantDB for persistent storage of focus layouts
 */

import db from '../lib/db';

class FocusService {
  constructor() {
    this.db = db;
  }

  /**
   * Get or create a simple user ID for an email
   * @param {string} email - User email
   * @returns {string} Simple user ID
   */
  async getOrCreateUserId(email) {
    try {
      // For now, create a simple user ID from email
      const userId = `user_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      // Store in InstantDB
      await this.db.transact([
        this.db.tx.users[userId].update({
          email: email,
          userId: userId,
          name: email.split('@')[0], // Use email prefix as name
          role: 'user', // Default role
          createdAt: new Date(),
          lastLogin: new Date()
        })
      ]);

      return userId;
    } catch (error) {
      console.error('Error creating user ID:', error);
      return `user_${Date.now()}`; // Fallback ID
    }
  }

  /**
   * Create a new focus layout (Admin only)
   * @param {Object} focusData - Focus data
   * @param {number} adminTaliaUserId - Admin Talia user ID
   * @returns {Object|null} Created focus or null if error
   */
  async createFocus(focusData, adminTaliaUserId) {
    try {
      console.log(`🆕 Creating focus: ${focusData.name} for admin: ${adminTaliaUserId}`);
      
      const focusId = this.generateFocusId();
      const focus = {
        id: focusId,
        name: focusData.name,
        description: focusData.description || '',
        type: focusData.type || 'standard',
        isStandard: focusData.isStandard || false,
        assignedRoles: focusData.assignedRoles || ['user'],
        isDefault: focusData.isDefault || false,
        isActive: focusData.isActive !== undefined ? focusData.isActive : true,
        createdBy: adminTaliaUserId,
        layoutData: focusData.layoutData || {
          components: [
            { type: 'panel', title: 'Welcome Panel', position: { x: 0, y: 0, width: 12, height: 6 } }
          ]
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      console.log('🆕 Focus data to create:', focus);

      await this.db.transact([
        this.db.tx.focus[focusId].update(focus)
      ]);

      console.log(`✅ Created focus: ${focusData.name} with ID: ${focusId}`);
      return focus;
    } catch (error) {
      console.error('❌ Error creating focus:', error);
      return null;
    }
  }

  /**
   * Update a focus layout (Admin only)
   * @param {string} focusId - Focus ID
   * @param {Object} updateData - Update data
   * @returns {boolean} True if successful
   */
  async updateFocus(focusId, updateData) {
    try {
      console.log(`📝 Updating focus: ${focusId}`);
      
      const update = {
        ...updateData,
        updatedAt: new Date()
      };

      console.log('📝 Update data:', update);

      await this.db.transact([
        this.db.tx.focus[focusId].update(update)
      ]);

      console.log(`✅ Updated focus: ${focusId}`);
      return true;
    } catch (error) {
      console.error('❌ Error updating focus:', error);
      return false;
    }
  }

  /**
   * Get all focuses assigned to a user's role
   * @param {string} userRole - User role
   * @returns {Array} Array of focuses
   */
  async getFocusesForRole(userRole) {
    try {
      console.log(`🔍 Getting focuses for role: ${userRole}`);
      
      // Query focuses from InstantDB
      const result = await this.db.queryOnce({
        focus: {
          $: {
            where: {
              isActive: true
            }
          }
        }
      });

      console.log('🔍 Focus query result:', result);

      const focuses = result.data?.focus || [];
      
      // Filter by assigned roles - user can see focuses assigned to their role or lower
      const roleHierarchy = { 'guest': 0, 'user': 1, 'manager': 2, 'admin': 3 };
      const userRoleLevel = roleHierarchy[userRole] || 0;

      const filteredFocuses = focuses.filter(focus => {
        if (!focus.isActive) return false;
        
        // Check if user's role is in assigned roles
        const hasAccess = focus.assignedRoles?.some(role => {
          const roleLevel = roleHierarchy[role] || 0;
          return userRoleLevel >= roleLevel;
        });
        
        return hasAccess;
      });

      console.log(`✅ Found ${filteredFocuses.length} focuses for role ${userRole}`);
      return filteredFocuses;
    } catch (error) {
      console.error('❌ Error getting focuses:', error);
      return [];
    }
  }

  /**
   * Initialize standard focuses
   * @param {number} adminTaliaUserId - Admin Talia user ID
   * @returns {boolean} True if successful
   */
  async initializeStandardFocuses(adminTaliaUserId) {
    try {
      console.log(`🆕 Initializing standard focuses for admin: ${adminTaliaUserId}`);
      
      const standardFocuses = [
        {
          name: 'Performance Dashboard',
          description: 'Monitor real-time revenue performance',
          type: 'standard',
          isStandard: true,
          assignedRoles: ['user', 'manager', 'admin'],
          isDefault: true,
          isActive: true,
          layoutData: {
            components: [
              { type: 'kpi-cards', title: 'Key Performance Indicators', position: { x: 0, y: 0, width: 6, height: 3 } },
              { type: 'table', title: 'Sailings Table', position: { x: 6, y: 0, width: 6, height: 3 } },
              { type: 'chart', title: 'Occupancy Chart', position: { x: 0, y: 3, width: 12, height: 3 } }
            ]
          }
        },
        {
          name: 'Exception Management',
          description: 'Monitor and manage exceptions',
          type: 'standard',
          isStandard: true,
          assignedRoles: ['manager', 'admin'],
          isDefault: false,
          isActive: true,
          layoutData: {
            components: [
              { type: 'exception-list', title: 'Active Exceptions', position: { x: 0, y: 0, width: 12, height: 6 } }
            ]
          }
        },
        {
          name: 'Inventory Management',
          description: 'Manage cabin inventory and availability',
          type: 'standard',
          isStandard: true,
          assignedRoles: ['manager', 'admin'],
          isDefault: false,
          isActive: true,
          layoutData: {
            components: [
              { type: 'table', title: 'Inventory Overview', position: { x: 0, y: 0, width: 12, height: 6 } }
            ]
          }
        },
        {
          name: 'Talia Set-up',
          description: 'System configuration and administration',
          type: 'standard',
          isStandard: true,
          assignedRoles: ['admin'],
          isDefault: false,
          isActive: true,
          layoutData: {
            components: [
              { type: 'admin-panel', title: 'System Configuration', position: { x: 0, y: 0, width: 12, height: 6 } }
            ]
          }
        }
      ];

      // Create each standard focus
      for (const focusData of standardFocuses) {
        const success = await this.createFocus(focusData, adminTaliaUserId);
        if (!success) {
          console.error(`❌ Failed to create focus: ${focusData.name}`);
        }
      }

      console.log('✅ Standard focuses initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Error initializing standard focuses:', error);
      return false;
    }
  }

  /**
   * Generate unique focus ID (UUID format)
   * @returns {string} Unique focus ID in UUID format
   */
  generateFocusId() {
    // Generate a proper UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// Create and export a singleton instance
const focusService = new FocusService();
export default focusService;