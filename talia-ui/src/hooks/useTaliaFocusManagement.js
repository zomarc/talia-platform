/**
 * React Hook for Talia Focus Management
 * Uses GraphQL service to fetch and manage focus data from Supabase
 */

import { useState, useEffect, useCallback } from 'react';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';
import graphQLFocusService from '../services/GraphQLFocusService';

export const useTaliaFocusManagement = () => {
  const { user, loading: authLoading, error: authError } = useSupabaseAuth();
  const [taliaFocuses, setTaliaFocuses] = useState([]);
  const [currentTaliaFocus, setCurrentTaliaFocus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  // Toggle favorite (placeholder)
  const toggleFavorite = useCallback(async (taliaFocusId) => {
    console.log(`Toggling favorite for focus ${taliaFocusId} for user ${user?.id}`);
    return true;
  }, [user?.id]);

  const isAdmin = userRole === 'admin';

  return {
    // State
    taliaUserId: user?.id,
    taliaUser: user,
    taliaFocuses,
    currentTaliaFocus,
    loading: loading || authLoading,
    error: error || authError,

    // Actions
    loadTaliaFocuses,
    loadTaliaFocus,
    createTaliaFocus,
    updateTaliaFocus,
    deleteTaliaFocus,
    toggleFavorite,
    
    // Computed values
    favoriteFocuses: [], // TODO: Implement proper favorite tracking
    canCreateFocus: isAdmin,
    canModifyFocus: isAdmin,
    isAdmin
  };
};