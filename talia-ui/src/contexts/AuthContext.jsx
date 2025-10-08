import React, { createContext, useContext, useEffect, useState } from 'react';
import db from '../lib/db';
import userMappingService from '../services/UserMappingService';
import taliaUserService from '../services/TaliaUserService';

// InstantDB version and API validation
const validateInstantDBAPI = () => {
  console.log('🔍 Validating InstantDB API...');
  
  // Check if db object exists
  if (!db) {
    throw new Error('InstantDB not initialized - db object is null');
  }
  
  // Check if auth object exists
  if (!db.auth) {
    throw new Error('InstantDB auth not available - db.auth is null');
  }
  
  // Check required auth methods
  const requiredMethods = ['sendMagicCode', 'signInWithMagicCode', 'signOut'];
  const missingMethods = requiredMethods.filter(method => typeof db.auth[method] !== 'function');
  
  if (missingMethods.length > 0) {
    throw new Error(`InstantDB auth missing methods: ${missingMethods.join(', ')}`);
  }
  
  // Log available methods for debugging
  const availableMethods = Object.keys(db.auth).filter(key => typeof db.auth[key] === 'function');
  console.log('✅ InstantDB auth methods available:', availableMethods);
  
  // Check if we have the expected API structure
  const expectedMethods = ['sendMagicCode', 'signInWithMagicCode', 'signOut', 'signInWithToken'];
  const hasExpectedAPI = expectedMethods.every(method => availableMethods.includes(method));
  
  if (!hasExpectedAPI) {
    console.warn('⚠️ InstantDB API may have changed. Expected methods:', expectedMethods);
    console.warn('⚠️ Available methods:', availableMethods);
  }
  
  console.log('✅ InstantDB API validation passed');
  return true;
};

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Validate InstantDB API on component mount
  useEffect(() => {
    try {
      validateInstantDBAPI();
    } catch (err) {
      console.error('❌ InstantDB API validation failed:', err);
      setError({
        message: `InstantDB API validation failed: ${err.message}`,
        originalError: err
      });
      setLoading(false);
      return;
    }
  }, []);

  // Use InstantDB's auth hook with error handling
  let authHookResult;
  try {
    authHookResult = db.useAuth();
  } catch (err) {
    console.error('❌ Error using InstantDB auth hook:', err);
    setError({
      message: `Authentication hook error: ${err.message}`,
      originalError: err
    });
    setLoading(false);
    authHookResult = { isLoading: false, user: null, error: err };
  }
  
  const { isLoading, user: instantUser, error: authError } = authHookResult;

  useEffect(() => {
    console.log('🔄 Auth state changed:', { 
      isLoading, 
      hasInstantUser: !!instantUser, 
      hasAuthError: !!authError,
      instantUserId: instantUser?.id,
      instantUserEmail: instantUser?.email
    });

    if (authError) {
      console.error('❌ Auth error from InstantDB:', authError);
      setError(authError);
      setLoading(false);
      return;
    }

    if (isLoading) {
      console.log('⏳ Auth loading...');
      setLoading(true);
      return;
    }

    if (instantUser) {
      console.log('👤 InstantDB user authenticated:', instantUser);
      
      // Get or create taliaUserId for this user
      const handleUserAuth = async () => {
        try {
        const taliaUserId = await userMappingService.getOrCreateMapping(
          instantUser.id
        );
          
          console.log(`✅ User authenticated with taliaUserId: ${taliaUserId}`);
          
          // Create or get Talia user
          let taliaUser = taliaUserService.getTaliaUserById(taliaUserId);
          if (!taliaUser) {
            // For development: First user gets admin role, others get user role
            const isFirstUser = taliaUserId === 1000;
            const userRole = isFirstUser ? 'admin' : 'user';
            
            taliaUser = taliaUserService.createTaliaUser(taliaUserId, instantUser.email, userRole);
            console.log(`✅ Created Talia user: ${taliaUserId} with role: ${userRole}`);
          } else {
            console.log(`✅ Found existing Talia user: ${taliaUserId} with role: ${taliaUser.taliaRole}`);
          }
          
          // Create user data with taliaUserId as primary identifier
          const userData = {
            id: instantUser.id, // Keep InstantDB ID for auth
            taliaUserId: taliaUserId, // Primary identifier for all user data
            email: instantUser.email,
            name: instantUser.name || instantUser.email.split('@')[0],
            role: taliaUser.taliaRole, // Use role from Talia user system
            preferences: {
              theme: 'default',
              fontSize: 12,
              fontFamily: 'Inter',
              spacingMode: 'default'
            },
            createdAt: new Date(),
            lastLogin: new Date(),
            isActive: true
          };
          
          console.log('✅ User data created with taliaUserId:', userData);
          setUser(userData);
          setLoading(false);
          
        } catch (error) {
          console.error('❌ Error getting/creating taliaUserId:', error);
          setError({
            message: `Failed to get user ID: ${error.message}`,
            originalError: error
          });
          setLoading(false);
        }
      };

      handleUserAuth();
    } else {
      console.log('👤 No user authenticated');
      setUser(null);
      setLoading(false);
    }
  }, [instantUser, isLoading, authError]);

  const createUserRecord = async (instantUser) => {
    try {
      console.log('👤 Creating user record for:', instantUser.email);
      
      const userData = {
        id: instantUser.id,
        email: instantUser.email,
        name: instantUser.name || instantUser.email.split('@')[0],
        role: 'user', // Default role
        preferences: {
          theme: 'default',
          fontSize: 12,
          fontFamily: 'Inter',
          spacingMode: 'default'
        },
        createdAt: new Date(),
        lastLogin: new Date(),
        isActive: true
      };

      console.log('📝 User data to create:', userData);

      await db.transact([
        db.tx.users[instantUser.id].update(userData)
      ]);

      console.log('✅ User record created successfully');
      setUser(userData);
    } catch (err) {
      console.error('❌ Error creating user record:', err);
      setError({
        message: `Failed to create user record: ${err.message}`,
        originalError: err
      });
    }
  };

  const signIn = async (email) => {
    try {
      setError(null);
      
      // Validate API before use
      if (!db.auth || typeof db.auth.sendMagicCode !== 'function') {
        throw new Error('InstantDB sendMagicCode method not available. Please check your InstantDB version.');
      }
      
      console.log('📧 Sending magic code to:', email);
      await db.auth.sendMagicCode({ email });
      console.log('✅ Magic code sent successfully');
    } catch (err) {
      console.error('❌ Sign in error:', err);
      setError(err);
      throw err;
    }
  };

  const verifyCode = async (email, code) => {
    try {
      setError(null);
      
      // Validate API before use
      if (!db.auth || typeof db.auth.signInWithMagicCode !== 'function') {
        throw new Error('InstantDB signInWithMagicCode method not available. Please check your InstantDB version.');
      }
      
      console.log('🔐 Verifying magic code for:', email);
      await db.auth.signInWithMagicCode({ email, code });
      console.log('✅ Magic code verified successfully');
    } catch (err) {
      console.error('❌ Code verification error:', err);
      setError(err);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      await db.auth.signOut();
      setUser(null);
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  const updateUserPreferences = async (preferences) => {
    if (!user) return;

    try {
      const updatedPreferences = { ...user.preferences, ...preferences };
      await db.transact([
        db.tx.users[user.id].update({
          preferences: updatedPreferences,
          lastLogin: new Date()
        })
      ]);
      
      setUser(prev => ({
        ...prev,
        preferences: updatedPreferences
      }));
    } catch (err) {
      console.error('Error updating user preferences:', err);
      setError(err);
    }
  };

  const switchRole = (newRole) => {
    if (!user) return;
    
    console.log('Switching role from', user.role, 'to', newRole);
    setUser(prev => ({
      ...prev,
      role: newRole
    }));
  };

  const value = {
    user,
    loading,
    error,
    signIn,
    verifyCode,
    signOut,
    updateUserPreferences,
    switchRole
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
