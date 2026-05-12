/**
 * useFocusManagement — compatibility API mapped from {@link FocusManagementContext}.
 */

import { useContext } from 'react';
import { FocusManagementContext } from '../contexts/focusManagementContext';

export const useFocusManagement = () => {
  const taliaHook = useContext(FocusManagementContext);
  if (taliaHook == null) {
    throw new Error('useFocusManagement must be used within FocusManagementProvider.');
  }

  return {
    focuses: taliaHook.taliaFocuses || [],
    currentFocus: taliaHook.currentTaliaFocus,
    loading: taliaHook.loading,
    error: taliaHook.error,
    fallbackMode: !taliaHook.taliaFocuses || taliaHook.taliaFocuses.length === 0,

    loadFocus: taliaHook.loadTaliaFocus,
    refreshFocuses: taliaHook.loadTaliaFocuses,
    selectFocus: taliaHook.selectTaliaFocusById,
    createFocus: taliaHook.createTaliaFocus,
    updateFocus: taliaHook.updateTaliaFocus,
    deleteFocus: taliaHook.deleteTaliaFocus,
    toggleFavorite: taliaHook.toggleFavorite,

    favoriteFocuses: taliaHook.favoriteFocuses || [],
    recentlyUsedFocuses: [],
    canCreateFocus: taliaHook.canCreateFocus,

    initializeStandardFocuses: async () => {
      console.log('initializeStandardFocuses called - using Talia focuses');
      await taliaHook.loadTaliaFocuses();
      return true;
    },

    taliaUserId: taliaHook.taliaUserId,
    taliaUser: taliaHook.taliaUser,
    isAdmin: taliaHook.isAdmin
  };
};

export default useFocusManagement;
