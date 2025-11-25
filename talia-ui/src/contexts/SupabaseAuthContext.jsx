import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
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
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      
      if (session?.user) {
        // Get or create Talia user record
        const taliaUser = await getOrCreateTaliaUser(session.user);
        setUser({
          ...session.user,
          taliaUserId: taliaUser?.talia_user_id || null,
          taliaUser: taliaUser
        });
      } else {
        setUser(null);
      }
      
      setLoading(false);
    }).catch((err) => {
      console.error('Error getting session:', err);
      setError(err);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        
        if (session?.user) {
          // Get or create Talia user record
          const taliaUser = await getOrCreateTaliaUser(session.user);
          setUser({
            ...session.user,
            taliaUserId: taliaUser?.talia_user_id || null,
            taliaUser: taliaUser
          });
        } else {
          setUser(null);
        }
        
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
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
    signOut,
    // Add other Supabase auth methods as needed (e.g., signUp, resetPassword)
  };

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
};
