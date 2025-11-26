/**
 * Focus Preferences Service
 * Handles user focus preferences (favorites, last used, custom layouts)
 */

import { apolloClient } from '../lib/apolloClient';
import { gql } from '@apollo/client';

const GET_USER_PREFERENCES_QUERY = gql`
  query GetMyFocusPreferences {
    myFocusPreferences {
      id
      userId
      focusId
      isFavorite
      lastUsed
      customLayout
      createdAt
      updatedAt
    }
  }
`;

const UPDATE_FOCUS_PREFERENCE_MUTATION = gql`
  mutation UpdateFocusPreference($focusId: ID!, $preferences: FocusPreferenceInput!) {
    updateFocusPreference(focusId: $focusId, preferences: $preferences) {
      id
      userId
      focusId
      isFavorite
      lastUsed
      customLayout
      createdAt
      updatedAt
    }
  }
`;

const TOGGLE_FAVORITE_MUTATION = gql`
  mutation ToggleFavorite($focusId: ID!) {
    toggleFavorite(focusId: $focusId) {
      id
      userId
      focusId
      isFavorite
      lastUsed
      customLayout
      createdAt
      updatedAt
    }
  }
`;

class FocusPreferencesService {
  /**
   * Get user preferences for all focuses
   */
  async getUserPreferences(userId) {
    try {
      const result = await apolloClient.query({
        query: GET_USER_PREFERENCES_QUERY,
        fetchPolicy: 'network-only',
        errorPolicy: 'all'
      });

      const { data, error } = result || {};

      if (error) {
        console.warn('⚠️ GraphQL error getting user preferences:', error);
        return [];
      }

      // Check if data exists before accessing properties
      if (!data) {
        console.log('ℹ️ No data returned from GraphQL, returning empty array');
        return [];
      }

      if (!data.myFocusPreferences) {
        console.log('ℹ️ No user preferences found, returning empty array');
        return [];
      }

      return data.myFocusPreferences || [];
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return [];
    }
  }

  /**
   * Toggle favorite status for a focus
   */
  async toggleFavorite(userId, focusId) {
    try {
      const { data } = await apolloClient.mutate({
        mutation: TOGGLE_FAVORITE_MUTATION,
        variables: { focusId },
      });

      return data.toggleFavorite;
    } catch (error) {
      console.error('Error toggling favorite:', error);
      throw error;
    }
  }

  /**
   * Update last used timestamp for a focus
   */
  async updateLastUsed(userId, focusId) {
    try {
      const { data } = await apolloClient.mutate({
        mutation: UPDATE_FOCUS_PREFERENCE_MUTATION,
        variables: {
          focusId,
          preferences: {
            lastUsed: new Date().toISOString(),
          },
        },
      });

      return data.updateFocusPreference;
    } catch (error) {
      console.error('Error updating last used:', error);
      throw error;
    }
  }

  /**
   * Save custom layout for a focus
   */
  async saveCustomLayout(userId, focusId, layout) {
    try {
      const { data } = await apolloClient.mutate({
        mutation: UPDATE_FOCUS_PREFERENCE_MUTATION,
        variables: {
          focusId,
          preferences: {
            customLayout: layout,
          },
        },
      });

      return data.updateFocusPreference;
    } catch (error) {
      console.error('Error saving custom layout:', error);
      throw error;
    }
  }

  /**
   * Update multiple preference fields at once
   */
  async updatePreferences(userId, focusId, preferences) {
    try {
      const { data } = await apolloClient.mutate({
        mutation: UPDATE_FOCUS_PREFERENCE_MUTATION,
        variables: {
          focusId,
          preferences: {
            isFavorite: preferences.isFavorite,
            lastUsed: preferences.lastUsed,
            customLayout: preferences.customLayout,
          },
        },
      });

      return data.updateFocusPreference;
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw error;
    }
  }
}

const focusPreferencesService = new FocusPreferencesService();
export default focusPreferencesService;



