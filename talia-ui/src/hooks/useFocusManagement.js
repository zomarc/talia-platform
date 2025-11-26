/**
 * useFocusManagement - Compatibility wrapper hook
 * Maps useTaliaFocusManagement to the expected interface used by components
 */

import { useTaliaFocusManagement } from './useTaliaFocusManagement';

export const useFocusManagement = () => {
  const taliaHook = useTaliaFocusManagement();

  // Map Talia hook properties to expected interface
  return {
    // State - map property names
    focuses: taliaHook.taliaFocuses || [],
    currentFocus: taliaHook.currentTaliaFocus,
    loading: taliaHook.loading,
    error: taliaHook.error,
    fallbackMode: !taliaHook.taliaFocuses || taliaHook.taliaFocuses.length === 0,
    
    // Actions - map method names
    loadFocus: taliaHook.loadTaliaFocus,
    createFocus: taliaHook.createTaliaFocus,
    updateFocus: taliaHook.updateTaliaFocus,
    deleteFocus: taliaHook.deleteTaliaFocus,
    toggleFavorite: taliaHook.toggleFavorite,
    
    // Computed values
    favoriteFocuses: taliaHook.favoriteFocuses || [],
    recentlyUsedFocuses: [], // TODO: Implement recently used focuses
    canCreateFocus: taliaHook.canCreateFocus,
    
    // Initialize standard focuses (placeholder - may need implementation)
    initializeStandardFocuses: async () => {
      console.log('initializeStandardFocuses called - using Talia focuses');
      await taliaHook.loadTaliaFocuses();
      return true;
    },
    
    // Expose Talia-specific properties for components that need them
    taliaUserId: taliaHook.taliaUserId,
    taliaUser: taliaHook.taliaUser,
    isAdmin: taliaHook.isAdmin
  };
};

export default useFocusManagement;



