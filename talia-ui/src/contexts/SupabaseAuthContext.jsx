/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { GraphQLUtils } from '../lib/apolloClient';

const SupabaseAuthContext = createContext();

const DEV_USERS = [
  { id: 'dev-user-1', email: 'dev@talia.local',      name: 'Dev Admin',       talia_user_id: 1000, role: 'ADMIN'   },
  { id: 'dev-user-2', email: 'russell@talia.local',   name: 'Russell',         talia_user_id: 1001, role: 'ADMIN'   },
  { id: 'dev-user-3', email: 'andy@talia.local',      name: 'Andy',            talia_user_id: 1002, role: 'MANAGER' },
  { id: 'dev-user-4', email: 'analyst@talia.local',   name: 'Analyst',         talia_user_id: 1003, role: 'USER'    },
  { id: 'dev-user-5', email: 'guest@talia.local',     name: 'Guest Viewer',    talia_user_id: 1004, role: 'GUEST'   },
];

export const useSupabaseAuth = () => {
  const context = useContext(SupabaseAuthContext);
  if (!context) {
    throw new Error('useSupabaseAuth must be used within a SupabaseAuthProvider');
  }
  return context;
};

export const SupabaseAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  
  // Open-access / staging bypass:
  // - Vite DEV, or VITE_ENABLE_DEV_MODE
  // - OR Supabase is only reachable on loopback while the UI is served remotely
  //   (taliahub.com → local machine). Real auth against 127.0.0.1 fails with
  //   "Failed to fetch" in that case; ngrok basic-auth is enough for now.
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '');
  let supabaseIsLoopback = false;
  try {
    const host = new URL(supabaseUrl).hostname;
    supabaseIsLoopback = host === 'localhost' || host === '127.0.0.1';
  } catch {
    supabaseIsLoopback = !supabaseUrl;
  }
  const pageHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const pageIsLoopback = pageHost === 'localhost' || pageHost === '127.0.0.1';
  const isDevMode =
    import.meta.env.DEV
    || import.meta.env.VITE_ENABLE_DEV_MODE === 'true'
    || (supabaseIsLoopback && !pageIsLoopback);

  const resolveUserRole = (email, dbRole = null) => {
    const fromDb = String(dbRole || '').trim().toUpperCase();
    if (fromDb === 'SUPERUSER') return 'SUPER_USER';
    if (['GUEST', 'USER', 'MANAGER', 'ADMIN', 'SUPER_USER'].includes(fromDb)) {
      return fromDb;
    }

    const normalizedEmail = String(email || '').toLowerCase().trim();
    if (!normalizedEmail) return 'USER';
    if (normalizedEmail === 'admin@talia.dev') return 'ADMIN';

    const devMatch = DEV_USERS.find((entry) => String(entry.email || '').toLowerCase() === normalizedEmail);
    if (devMatch?.role) return devMatch.role;

    // In dev/staging mode, authenticated users should be able to exercise admin workflows.
    if (isDevMode) return 'ADMIN';

    return 'USER';
  };
  
  // Create mock user for development
  const createMockUser = () => {
    const savedUserId = localStorage.getItem('devUserId') || 'dev-user-1';
    const savedRole = localStorage.getItem('devUserRole') || null;
    const devEntry = DEV_USERS.find((u) => u.id === savedUserId) || DEV_USERS[0];
    const role = savedRole || devEntry.role;
    const mockUser = {
      id: devEntry.id,
      email: devEntry.email,
      name: devEntry.name,
      talia_user_id: devEntry.talia_user_id,
      taliaUserId: devEntry.talia_user_id,
      role,
      taliaUser: {
        id: devEntry.id,
        talia_user_id: devEntry.talia_user_id,
        email: devEntry.email
      }
    };
    
    GraphQLUtils.setUserContext({
      role,
      email: mockUser.email,
      id: mockUser.id,
      taliaUserId: devEntry.talia_user_id
    });
    
    return mockUser;
  };
  
  // Switch to a different dev user by id
  const switchDevUser = (devUserId) => {
    if (!isDevMode) {
      console.warn('switchDevUser only works in development mode');
      return;
    }
    const target = DEV_USERS.find((u) => u.id === devUserId);
    if (!target) return;
    localStorage.setItem('devUserId', target.id);
    localStorage.setItem('devUserRole', target.role);
    const mockUser = {
      id: target.id,
      email: target.email,
      name: target.name,
      talia_user_id: target.talia_user_id,
      taliaUserId: target.talia_user_id,
      role: target.role,
      taliaUser: {
        id: target.id,
        talia_user_id: target.talia_user_id,
        email: target.email
      }
    };
    setUser(mockUser);
    GraphQLUtils.setUserContext({
      role: target.role,
      email: target.email,
      id: target.id,
      taliaUserId: target.talia_user_id
    });
  };

  // Update user role (for dev role selector)
  const updateUserRole = (newRole) => {
    if (!isDevMode) {
      console.warn('updateUserRole only works in development mode');
      return;
    }
    
    localStorage.setItem('devUserRole', newRole);
    
    if (user && user.id?.startsWith('dev-user-')) {
      const updatedUser = {
        ...user,
        role: newRole
      };
      setUser(updatedUser);
      
      GraphQLUtils.setUserContext({
        role: newRole,
        email: updatedUser.email,
        id: updatedUser.id,
        taliaUserId: updatedUser.talia_user_id ?? updatedUser.taliaUser?.talia_user_id
      });
    }
  };

  // Get or create Talia user record
  const getOrCreateTaliaUser = async (supabaseUser) => {
    if (!supabaseUser?.email) return null;
    
    try {
      // First try to get existing talia_user
      const { data: existingUser, error: fetchError } = await supabase
        .from('talia_users')
        .select('*')
        .eq('email', supabaseUser.email)
        .single();
      
      if (existingUser && !fetchError) {
        // Update last_login_at
        await supabase
          .from('talia_users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', existingUser.id);
        return existingUser;
      }
      
      // User doesn't exist, create new one
      // Get max talia_user_id to determine next ID
      const { data: maxUser } = await supabase
        .from('talia_users')
        .select('talia_user_id')
        .order('talia_user_id', { ascending: false })
        .limit(1)
        .single();
      
      const taliaUserId = maxUser?.talia_user_id ? maxUser.talia_user_id + 1 : 1000;
      
      const { data: newUser, error: createError } = await supabase
        .from('talia_users')
        .insert({
          id: supabaseUser.id,
          talia_user_id: taliaUserId,
          email: supabaseUser.email,
          role: resolveUserRole(supabaseUser.email),
          last_login_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating talia_user:', createError);
        return null;
      }
      
      return newUser;
    } catch (error) {
      console.error('Error getting/creating talia_user:', error);
      return null;
    }
  };

  useEffect(() => {
    let timeoutId;
    let subscription;
    let isMounted = true;

    // Remote UI + loopback Supabase: skip network auth entirely.
    if (isDevMode && supabaseIsLoopback && !pageIsLoopback) {
      console.log('🔧 Open-access mode: skipping Supabase (loopback URL from remote host)');
      const mockUser = createMockUser();
      setUser(mockUser);
      setLoading(false);
      return () => {
        isMounted = false;
      };
    }

    // Set a timeout to prevent infinite loading
    timeoutId = setTimeout(() => {
      if (isMounted) {
        console.warn('⚠️ Auth loading timeout - forcing loading to false');
        setLoading(false);
      }
    }, 5000); // 5 second timeout

    // Process session helper function
    const processSession = async (session, event = 'unknown') => {
      if (!isMounted) return;
      
      console.log(`🔐 Processing session (${event}):`, session?.user?.email || 'no session');
      
      setSession(session);
      
      if (session?.user) {
        try {
          // Resolve Talia mapping before marking auth ready — appearance/focus keys need talia_user_id.
          // (A short Promise.race timeout previously left taliaUser null and broke ThemeContext / GraphQL identity.)
          const taliaUser = await getOrCreateTaliaUser(session.user);
          
          if (!isMounted) return;
          
          const userRole = resolveUserRole(session.user.email, taliaUser?.role);
          
          // Set role in localStorage for GraphQL context
          GraphQLUtils.setUserContext({
            role: userRole,
            email: session.user.email,
            id: session.user.id,
            taliaUserId: taliaUser?.talia_user_id ?? null
          });
          
          setUser({
            ...session.user,
            taliaUserId: taliaUser?.talia_user_id || null,
            talia_user_id: taliaUser?.talia_user_id ?? undefined,
            taliaUser: taliaUser,
            role: userRole
          });
          
          console.log('✅ User set:', session.user.email, 'Role:', userRole);
        } catch (error) {
          console.error('❌ Error processing user:', error);
          // Even if there's an error, set the user so auth can proceed
          if (isMounted && session?.user) {
            const userRole = resolveUserRole(session.user.email);
            GraphQLUtils.setUserContext({
              role: userRole,
              email: session.user.email,
              id: session.user.id,
              taliaUserId: null
            });
            setUser({
              ...session.user,
              role: userRole
            });
            console.log('✅ User set (with error fallback):', session.user.email, 'Role:', userRole);
          }
          if (isMounted) {
            setError(error);
          }
        }
      } else {
        console.log('🔐 No user in session - clearing user state');
        
        // In dev mode, create mock user instead of clearing
        if (isDevMode && isMounted) {
          console.log('🔧 Development mode: Creating mock user (no Supabase session)');
          const mockUser = createMockUser();
          setUser(mockUser);
        } else {
          setUser(null);
          GraphQLUtils.clearUserContext();
        }
      }
      
      // Always set loading to false, even if there was an error
      if (isMounted) {
        setLoading(false);
      }
    };

    // Listen for auth state changes FIRST (this will also trigger on initial load)
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔐 Auth state changed:', event, session?.user?.email || 'no session');
        
        // Clear timeout since we got an auth event
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        Promise.resolve(processSession(session, event)).catch((callbackError) => {
          console.error('❌ Error in auth state callback:', callbackError);
        });
      }
    );
    subscription = authSubscription;

    // Also get initial session explicitly
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      if (session?.user) {
        console.log('🔐 Initial session found:', session.user.email);
        // Process the session (onAuthStateChange will also fire, but this ensures we process it)
        await processSession(session, 'initial');
      } else {
        console.log('🔐 No initial session');
        
        // In dev mode, create mock user if no Supabase session
        if (isDevMode && isMounted) {
          console.log('🔧 Development mode: Creating mock user');
          const mockUser = createMockUser();
          setUser(mockUser);
          setLoading(false);
        } else if (isMounted) {
          setLoading(false);
        }
      }
    }).catch((err) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      console.error('Error getting session:', err);
      if (isMounted) {
        setError(err);
        setLoading(false);
      }
    });

    // Cleanup function
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (subscription) subscription.unsubscribe();
    };
  }, [isDevMode]);



  const signInWithEmail = async (email) => {
    try {
      setLoading(true);
      setError(null);
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      alert('Check your email for the magic link!');
    } catch (err) {
      setError(err);
      console.error('Error signing in:', err.message);
    } finally {
      setLoading(false);
    }
  };

  /** Local/open-access session — no Supabase network call. */
  const enterDevSession = (devUserId = 'dev-user-1') => {
    if (!isDevMode) {
      console.warn('enterDevSession only works in development/open-access mode');
      return null;
    }
    localStorage.setItem('devUserId', devUserId);
    const mockUser = createMockUser();
    setUser(mockUser);
    setSession(null);
    setError(null);
    setLoading(false);
    return mockUser;
  };

  const signInWithPassword = async (email, password) => {
    try {
      setLoading(true);
      setError(null);

      // Public tunnel + loopback Supabase cannot authenticate; use local admin.
      if (isDevMode && supabaseIsLoopback && !pageIsLoopback) {
        return { user: enterDevSession('dev-user-1') };
      }
      
      // Try to sign in with existing credentials
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (!signInError && signInData) {
        // Successfully signed in
        return signInData;
      }
      
      // If sign in failed, try to sign up (development mode - auto-create users)
      if (signInError && (signInError.message.includes('Invalid login credentials') || signInError.message.includes('User not found'))) {
        console.log('User not found, creating new account (development mode)...');
        
        // Sign up new user
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: undefined, // Don't require email confirmation in dev
            data: {
              // Store email in user metadata
              email: email
            }
          }
        });
        
        if (signUpError) {
          // If sign up fails, it might be because user already exists but password is wrong
          if (signUpError.message.includes('already registered')) {
            throw new Error('User already exists. Please check your password.');
          }
          throw signUpError;
        }
        
        // After sign up, automatically sign in
        if (signUpData.user) {
          const { data: autoSignInData, error: autoSignInError } = await supabase.auth.signInWithPassword({
            email,
            password
          });
          
          if (autoSignInError) {
            console.warn('Auto sign-in after sign-up failed:', autoSignInError);
            // User will be created via getOrCreateTaliaUser when session is set
            return signUpData;
          }
          
          return autoSignInData;
        }
        
        return signUpData;
      }
      
      // Other errors
      throw signInError;
    } catch (err) {
      setError(err);
      console.error('Error signing in with password:', err.message);
      throw err;
    } finally {
      setLoading(false);
    }
    
  };

  const signOut = async () => {
    try {
      setLoading(true);
      setError(null);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setSession(null);
      GraphQLUtils.clearUserContext();
    } catch (err) {
      setError(err);
      console.error('Error signing out:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    session,
    loading,
    error,
    signInWithEmail,
    signInWithPassword,
    enterDevSession,
    signOut,
    updateUserRole,
    isDevMode,
    devUsers: DEV_USERS,
    switchDevUser,
  };

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
};
