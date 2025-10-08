/**
 * Talia Focus Management Service
 * Handles Talia's internal focus system with component layouts
 */

import db from '../lib/db';

// Generate a simple UUID (v4)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

class TaliaFocusService {
  constructor() {
    this.db = db;
    this.nextTaliaFocusId = 100; // Start Talia focus IDs from 100
  }

  /**
   * Create a new Talia focus (admin only)
   * @param {Object} focusData - Focus data
   * @param {number} adminTaliaUserId - Admin's Talia user ID
   * @returns {Object|null} Created focus or null if error
   */
  async createTaliaFocus(focusData, adminTaliaUserId) {
    try {
      const taliaFocusId = await this.generateTaliaFocusId();
      const taliaFocus = {
        taliaFocusId: taliaFocusId,
        name: focusData.name,
        description: focusData.description || '',
        type: focusData.type || 'standard',
        createdByTaliaUserId: adminTaliaUserId,
        assignedRoles: focusData.assignedRoles || ['user'], // Default to 'user' role
        componentLayout: focusData.componentLayout || {
          components: [
            { 
              type: 'panel', 
              title: 'Welcome Panel', 
              position: { x: 0, y: 0, width: 12, height: 6 },
              componentType: 'welcome'
            }
          ]
        },
        isDefault: focusData.isDefault || false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const entityId = generateUUID(); // Generate UUID for InstantDB entity key
      await this.db.transact([
        this.db.tx.taliaFocuses[entityId].update(taliaFocus)
      ]);

      return taliaFocus;
    } catch (error) {
      console.error('Error creating Talia focus:', error);
      return null;
    }
  }

  /**
   * Update a Talia focus (admin only)
   * @param {number} taliaFocusId - Talia focus ID
   * @param {Object} updateData - Update data
   * @returns {boolean} Success status
   */
  async updateTaliaFocus(taliaFocusId, updateData) {
    try {
      // For now, just return true since we don't have proper querying implemented
      // TODO: Implement proper querying to find focus by taliaFocusId and update
      return true;
    } catch (error) {
      console.error('Error updating Talia focus:', error);
      return false;
    }
  }

  /**
   * Delete a Talia focus (admin only)
   * @param {number} taliaFocusId - Talia focus ID
   * @returns {boolean} Success status
   */
  async deleteTaliaFocus(taliaFocusId) {
    try {
      // For now, just return true since we don't have proper querying implemented
      // TODO: Implement proper querying to find focus by taliaFocusId and delete
      return true;
    } catch (error) {
      console.error('Error deleting Talia focus:', error);
      return false;
    }
  }

  /**
   * Get all Talia focuses for a user's role
   * @param {string} userRole - User's Talia role
   * @returns {Array} Array of Talia focuses
   */
  async getTaliaFocusesForRole(userRole) {
    try {
      // For now, return hardcoded focuses until we implement proper querying
      const standardTaliaFocuses = [
        {
          taliaFocusId: 100,
          name: 'Performance Dashboard',
          description: 'Monitor real-time revenue performance',
          type: 'standard',
          assignedRoles: ['user', 'manager', 'admin'],
          isDefault: true,
          isActive: true,
          componentLayout: {
            components: [
              { 
                type: 'kpi-cards', 
                title: 'Key Performance Indicators',
                position: { x: 0, y: 0, width: 6, height: 3 },
                componentType: 'kpi'
              },
              { 
                type: 'table', 
                title: 'Sailings Table',
                position: { x: 6, y: 0, width: 6, height: 3 },
                componentType: 'sailings'
              },
              { 
                type: 'chart', 
                title: 'Occupancy Chart',
                position: { x: 0, y: 3, width: 12, height: 3 },
                componentType: 'occupancy'
              }
            ]
          }
        },
        {
          taliaFocusId: 101,
          name: 'Exception Management',
          description: 'Monitor and manage exceptions',
          type: 'standard',
          assignedRoles: ['manager', 'admin'],
          isDefault: false,
          isActive: true,
          componentLayout: {
            components: [
              { 
                type: 'exception-list', 
                title: 'Active Exceptions',
                position: { x: 0, y: 0, width: 12, height: 6 },
                componentType: 'exceptions'
              }
            ]
          }
        },
        {
          taliaFocusId: 102,
          name: 'Inventory Management',
          description: 'Manage cabin inventory and availability',
          type: 'standard',
          assignedRoles: ['manager', 'admin'],
          isDefault: false,
          isActive: true,
          componentLayout: {
            components: [
              { 
                type: 'table', 
                title: 'Inventory Overview',
                position: { x: 0, y: 0, width: 12, height: 6 },
                componentType: 'inventory'
              }
            ]
          }
        },
        {
          taliaFocusId: 103,
          name: 'Talia Set-up',
          description: 'System configuration and administration',
          type: 'standard',
          assignedRoles: ['admin'],
          isDefault: false,
          isActive: true,
          componentLayout: {
            components: [
              { 
                type: 'admin-panel', 
                title: 'System Configuration',
                position: { x: 0, y: 0, width: 12, height: 6 },
                componentType: 'admin'
              }
            ]
          }
        }
      ];

      // Filter by assigned roles - user can see focuses assigned to their role or lower
      const roleHierarchy = { 'guest': 0, 'user': 1, 'manager': 2, 'admin': 3 };
      const userRoleLevel = roleHierarchy[userRole] || 0;

      return standardTaliaFocuses.filter(focus => {
        if (!focus.isActive) return false;
        
        // Check if user's role is in assigned roles
        const hasAccess = focus.assignedRoles.some(role => {
          const roleLevel = roleHierarchy[role] || 0;
          return userRoleLevel >= roleLevel;
        });
        
        return hasAccess;
      });
    } catch (error) {
      console.error('Error getting Talia focuses:', error);
      return [];
    }
  }

  /**
   * Get a specific Talia focus by ID
   * @param {number} taliaFocusId - Talia focus ID
   * @returns {Object|null} Talia focus or null
   */
  async getTaliaFocusById(taliaFocusId) {
    try {
      // For now, return from hardcoded list
      const focuses = await this.getTaliaFocusesForRole('admin'); // Get all focuses
      return focuses.find(f => f.taliaFocusId === taliaFocusId) || null;
    } catch (error) {
      console.error('Error getting Talia focus:', error);
      return null;
    }
  }

  /**
   * Generate next Talia focus ID
   * @returns {number} Next Talia focus ID
   */
  async generateTaliaFocusId() {
    // For now, use simple increment - in production, this would be more sophisticated
    return this.nextTaliaFocusId++;
  }

  /**
   * Initialize standard Talia focuses (admin only)
   * @param {number} adminTaliaUserId - Admin's Talia user ID
   * @returns {boolean} Success status
   */
  async initializeStandardTaliaFocuses(adminTaliaUserId) {
    try {
      const standardFocuses = [
        {
          name: 'Performance Dashboard',
          description: 'Monitor real-time revenue performance',
          type: 'standard',
          assignedRoles: ['user', 'manager', 'admin'],
          isDefault: true,
          componentLayout: {
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
          assignedRoles: ['manager', 'admin'],
          componentLayout: {
            components: [
              { type: 'exception-list', title: 'Active Exceptions', position: { x: 0, y: 0, width: 12, height: 6 } }
            ]
          }
        },
        {
          name: 'Inventory Management',
          description: 'Manage cabin inventory and availability',
          type: 'standard',
          assignedRoles: ['manager', 'admin'],
          componentLayout: {
            components: [
              { type: 'table', title: 'Inventory Overview', position: { x: 0, y: 0, width: 12, height: 6 } }
            ]
          }
        }
      ];

      // Create each standard focus
      for (const focusData of standardFocuses) {
        await this.createTaliaFocus(focusData, adminTaliaUserId);
      }

      return true;
    } catch (error) {
      console.error('Error initializing standard Talia focuses:', error);
      return false;
    }
  }
}

// Create and export a singleton instance
const taliaFocusService = new TaliaFocusService();
export default taliaFocusService;
