/**
 * React Hook for Talia Focus Management
 * Uses GraphQL service to fetch and manage focus data from Supabase
 */

import { useState, useEffect, useCallback } from 'react';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';
import graphQLFocusService from '../services/GraphQLFocusService';
import focusPreferencesService from '../services/FocusPreferencesService';
import { normalizeRole, isAdmin } from '../utils/roleUtils';
import { GraphQLUtils } from '../lib/apolloClient';

export const useTaliaFocusManagement = () => {
  const { user, loading: authLoading, error: authError } = useSupabaseAuth();
  const [taliaFocuses, setTaliaFocuses] = useState([]);
  const [currentTaliaFocus, setCurrentTaliaFocus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [focusPreferences, setFocusPreferences] = useState([]);
  const [focusGroups, setFocusGroups] = useState([]);

  // Get role from user or localStorage (normalized to uppercase)
  const userRole = normalizeRole(user?.role || GraphQLUtils.getUserRole() || 'USER');

  // Load Talia focuses when user role is available
  const loadTaliaFocuses = useCallback(async () => {
    if (!userRole) return;

    setLoading(true);
    setError(null);

    try {
      const focuses = await graphQLFocusService.getFocusesForRole(userRole);
      setTaliaFocuses(focuses || []);

      // Set default focus if none selected
      if (!currentTaliaFocus && focuses && focuses.length > 0) {
        const defaultFocus = focuses.find(f => f.isDefault) || focuses[0];
        setCurrentTaliaFocus(defaultFocus);
      }
    } catch (err) {
      console.error('Error loading Talia focuses:', err);
      setError(err.message);
      setTaliaFocuses([]);
    } finally {
      setLoading(false);
    }
  }, [userRole, currentTaliaFocus]);

  useEffect(() => {
    loadTaliaFocuses();
  }, [loadTaliaFocuses]);

  // Load a specific Talia focus
  const loadTaliaFocus = useCallback(async (taliaFocusId) => {
    const focus = taliaFocuses.find(f => f.id === taliaFocusId);
    if (focus) {
      setCurrentTaliaFocus(focus);
      return focus;
    }
    return null;
  }, [taliaFocuses]);

  // Create a new Talia focus (admin only)
  const createTaliaFocus = useCallback(async (focusData) => {
    if (!isAdmin(userRole)) {
      setError('Admin access required to create Talia focuses');
      return false;
    }

    try {
      console.log('🆕 Creating focus:', focusData);
      const newFocus = await graphQLFocusService.createFocus(focusData);
      if (newFocus) {
        // Map GraphQL response back to expected format
        const mappedFocus = {
          ...newFocus,
          isStandard: newFocus.isPublic || false,
          assignedRoles: newFocus.role ? [newFocus.role] : [],
          layoutData: newFocus.layoutData || { components: [] }
        };
        console.log('✅ Focus created successfully:', mappedFocus.id, mappedFocus.name);
        // Reload focuses to get the latest data
        await loadTaliaFocuses();
        // Set the newly created focus as current
        setCurrentTaliaFocus(mappedFocus);
        return true;
      }
      console.error('❌ No focus returned from createFocus');
      setError('No focus returned from create operation');
      return false;
    } catch (error) {
      console.error('❌ Error creating Talia focus:', error);
      setError(error.message || 'Failed to create focus');
      return false;
    }
  }, [userRole, loadTaliaFocuses]);

  // Update a Talia focus (admin only)
  const updateTaliaFocus = useCallback(async (taliaFocusId, updateData) => {
    if (!isAdmin(userRole)) {
      setError('Admin access required to update Talia focuses');
      return false;
    }
    try {
      console.log('📝 Updating focus:', taliaFocusId, updateData);
      const updatedFocus = await graphQLFocusService.updateFocus(taliaFocusId, updateData);
      if (updatedFocus) {
        // Map GraphQL response back to expected format
        const mappedFocus = {
          ...updatedFocus,
          isStandard: updatedFocus.isPublic || false,
          assignedRoles: updatedFocus.role ? [updatedFocus.role] : [],
          layoutData: updatedFocus.layoutData || { components: updatedFocus.components || [] }
        };
        console.log('✅ Focus updated successfully:', mappedFocus.id, mappedFocus.name);
        // Reload focuses to get the latest data
        await loadTaliaFocuses();
        // Update current focus if it's the one being updated
        if (currentTaliaFocus?.id === taliaFocusId) {
          setCurrentTaliaFocus(mappedFocus);
        }
        return true;
      }
      console.error('❌ No focus returned from updateFocus');
      setError('No focus returned from update operation');
      return false;
    } catch (error) {
      console.error('❌ Error updating Talia focus:', error);
      setError(error.message || 'Failed to update focus');
      return false;
    }
  }, [userRole, currentTaliaFocus, loadTaliaFocuses]);

  // Delete a Talia focus (admin only)
  const deleteTaliaFocus = useCallback(async (taliaFocusId) => {
    if (!isAdmin(userRole)) {
      setError('Admin access required to delete Talia focuses');
      return false;
    }
    try {
      const success = await graphQLFocusService.deleteFocus(taliaFocusId);
      if (success) {
        setTaliaFocuses(prev => prev.filter(f => f.id !== taliaFocusId));
        if (currentTaliaFocus?.id === taliaFocusId) {
          setCurrentTaliaFocus(null);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting Talia focus:', error);
      setError(error.message);
      return false;
    }
  }, [userRole, currentTaliaFocus]);

  // Load focus preferences
  const loadFocusPreferences = useCallback(async () => {
    if (!user?.id) return;

    try {
      const preferences = await focusPreferencesService.getUserPreferences(user.id);
      setFocusPreferences(preferences);
    } catch (err) {
      console.error('Error loading focus preferences:', err);
    }
  }, [user?.id]);

  // Load focus groups
  const loadFocusGroups = useCallback(async () => {
    try {
      const groups = await graphQLFocusService.getFocusGroups();
      setFocusGroups(groups);
    } catch (err) {
      console.error('Error loading focus groups:', err);
    }
  }, []);

  useEffect(() => {
    loadFocusPreferences();
    loadFocusGroups();
  }, [loadFocusPreferences, loadFocusGroups]);

  // Toggle favorite
  const toggleFavorite = useCallback(async (taliaFocusId) => {
    if (!user?.id) return false;

    try {
      const updated = await focusPreferencesService.toggleFavorite(user.id, taliaFocusId);
      setFocusPreferences(prev => {
        const filtered = prev.filter(p => p.focusId !== taliaFocusId);
        return [...filtered, updated];
      });
      return true;
    } catch (err) {
      console.error('Error toggling favorite:', err);
      setError(err.message);
      return false;
    }
  }, [user?.id]);

  // Update last used
  const updateLastUsed = useCallback(async (taliaFocusId) => {
    if (!user?.id) return;

    try {
      await focusPreferencesService.updateLastUsed(user.id, taliaFocusId);
      await loadFocusPreferences();
    } catch (err) {
      console.error('Error updating last used:', err);
    }
  }, [user?.id, loadFocusPreferences]);

  // Save custom layout
  const saveCustomLayout = useCallback(async (taliaFocusId, layout) => {
    if (!user?.id) return false;

    try {
      await focusPreferencesService.saveCustomLayout(user.id, taliaFocusId, layout);
      await loadFocusPreferences();
      return true;
    } catch (err) {
      console.error('Error saving custom layout:', err);
      setError(err.message);
      return false;
    }
  }, [user?.id, loadFocusPreferences]);

  // Focus group management (admin only)
  const createFocusGroup = useCallback(async (groupData) => {
    if (!isAdmin(userRole)) {
      setError('Admin access required to create focus groups');
      return false;
    }

    try {
      const newGroup = await graphQLFocusService.createFocusGroup(groupData);
      if (newGroup) {
        setFocusGroups(prev => [...prev, newGroup]);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error creating focus group:', err);
      setError(err.message);
      return false;
    }
  }, [userRole]);

  const updateFocusGroup = useCallback(async (groupId, updateData) => {
    if (!isAdmin(userRole)) {
      setError('Admin access required to update focus groups');
      return false;
    }

    try {
      const updated = await graphQLFocusService.updateFocusGroup(groupId, updateData);
      if (updated) {
        setFocusGroups(prev => prev.map(g => g.id === groupId ? updated : g));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error updating focus group:', err);
      setError(err.message);
      return false;
    }
  }, [userRole]);

  const deleteFocusGroup = useCallback(async (groupId) => {
    if (!isAdmin(userRole)) {
      setError('Admin access required to delete focus groups');
      return false;
    }

    try {
      const success = await graphQLFocusService.deleteFocusGroup(groupId);
      if (success) {
        setFocusGroups(prev => prev.filter(g => g.id !== groupId));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error deleting focus group:', err);
      setError(err.message);
      return false;
    }
  }, [userRole]);

  const userIsAdmin = isAdmin(userRole);

  // Computed values
  const favoriteFocuses = taliaFocuses.filter(focus => {
    const pref = focusPreferences.find(p => p.focusId === focus.id);
    return pref?.isFavorite;
  });

  return {
    // State
    taliaUserId: user?.id,
    taliaUser: user,
    taliaFocuses,
    currentTaliaFocus,
    focusPreferences,
    focusGroups,
    loading: loading || authLoading,
    error: error || authError,

    // Actions
    loadTaliaFocuses,
    loadTaliaFocus,
    createTaliaFocus,
    updateTaliaFocus,
    deleteTaliaFocus,
    toggleFavorite,
    updateLastUsed,
    saveCustomLayout,
    loadFocusPreferences,
    loadFocusGroups,
    createFocusGroup,
    updateFocusGroup,
    deleteFocusGroup,
    
    // Computed values
    favoriteFocuses,
    canCreateFocus: isAdmin,
    canModifyFocus: isAdmin,
    isAdmin: userIsAdmin
  };
};