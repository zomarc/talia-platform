/**
 * Simple User Mapping Service
 * One taliaUserId ↔ One instantAuthId
 */

import db from '../lib/db';

class UserMappingService {
  constructor() {
    this.db = db;
    this.nextTaliaUserId = 1000;
  }

  /**
   * Get or create taliaUserId for instantAuthId
   * @param {string} instantAuthId - InstantDB auth ID
   * @returns {number|null} taliaUserId or null if error
   */
  async getOrCreateMapping(instantAuthId) {
    try {
      console.log(`🔍 Looking for existing mapping for instantAuthId: ${instantAuthId}`);
      
      // Check if mapping exists
      const result = await this.db.queryOnce({
        taliaUser: {
          $: {
            where: {
              instantAuthId: instantAuthId
            }
          }
        }
      });

      console.log('🔍 Query result:', result);

      // If exists, return existing taliaUserId
      if (result.data?.taliaUser && result.data.taliaUser.length > 0) {
        const existing = result.data.taliaUser[0];
        console.log(`✅ Found existing mapping: ${instantAuthId} → ${existing.taliaUserId}`);
        return existing.taliaUserId;
      }

      // Create new mapping
      const taliaUserId = this.nextTaliaUserId++;
      
      console.log(`🆕 Creating new mapping: ${instantAuthId} → ${taliaUserId}`);
      
      // Use taliaUserId as the entity key - Talia only uses taliaUserID
      await this.db.transact([
        this.db.tx.taliaUser[taliaUserId].update({
          taliaUserId: taliaUserId,
          instantAuthId: instantAuthId
        })
      ]);

      console.log(`✅ Created new mapping: ${instantAuthId} → ${taliaUserId}`);
      return taliaUserId;
    } catch (error) {
      console.error('❌ Error in getOrCreateMapping:', error);
      return null;
    }
  }
}

// Export singleton
const userMappingService = new UserMappingService();
export default userMappingService;