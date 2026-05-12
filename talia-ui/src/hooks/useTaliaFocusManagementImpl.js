/**
 * Talia focus list + mutations (single implementation).
 * Mounted once via {@link FocusManagementProvider} so Dashboard, admin, and header share state.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';
import graphQLFocusService from '../services/GraphQLFocusService';
import focusPreferencesService from '../services/FocusPreferencesService';
import { normalizeRole, isAdmin } from '../utils/roleUtils';
import { GraphQLUtils } from '../lib/apolloClient';

export const useTaliaFocusManagementImpl = () => {
  const { user, loading: authLoading, error: authError } = useSupabaseAuth();
  const focusPreferenceUserKey = useMemo(() => {
    const t = user?.taliaUserId ?? user?.talia_user_id;
    return t != null && t !== '' ? String(t) : null;
  }, [user]);
  const [taliaFocuses, setTaliaFocuses] = useState([]);
  const [currentTaliaFocus, setCurrentTaliaFocus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [focusPreferences, setFocusPreferences] = useState([]);
  const [focusGroups, setFocusGroups] = useState([]);

  const userRole = normalizeRole(user?.role || GraphQLUtils.getUserRole() || 'USER');

  const loadTaliaFocuses = useCallback(async () => {
    if (!userRole) return [];

    setLoading(true);
    setError(null);

    try {
      const taliaUserKey =
        user?.taliaUserId != null && user.taliaUserId !== ''
          ? String(user.taliaUserId)
          : user?.talia_user_id != null && user.talia_user_id !== ''
            ? String(user.talia_user_id)
            : null;
      const focuses = await graphQLFocusService.getFocusesForRole(userRole, taliaUserKey);
      const nextFocuses = focuses || [];
      setTaliaFocuses(nextFocuses);

      setCurrentTaliaFocus((prev) => {
        if (prev || nextFocuses.length === 0) return prev;
        return nextFocuses.find((f) => f.isDefault) || nextFocuses[0];
      });
      return nextFocuses;
    } catch (err) {
      console.error('Error loading Talia focuses:', err);
      setError(err.message);
      setTaliaFocuses([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [userRole, user?.taliaUserId, user?.talia_user_id]);

  useEffect(() => {
    loadTaliaFocuses();
  }, [loadTaliaFocuses]);

  const loadTaliaFocus = useCallback(
    async (taliaFocusId) => {
      const focus = taliaFocuses.find((f) => f.id === taliaFocusId);
      if (focus) {
        setCurrentTaliaFocus(focus);
        return focus;
      }
      return null;
    },
    [taliaFocuses]
  );

  const selectTaliaFocusById = useCallback(
    (focusId) => {
      if (!focusId) {
        setCurrentTaliaFocus(null);
        return null;
      }
      const focus = taliaFocuses.find((f) => f.id === focusId);
      if (focus) {
        setCurrentTaliaFocus(focus);
        return focus;
      }
      return null;
    },
    [taliaFocuses]
  );

  const createTaliaFocus = useCallback(
    async (focusData) => {
      if (!isAdmin(userRole)) {
        setError('Admin access required to create Talia focuses');
        return false;
      }

      try {
        console.log('🆕 Creating focus:', focusData);
        const newFocus = await graphQLFocusService.createFocus(focusData);
        if (newFocus) {
          const mappedFocus = {
            ...newFocus,
            isStandard: newFocus.isPublic || false,
            assignedRoles: newFocus.assignedRoles || (newFocus.role ? [newFocus.role] : []),
            assignedUserId: newFocus.assignedUserId || null,
            layoutData: newFocus.layoutData || { components: [] }
          };
          console.log('✅ Focus created successfully:', mappedFocus.id, mappedFocus.name);
          await loadTaliaFocuses();
          setCurrentTaliaFocus(mappedFocus);
          return true;
        }
        console.error('❌ No focus returned from createFocus');
        setError('No focus returned from create operation');
        return false;
      } catch (createErr) {
        console.error('❌ Error creating Talia focus:', createErr);
        setError(createErr.message || 'Failed to create focus');
        return false;
      }
    },
    [userRole, loadTaliaFocuses]
  );

  const updateTaliaFocus = useCallback(
    async (taliaFocusId, updateData) => {
      if (!isAdmin(userRole)) {
        setError('Admin access required to update Talia focuses');
        return false;
      }
      try {
        console.log('📝 Updating focus:', taliaFocusId, updateData);
        const updatedFocus = await graphQLFocusService.updateFocus(taliaFocusId, updateData);
        if (updatedFocus) {
          const mappedFocus = {
            ...updatedFocus,
            isStandard: updatedFocus.isPublic || false,
            assignedRoles: updatedFocus.assignedRoles || (updatedFocus.role ? [updatedFocus.role] : []),
            assignedUserId: updatedFocus.assignedUserId || null,
            layoutData: updatedFocus.layoutData || { components: updatedFocus.components || [] }
          };
          console.log('✅ Focus updated successfully:', mappedFocus.id, mappedFocus.name);
          await loadTaliaFocuses();
          if (currentTaliaFocus?.id === taliaFocusId) {
            setCurrentTaliaFocus(mappedFocus);
          }
          return true;
        }
        console.error('❌ No focus returned from updateFocus');
        setError('No focus returned from update operation');
        return false;
      } catch (updateErr) {
        console.error('❌ Error updating Talia focus:', updateErr);
        setError(updateErr.message || 'Failed to update focus');
        return false;
      }
    },
    [userRole, currentTaliaFocus, loadTaliaFocuses]
  );

  const deleteTaliaFocus = useCallback(
    async (taliaFocusId) => {
      if (!isAdmin(userRole)) {
        setError('Admin access required to delete Talia focuses');
        return false;
      }
      try {
        const success = await graphQLFocusService.deleteFocus(taliaFocusId);
        if (success) {
          const focuses = await loadTaliaFocuses();
          if (Array.isArray(focuses) && focuses.some((f) => f.id === taliaFocusId)) {
            const msg = 'Delete focus failed: focus still present after refresh.';
            setError(msg);
            return false;
          }
          setCurrentTaliaFocus((prev) => {
            if (prev?.id !== taliaFocusId) {
              return prev;
            }
            if (focuses && focuses.length > 0) {
              return focuses.find((f) => f.isDefault) || focuses[0];
            }
            return null;
          });
          return true;
        }
        return false;
      } catch (deleteErr) {
        console.error('Error deleting Talia focus:', deleteErr);
        setError(deleteErr.message);
        return false;
      }
    },
    [userRole, loadTaliaFocuses]
  );

  const loadFocusPreferences = useCallback(async () => {
    if (!focusPreferenceUserKey) return;

    try {
      const preferences = await focusPreferencesService.getUserPreferences();
      setFocusPreferences(preferences);
    } catch (err) {
      console.error('Error loading focus preferences:', err);
    }
  }, [focusPreferenceUserKey]);

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

  const toggleFavorite = useCallback(
    async (taliaFocusId) => {
      if (!focusPreferenceUserKey) return false;

      try {
        const updated = await focusPreferencesService.toggleFavorite(taliaFocusId);
        setFocusPreferences((prev) => {
          const filtered = prev.filter((p) => p.focusId !== taliaFocusId);
          return [...filtered, updated];
        });
        return true;
      } catch (err) {
        console.error('Error toggling favorite:', err);
        setError(err.message);
        return false;
      }
    },
    [focusPreferenceUserKey]
  );

  const updateLastUsed = useCallback(
    async (taliaFocusId) => {
      if (!focusPreferenceUserKey) return;

      try {
        await focusPreferencesService.updateLastUsed(taliaFocusId);
        await loadFocusPreferences();
      } catch (err) {
        console.error('Error updating last used:', err);
      }
    },
    [focusPreferenceUserKey, loadFocusPreferences]
  );

  const saveCustomLayout = useCallback(
    async (taliaFocusId, layout) => {
      if (!focusPreferenceUserKey) return false;

      try {
        await focusPreferencesService.saveCustomLayout(taliaFocusId, layout);
        await loadFocusPreferences();
        return true;
      } catch (err) {
        console.error('Error saving custom layout:', err);
        setError(err.message);
        return false;
      }
    },
    [focusPreferenceUserKey, loadFocusPreferences]
  );

  const createFocusGroup = useCallback(
    async (groupData) => {
      if (!isAdmin(userRole)) {
        setError('Admin access required to create focus groups');
        return false;
      }

      try {
        const newGroup = await graphQLFocusService.createFocusGroup(groupData);
        if (newGroup) {
          setFocusGroups((prev) => [...prev, newGroup]);
          return true;
        }
        return false;
      } catch (err) {
        console.error('Error creating focus group:', err);
        setError(err.message);
        return false;
      }
    },
    [userRole]
  );

  const updateFocusGroup = useCallback(
    async (groupId, updateData) => {
      if (!isAdmin(userRole)) {
        setError('Admin access required to update focus groups');
        return false;
      }

      try {
        const updated = await graphQLFocusService.updateFocusGroup(groupId, updateData);
        if (updated) {
          setFocusGroups((prev) => prev.map((g) => (g.id === groupId ? updated : g)));
          return true;
        }
        return false;
      } catch (err) {
        console.error('Error updating focus group:', err);
        setError(err.message);
        return false;
      }
    },
    [userRole]
  );

  const deleteFocusGroup = useCallback(
    async (groupId) => {
      if (!isAdmin(userRole)) {
        setError('Admin access required to delete focus groups');
        return false;
      }

      try {
        const success = await graphQLFocusService.deleteFocusGroup(groupId);
        if (success) {
          setFocusGroups((prev) => prev.filter((g) => g.id !== groupId));
          return true;
        }
        return false;
      } catch (err) {
        console.error('Error deleting focus group:', err);
        setError(err.message);
        return false;
      }
    },
    [userRole]
  );

  const userIsAdmin = isAdmin(userRole);

  const favoriteFocuses = taliaFocuses.filter((focus) => {
    const pref = focusPreferences.find((p) => p.focusId === focus.id);
    return pref?.isFavorite;
  });

  return {
    taliaUserId: focusPreferenceUserKey,
    taliaUser: user,
    taliaFocuses,
    currentTaliaFocus,
    focusPreferences,
    focusGroups,
    loading: loading || authLoading,
    error: error || authError,

    loadTaliaFocuses,
    loadTaliaFocus,
    selectTaliaFocusById,
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

    favoriteFocuses,
    canCreateFocus: userIsAdmin,
    canModifyFocus: userIsAdmin,
    isAdmin: userIsAdmin
  };
};
