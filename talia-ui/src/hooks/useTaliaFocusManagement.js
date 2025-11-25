/**
 * React Hook for Talia Focus Management
 * Uses GraphQL service to fetch and manage focus data from Supabase
 */

import { useState, useEffect, useCallback } from 'react';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';
import graphQLFocusService from '../services/GraphQLFocusService';
import focusPreferencesService from '../services/FocusPreferencesService';

export const useTaliaFocusManagement = () => {
  const { user, loading: authLoading, error: authError } = useSupabaseAuth();
  const [taliaFocuses, setTaliaFocuses] = useState([]);
  const [currentTaliaFocus, setCurrentTaliaFocus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [focusPreferences, setFocusPreferences] = useState([]);
  const [focusGroups, setFocusGroups] = useState([]);

  const userRole = user?.role;

  // Load Talia focuses when user role is available
  const loadTaliaFocuses = useCallback(async () => {
    if (!userRole) return;

    setLoading(true);
    setError(null);

    try {
      const focuses = await graphQLFocusService.getFocusesForRole(userRole);
      setTaliaFocuses(focuses);

      // Set default focus if none selected
      if (!currentTaliaFocus && focuses.length > 0) {
        const defaultFocus = focuses.find(f => f.isDefault) || focuses[0];
        setCurrentTaliaFocus(defaultFocus);
      }
    } catch (err) {
      console.error('Error loading Talia focuses:', err);
      setError(err.message);
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
    if (userRole !== 'admin') {
      setError('Admin access required to create Talia focuses');
      return false;
    }

    try {
      const newFocus = await graphQLFocusService.createFocus(focusData);
      if (newFocus) {
        setTaliaFocuses(prev => [...prev, newFocus]);
        setCurrentTaliaFocus(newFocus);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error creating Talia focus:', error);
      setError(error.message);
      return false;
    }
  }, [userRole]);

  // Update a Talia focus (admin only)
  const updateTaliaFocus = useCallback(async (taliaFocusId, updateData) => {
    if (userRole !== 'admin') {
      setError('Admin access required to update Talia focuses');
      return false;
    }
    try {
      const success = await graphQLFocusService.updateFocus(taliaFocusId, updateData);
      if (success) {
        setTaliaFocuses(prev => prev.map(f => f.id === taliaFocusId ? { ...f, ...updateData } : f));
        if (currentTaliaFocus?.id === taliaFocusId) {
          setCurrentTaliaFocus(prev => ({ ...prev, ...updateData }));
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating Talia focus:', error);
      setError(error.message);
      return false;
    }
  }, [userRole, currentTaliaFocus]);

  // Delete a Talia focus (admin only)
  const deleteTaliaFocus = useCallback(async (taliaFocusId) => {
    if (userRole !== 'admin') {
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
    if (userRole !== 'admin') {
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
    if (userRole !== 'admin') {
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
    if (userRole !== 'admin') {
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

  const isAdmin = userRole === 'admin';

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
    isAdmin
  };
};