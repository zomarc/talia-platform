/**
 * Service for fetching and managing target profile data
 * Provides CRUD operations for target profiles stored in Supabase
 */

import { apolloClient } from '../../lib/apolloClient';
import { gql } from '@apollo/client';

// GraphQL query for fetching all target profiles
const GET_TARGET_PROFILES = gql`
  query GetTargetProfiles($filters: TargetProfileFilters) {
    targetProfiles(filters: $filters) {
      id
      name
      description
      sailCode
      shipCode
      packageType
      seasonCode
      geogAreaCode
      buildCurves {
        weekLabel
        weeksUntilSailing
        targetBookings
        targetGuests
      }
      basedOnHistoric
      createdBy
      createdAt
      updatedAt
      isActive
    }
  }
`;

// GraphQL query for fetching single target profile
const GET_TARGET_PROFILE = gql`
  query GetTargetProfile($id: ID!) {
    targetProfile(id: $id) {
      id
      name
      description
      sailCode
      shipCode
      packageType
      seasonCode
      geogAreaCode
      buildCurves {
        weekLabel
        weeksUntilSailing
        targetBookings
        targetGuests
      }
      basedOnHistoric
      createdBy
      createdAt
      updatedAt
      isActive
    }
  }
`;

// GraphQL mutation for creating target profile
const CREATE_TARGET_PROFILE = gql`
  mutation CreateTargetProfile($input: TargetProfileInput!) {
    createTargetProfile(input: $input) {
      id
      name
      description
      sailCode
      shipCode
      packageType
      seasonCode
      geogAreaCode
      buildCurves {
        weekLabel
        weeksUntilSailing
        targetBookings
        targetGuests
      }
      basedOnHistoric
      createdBy
      createdAt
      updatedAt
      isActive
    }
  }
`;

// GraphQL mutation for updating target profile
const UPDATE_TARGET_PROFILE = gql`
  mutation UpdateTargetProfile($id: ID!, $input: TargetProfileInput!) {
    updateTargetProfile(id: $id, input: $input) {
      id
      name
      description
      sailCode
      shipCode
      packageType
      seasonCode
      geogAreaCode
      buildCurves {
        weekLabel
        weeksUntilSailing
        targetBookings
        targetGuests
      }
      basedOnHistoric
      createdBy
      createdAt
      updatedAt
      isActive
    }
  }
`;

// GraphQL mutation for deleting target profile
const DELETE_TARGET_PROFILE = gql`
  mutation DeleteTargetProfile($id: ID!) {
    deleteTargetProfile(id: $id)
  }
`;

class TargetProfileService {
  /**
   * Fetch all target profiles with optional filters
   * @param {Object} filters - Filter options { sailCode, shipCode, packageType, seasonCode, isActive }
   * @returns {Promise<Array>} Array of target profiles
   */
  async fetchAll(filters = {}) {
    try {
      const { data } = await apolloClient.query({
        query: GET_TARGET_PROFILES,
        variables: { filters },
        fetchPolicy: 'cache-and-network'
      });

      return data.targetProfiles || [];
    } catch (error) {
      console.error('[TargetProfileService] Error fetching target profiles:', error);
      throw error;
    }
  }

  /**
   * Fetch single target profile by ID
   * @param {string} id - Target profile ID
   * @returns {Promise<Object>} Target profile
   */
  async fetchById(id) {
    if (!id) {
      throw new Error('Target profile ID is required');
    }

    try {
      const { data } = await apolloClient.query({
        query: GET_TARGET_PROFILE,
        variables: { id },
        fetchPolicy: 'cache-and-network'
      });

      if (!data || !data.targetProfile) {
        throw new Error('Target profile not found');
      }

      return data.targetProfile;
    } catch (error) {
      console.error('[TargetProfileService] Error fetching target profile:', error);
      throw error;
    }
  }

  /**
   * Create new target profile
   * @param {Object} input - Target profile input
   * @returns {Promise<Object>} Created target profile
   */
  async create(input) {
    try {
      const { data } = await apolloClient.mutate({
        mutation: CREATE_TARGET_PROFILE,
        variables: { input },
        refetchQueries: [{ query: GET_TARGET_PROFILES }]
      });

      return data.createTargetProfile;
    } catch (error) {
      console.error('[TargetProfileService] Error creating target profile:', error);
      throw error;
    }
  }

  /**
   * Update existing target profile
   * @param {string} id - Target profile ID
   * @param {Object} input - Target profile input
   * @returns {Promise<Object>} Updated target profile
   */
  async update(id, input) {
    if (!id) {
      throw new Error('Target profile ID is required');
    }

    try {
      const { data } = await apolloClient.mutate({
        mutation: UPDATE_TARGET_PROFILE,
        variables: { id, input },
        refetchQueries: [
          { query: GET_TARGET_PROFILES },
          { query: GET_TARGET_PROFILE, variables: { id } }
        ]
      });

      return data.updateTargetProfile;
    } catch (error) {
      console.error('[TargetProfileService] Error updating target profile:', error);
      throw error;
    }
  }

  /**
   * Delete target profile (soft delete)
   * @param {string} id - Target profile ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    if (!id) {
      throw new Error('Target profile ID is required');
    }

    try {
      const { data } = await apolloClient.mutate({
        mutation: DELETE_TARGET_PROFILE,
        variables: { id },
        refetchQueries: [{ query: GET_TARGET_PROFILES }]
      });

      return data.deleteTargetProfile;
    } catch (error) {
      console.error('[TargetProfileService] Error deleting target profile:', error);
      throw error;
    }
  }
}

// Export singleton instance
const targetProfileService = new TargetProfileService();
export default targetProfileService;

