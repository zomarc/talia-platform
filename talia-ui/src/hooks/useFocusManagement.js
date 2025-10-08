/**
 * Focus Management Hook
 * Uses InstantDB for persistent focus management
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import focusService from '../services/FocusService';

export const useFocusManagement = () => {
  const { user } = useAuth();
  const [focuses, setFocuses] = useState([]);
  const [currentFocus, setCurrentFocus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userPreferences, setUserPreferences] = useState({});

  // Use taliaUserId from auth context
  const taliaUserId = user?.taliaUserId;

  // Load focuses when user is ready
  const loadFocuses = useCallback(async () => {
    if (!user?.role) return;

    setLoading(true);
    setError(null);

    try {
      const userFocuses = await focusService.getFocusesForRole(user.role);
      setFocuses(userFocuses);

      // Set default focus if none selected
      if (!currentFocus && userFocuses.length > 0) {
        const defaultFocus = userFocuses.find(f => f.isDefault) || userFocuses[0];
        setCurrentFocus(defaultFocus);
      }
    } catch (err) {
      console.error('Error loading focuses:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.role, currentFocus]);

  useEffect(() => {
    loadFocuses();
  }, [loadFocuses]);

  // Load a specific focus
  const loadFocus = useCallback(async (focusId) => {
    const focus = focuses.find(f => f.id === focusId);
    if (focus) {
      setCurrentFocus(focus);
      return focus;
    }
    return null;
  }, [focuses]);

  // Create a new focus (Admin only)
  const createFocus = useCallback(async (focusData) => {
    if (!taliaUserId) {
      setError('User not initialized');
      return false;
    }

    if (user?.role !== 'admin') {
      setError('Admin access required to create focuses');
      return false;
    }

    try {
      const newFocus = await focusService.createFocus(focusData, taliaUserId);
      if (newFocus) {
        setFocuses(prev => [...prev, newFocus]);
        setCurrentFocus(newFocus);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error creating focus:', error);
      setError(error.message);
      return false;
    }
  }, [taliaUserId, user?.role]);

  // Initialize standard focuses (admin only)
  const initializeStandardFocuses = useCallback(async () => {
    if (!taliaUserId || user?.role !== 'admin') {
      setError('Admin access required');
      return false;
    }

    try {
      const success = await focusService.initializeStandardFocuses(taliaUserId);
      if (success) {
        // Reload focuses after initialization
        await loadFocuses();
      }
      return success;
    } catch (error) {
      console.error('Error initializing standard focuses:', error);
      setError(error.message);
      return false;
    }
  }, [taliaUserId, user?.role, loadFocuses]);

  // Update focus
  const updateFocus = useCallback(async (focusId, updateData) => {
    try {
      const success = await focusService.updateFocus(focusId, updateData);
      if (success) {
        // Update local state
        setFocuses(prev => prev.map(f => 
          f.id === focusId ? { ...f, ...updateData } : f
        ));
        
        if (currentFocus?.id === focusId) {
          setCurrentFocus(prev => ({ ...prev, ...updateData }));
        }
      }
      return success;
    } catch (error) {
      console.error('Error updating focus:', error);
      setError(error.message);
      return false;
    }
  }, [currentFocus]);

  // Delete focus
  const deleteFocus = useCallback(async (focusId) => {
    setFocuses(prev => prev.filter(f => f.id !== focusId));
    
    if (currentFocus?.id === focusId) {
      const remainingFocuses = focuses.filter(f => f.id !== focusId);
      setCurrentFocus(remainingFocuses.length > 0 ? remainingFocuses[0] : null);
    }
    return true;
  }, [focuses, currentFocus]);

  // Toggle favorite
  const toggleFavorite = useCallback(async (focusId) => {
    setUserPreferences(prev => {
      const favorites = prev.favoriteFocuses || [];
      const isFavorite = favorites.includes(focusId);
      
      return {
        ...prev,
        favoriteFocuses: isFavorite 
          ? favorites.filter(id => id !== focusId)
          : [...favorites, focusId]
      };
    });
    return true;
  }, []);

  return {
    // State
    focuses,
    currentFocus,
    loading,
    error,
    userPreferences,
    taliaUserId,
    
    // Actions
    loadFocuses,
    loadFocus,
    createFocus,
    updateFocus,
    deleteFocus,
    toggleFavorite,
    initializeStandardFocuses,
    
    // Computed values
    favoriteFocuses: focuses.filter(f =>
      userPreferences.favoriteFocuses?.includes(f.id)
    ),
    canCreateFocus: user?.role === 'admin', // Only admins can create focuses
    canModifyFocus: user?.role === 'admin' // Only admins can modify focuses
  };
};