import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useQuery } from '@apollo/client';
import { GET_TALIA_USER_BY_EMAIL } from '../graphql/queries'; // Assuming this query exists or will be created

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

  useEffect(() => {
    const { data: { session } } = supabase.auth.getSession();
    setSession(session);
    setUser(session?.user ?? null);
    setLoading(false);

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      authListener.unsubscribe();
    };
  }, []);

  // Fetch Talia user data from GraphQL once Supabase user is available
  // This assumes a GraphQL endpoint is set up to query Supabase data
  const { data: taliaUserData, loading: taliaUserLoading, error: taliaUserError } = useQuery(
    GET_TALIA_USER_BY_EMAIL,
    {
      variables: { email: user?.email },
      skip: !user?.email,
      fetchPolicy: 'network-only', // Ensure we get the latest data
    }
  );

  useEffect(() => {
    if (user && taliaUserData?.taliaUserByEmail) {
      // Merge Supabase user data with Talia-specific user data from GraphQL
      setUser(prevUser => ({
        ...prevUser,
        taliaUserId: taliaUserData.taliaUserByEmail.id, // Assuming 'id' is the taliaUserId
        role: taliaUserData.taliaUserByEmail.role,
        preferences: taliaUserData.taliaUserByEmail.preferences,
        // Add other Talia-specific fields as needed
      }));
    } else if (user && !taliaUserLoading && !taliaUserData?.taliaUserByEmail) {
      // If Supabase user exists but no Talia user found, create a default one
      // This part would typically involve a GraphQL mutation to create the user
      // For now, we'll just log a message.
      console.warn('Supabase user authenticated, but no corresponding Talia user found in GraphQL. A default user might need to be created.');
      // You might want to trigger a mutation here to create the Talia user
      // For now, we'll assign a default role and preferences
      setUser(prevUser => ({
        ...prevUser,
        taliaUserId: null, // No Talia ID yet
        role: 'user', // Default role
        preferences: {
          theme: 'default',
          fontSize: 12,
          fontFamily: 'Inter',
          spacingMode: 'default'
        },
      }));
    }
  }, [user, taliaUserData, taliaUserLoading]);


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
    loading: loading || taliaUserLoading,
    error: error || taliaUserError,
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
