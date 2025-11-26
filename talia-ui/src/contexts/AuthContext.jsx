/**
 * AuthContext - Compatibility layer for legacy useAuth hook
 * Wraps SupabaseAuthContext and provides additional methods expected by components
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useSupabaseAuth } from './SupabaseAuthContext';

const AuthContext = createContext();

/**
 * Compatibility hook that wraps useSupabaseAuth and adds missing methods
 * Expected interface:
 * - user: { name, email, role, preferences, ... }
 * - signOut: () => Promise<void>
 * - updateUserPreferences: (prefs: object) => void
 * - switchRole: (role: string) => void
 */
export const useAuth = () => {
  const supabaseAuth = useSupabaseAuth();
  const [localPreferences, setLocalPreferences] = useState({});
  const [localRole, setLocalRole] = useState(null);

  // Merge Supabase user with local state
  const user = supabaseAuth.user ? {
    ...supabaseAuth.user,
    // Ensure user has name property (fallback to email)
    name: supabaseAuth.user.name || supabaseAuth.user.user_metadata?.name || supabaseAuth.user.email?.split('@')[0] || 'User',
    // Merge preferences
    preferences: {
      theme: 'default',
      fontSize: 12,
      fontFamily: 'Inter',
      spacingMode: 'default',
      ...supabaseAuth.user.preferences,
      ...localPreferences
    },
    // Use local role override if set, otherwise use from user or default
    role: localRole || supabaseAuth.user.role || 'user'
  } : null;

  const updateUserPreferences = useCallback((prefs) => {
    setLocalPreferences(prev => ({ ...prev, ...prefs }));
    // TODO: Persist to backend when database is available
    console.log('User preferences updated (local only):', prefs);
  }, []);

  const switchRole = useCallback((newRole) => {
    setLocalRole(newRole);
    // TODO: Persist to backend when database is available
    console.log('User role switched (local only):', newRole);
  }, []);

  return {
    user,
    signOut: supabaseAuth.signOut,
    updateUserPreferences,
    switchRole,
    loading: supabaseAuth.loading,
    error: supabaseAuth.error,
    session: supabaseAuth.session
  };
};

/**
 * AuthProvider - Wraps SupabaseAuthProvider
 * This is just a pass-through since SupabaseAuthProvider is already set up in main.jsx
 */
export const AuthProvider = ({ children }) => {
  // This provider doesn't need to do anything since SupabaseAuthProvider
  // is already wrapping the app in main.jsx
  // We're just providing the useAuth hook that wraps useSupabaseAuth
  return <>{children}</>;
};

export default AuthContext;



