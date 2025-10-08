/**
 * Clean User Management Service
 * 
 * This service implements the clean user management system:
 * 1. One taliaUserId per email address
 * 2. All user data stored by taliaUserId
 * 3. Clean separation between auth (InstantDB) and user data (taliaUserId)
 */

import db from '../lib/db';

class CleanUserService {
  constructor() {
    this.db = db;
    this.nextTaliaUserId = 1000; // Start Talia user IDs from 1000
  }

  /**
   * Get or create a taliaUserId for an email address
   * This is the core function that ensures one taliaUserId per email
   * 
   * @param {string} instantAuthId - InstantDB auth user ID
   * @param {string} email - User email address
   * @returns {Promise<number>} taliaUserId
   */
  async getOrCreateTaliaUserId(instantAuthId, email) {
    try {
      console.log(`🔍 Getting/Creating taliaUserId for email: ${email}`);
      
      // First, check if this email already has a taliaUserId
      const existingMapping = await this.findMappingByEmail(email);
      
      if (existingMapping) {
        console.log(`✅ Found existing taliaUserId ${existingMapping.taliaUserId} for email: ${email}`);
        
        // Update the instantAuthId in case it changed (user logged in from different device)
        if (existingMapping.instantAuthId !== instantAuthId) {
          await this.updateInstantAuthId(existingMapping.id, instantAuthId);
          console.log(`🔄 Updated instantAuthId for existing user ${existingMapping.taliaUserId}`);
        }
        
        return existingMapping.taliaUserId;
      }
      
      // No existing mapping for this email, create new one
      const taliaUserId = await this.generateTaliaUserId();
      
      console.log(`🆕 Creating new taliaUserId ${taliaUserId} for email: ${email}`);
      
      // Create new mapping
      const mappingData = {
        instantAuthId: instantAuthId,
        taliaUserId: taliaUserId,
        email: email,
        createdAt: new Date(),
        lastLogin: new Date()
      };
      
      // Generate UUID for InstantDB entity key
      const entityId = this.generateUUID();
      
      await this.db.transact([
        this.db.tx.userMappings[entityId].update(mappingData)
      ]);
      
      console.log(`✅ Created new mapping: ${email} → taliaUserId ${taliaUserId}`);
      return taliaUserId;
      
    } catch (error) {
      console.error('❌ Error in getOrCreateTaliaUserId:', error);
      throw error;
    }
  }

  /**
   * Find existing mapping by email address
   * @param {string} email - User email
   * @returns {Promise<Object|null>} Mapping object or null
   */
  async findMappingByEmail(email) {
    try {
      const result = await this.db.queryOnce({
        userMappings: {
          $: {
            where: {
              email: email
            }
          }
        }
      });
      
      return result.data?.userMappings?.[0] || null;
    } catch (error) {
      console.error('❌ Error finding mapping by email:', error);
      return null;
    }
  }

  /**
   * Find existing mapping by instantAuthId
   * @param {string} instantAuthId - InstantDB auth ID
   * @returns {Promise<Object|null>} Mapping object or null
   */
  async findMappingByInstantAuthId(instantAuthId) {
    try {
      const result = await this.db.queryOnce({
        userMappings: {
          $: {
            where: {
              instantAuthId: instantAuthId
            }
          }
        }
      });
      
      return result.data?.userMappings?.[0] || null;
    } catch (error) {
      console.error('❌ Error finding mapping by instantAuthId:', error);
      return null;
    }
  }

  /**
   * Update instantAuthId for existing mapping
   * @param {string} mappingId - Mapping entity ID
   * @param {string} newInstantAuthId - New InstantDB auth ID
   */
  async updateInstantAuthId(mappingId, newInstantAuthId) {
    try {
      await this.db.transact([
        this.db.tx.userMappings[mappingId].update({
          instantAuthId: newInstantAuthId,
          lastLogin: new Date()
        })
      ]);
    } catch (error) {
      console.error('❌ Error updating instantAuthId:', error);
      throw error;
    }
  }

  /**
   * Generate next taliaUserId
   * @returns {Promise<number>} Next taliaUserId
   */
  async generateTaliaUserId() {
    // For now, use simple increment
    // In production, this would query the database for the highest existing ID
    return this.nextTaliaUserId++;
  }

  /**
   * Generate UUID for InstantDB entity keys
   * @returns {string} UUID
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Get user data by taliaUserId
   * @param {number} taliaUserId - Talia user ID
   * @returns {Promise<Object|null>} User data or null
   */
  async getUserByTaliaId(taliaUserId) {
    try {
      const result = await this.db.queryOnce({
        userMappings: {
          $: {
            where: {
              taliaUserId: taliaUserId
            }
          }
        }
      });
      
      return result.data?.userMappings?.[0] || null;
    } catch (error) {
      console.error('❌ Error getting user by taliaUserId:', error);
      return null;
    }
  }

  /**
   * Update user last login time
   * @param {number} taliaUserId - Talia user ID
   */
  async updateLastLogin(taliaUserId) {
    try {
      const mapping = await this.getUserByTaliaId(taliaUserId);
      if (mapping) {
        await this.db.transact([
          this.db.tx.userMappings[mapping.id].update({
            lastLogin: new Date()
          })
        ]);
      }
    } catch (error) {
      console.error('❌ Error updating last login:', error);
    }
  }

  /**
   * Get all user mappings (for admin purposes)
   * @returns {Promise<Array>} Array of all user mappings
   */
  async getAllUserMappings() {
    try {
      const result = await this.db.queryOnce({
        userMappings: {}
      });
      
      return result.data?.userMappings || [];
    } catch (error) {
      console.error('❌ Error getting all user mappings:', error);
      return [];
    }
  }
}

// Create and export singleton instance
const cleanUserService = new CleanUserService();
export default cleanUserService;
