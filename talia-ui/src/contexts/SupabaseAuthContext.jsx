import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { GraphQLUtils } from '../lib/apolloClient';
// GraphQL queries disabled during database restoration
// TODO: Re-enable GraphQL queries when database is restored
// import { useQuery } from '@apollo/client';
// import { GET_TALIA_USER_BY_EMAIL } from '../graphql/queries';

const SupabaseAuthContext = createContext();

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
          // Get or create Talia user record (with timeout to prevent hanging)
          const taliaUserPromise = getOrCreateTaliaUser(session.user);
          const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 3000));
          const taliaUser = await Promise.race([taliaUserPromise, timeoutPromise]);
          
          if (!isMounted) return;
          
          // Determine user role (admin@talia.dev gets ADMIN role in dev mode)
          let userRole = 'USER';
          if (session.user.email === 'admin@talia.dev') {
            userRole = 'ADMIN';
          }
          
          // Set role in localStorage for GraphQL context
          GraphQLUtils.setUserContext({
            role: userRole,
            email: session.user.email,
            id: session.user.id
          });
          
          setUser({
            ...session.user,
            taliaUserId: taliaUser?.talia_user_id || null,
            taliaUser: taliaUser,
            role: userRole
          });
          
          console.log('✅ User set:', session.user.email, 'Role:', userRole);
        } catch (error) {
          console.error('❌ Error processing user:', error);
          // Even if there's an error, set the user so auth can proceed
          if (isMounted && session?.user) {
            const userRole = session.user.email === 'admin@talia.dev' ? 'ADMIN' : 'USER';
            GraphQLUtils.setUserContext({
              role: userRole,
              email: session.user.email,
              id: session.user.id
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
        setUser(null);
        GraphQLUtils.clearUserContext();
      }
      
      // Always set loading to false, even if there was an error
      if (isMounted) {
        setLoading(false);
      }
    };

    // Listen for auth state changes FIRST (this will also trigger on initial load)
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth state changed:', event, session?.user?.email || 'no session');
        
        // Clear timeout since we got an auth event
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        await processSession(session, event);
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
        if (isMounted) {
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
  }, []);



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

  const signInWithPassword = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      
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
    
    // Return the sign-in result (data will be set by auth state change listener)
    return signInData;
  };

  const signOut = async () => {
    try {
      setLoading(true);
      setError(null);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setSession(null);
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
    signOut,
    // Add other Supabase auth methods as needed (e.g., signUp, resetPassword)
  };

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
};
