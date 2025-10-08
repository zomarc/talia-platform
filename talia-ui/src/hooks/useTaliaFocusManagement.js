/**
 * React Hook for Talia Focus Management
 * Uses mapping service to get Talia user ID from InstantDB auth
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import userMappingService from '../services/UserMappingService';
import taliaUserService from '../services/TaliaUserService';
import taliaFocusService from '../services/TaliaFocusService';

export const useTaliaFocusManagement = () => {
  const { user: instantUser, loading: authLoading, error: authError } = useAuth();
  const [taliaUserId, setTaliaUserId] = useState(null);
  const [taliaUser, setTaliaUser] = useState(null);
  const [taliaFocuses, setTaliaFocuses] = useState([]);
  const [currentTaliaFocus, setCurrentTaliaFocus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize Talia user when InstantDB user is authenticated
  useEffect(() => {
    const initializeTaliaUser = async () => {
      if (authLoading) return;

      if (instantUser) {
        setLoading(true);
        try {
          // Get or create mapping between InstantDB auth ID and Talia user ID
          const userId = await userMappingService.getOrCreateMapping(instantUser.id, instantUser.email);
          if (userId) {
            setTaliaUserId(userId);
            
            // Create Talia user if not exists
            let user = taliaUserService.getTaliaUserById(userId);
            if (!user) {
              // For development, make first user admin
              const isFirstUser = taliaUserService.getAllTaliaUsers().length === 0;
              const role = isFirstUser ? 'admin' : 'user';
              user = taliaUserService.createTaliaUser(userId, instantUser.email, role);
            }
            
            setTaliaUser(user);
            console.log(`✅ Talia user initialized: ${userId} (${user.taliaRole})`);
          }
        } catch (err) {
          console.error('Error initializing Talia user:', err);
          setError(err.message);
        } finally {
          setLoading(false);
        }
      } else {
        setTaliaUserId(null);
        setTaliaUser(null);
        setLoading(false);
      }
    };

    initializeTaliaUser();
  }, [instantUser, authLoading]);

  // Load Talia focuses when Talia user is ready
  const loadTaliaFocuses = useCallback(async () => {
    if (!taliaUser?.taliaRole) return;

    setLoading(true);
    setError(null);

    try {
      const focuses = await taliaFocusService.getTaliaFocusesForRole(taliaUser.taliaRole);
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
  }, [taliaUser?.taliaRole, currentTaliaFocus]);

  useEffect(() => {
    loadTaliaFocuses();
  }, [loadTaliaFocuses]);

  // Load a specific Talia focus
  const loadTaliaFocus = useCallback(async (taliaFocusId) => {
    const focus = taliaFocuses.find(f => f.taliaFocusId === taliaFocusId);
    if (focus) {
      setCurrentTaliaFocus(focus);
      return focus;
    }
    return null;
  }, [taliaFocuses]);

  // Create a new Talia focus (admin only)
  const createTaliaFocus = useCallback(async (focusData) => {
    if (!taliaUser) {
      setError('Talia user not initialized');
      return false;
    }

    if (taliaUser.taliaRole !== 'admin') {
      setError('Admin access required to create Talia focuses');
      return false;
    }

    try {
      const newFocus = await taliaFocusService.createTaliaFocus(focusData, taliaUser.taliaUserId);
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
  }, [taliaUser]);

  // Update a Talia focus (admin only)
  const updateTaliaFocus = useCallback(async (taliaFocusId, updateData) => {
    if (taliaUser?.taliaRole !== 'admin') {
      setError('Admin access required to update Talia focuses');
      return false;
    }
    try {
      const success = await taliaFocusService.updateTaliaFocus(taliaFocusId, updateData);
      if (success) {
        setTaliaFocuses(prev => prev.map(f => f.taliaFocusId === taliaFocusId ? { ...f, ...updateData } : f));
        if (currentTaliaFocus?.taliaFocusId === taliaFocusId) {
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
  }, [taliaUser, currentTaliaFocus]);

  // Delete a Talia focus (admin only)
  const deleteTaliaFocus = useCallback(async (taliaFocusId) => {
    if (taliaUser?.taliaRole !== 'admin') {
      setError('Admin access required to delete Talia focuses');
      return false;
    }
    try {
      const success = await taliaFocusService.deleteTaliaFocus(taliaFocusId);
      if (success) {
        setTaliaFocuses(prev => prev.filter(f => f.taliaFocusId !== taliaFocusId));
        if (currentTaliaFocus?.taliaFocusId === taliaFocusId) {
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
  }, [taliaUser, currentTaliaFocus]);

  // Initialize standard Talia focuses (admin only)
  const initializeStandardTaliaFocuses = useCallback(async () => {
    if (!taliaUser || taliaUser.taliaRole !== 'admin') {
      setError('Admin access required');
      return false;
    }
    try {
      const success = await taliaFocusService.initializeStandardTaliaFocuses(taliaUser.taliaUserId);
      if (success) {
        await loadTaliaFocuses();
      }
      return success;
    } catch (error) {
      console.error('Error initializing standard Talia focuses:', error);
      setError(error.message);
      return false;
    }
  }, [taliaUser, loadTaliaFocuses]);

  // Toggle favorite
  const toggleFavorite = useCallback(async (taliaFocusId) => {
    console.log(`Toggling favorite for focus ${taliaFocusId} for user ${taliaUserId}`);
    return true;
  }, [taliaUserId]);

  const isAdmin = taliaUser?.taliaRole === 'admin';

  return {
    // State
    taliaUserId,
    taliaUser,
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
    initializeStandardTaliaFocuses,

    // Computed values
    favoriteFocuses: [], // TODO: Implement proper favorite tracking
    canCreateFocus: isAdmin,
    canModifyFocus: isAdmin,
    isAdmin
  };
};