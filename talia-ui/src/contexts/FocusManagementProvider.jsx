import React from 'react';
import { FocusManagementContext } from './focusManagementContext';
import { useTaliaFocusManagementImpl } from '../hooks/useTaliaFocusManagementImpl';

/**
 * Single source of truth for focus rows + mutations (shared by header, sidebar, admin).
 * Must be inside {@link SupabaseAuthProvider}.
 */
export function FocusManagementProvider({ children }) {
  const value = useTaliaFocusManagementImpl();
  return <FocusManagementContext.Provider value={value}>{children}</FocusManagementContext.Provider>;
}
