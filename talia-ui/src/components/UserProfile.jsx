import React, { useState } from 'react';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';
import { GraphQLUtils } from '../lib/apolloClient';

const UserProfile = ({ isCollapsed, onToggle }) => {
  const { user, signOut, signInWithPassword } = useSupabaseAuth();
  const [showProfile, setShowProfile] = useState(false);
  const [switchingToAdmin, setSwitchingToAdmin] = useState(false);

  if (!user) return null;

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleQuickAdminAccess = async () => {
    try {
      setSwitchingToAdmin(true);
      
      // Check if already admin
      if (user?.email === 'admin@talia.dev' && user?.role === 'ADMIN') {
        alert('You are already logged in as administrator.');
        setSwitchingToAdmin(false);
        return;
      }
      
      // Sign in as admin directly (will sign out current user automatically)
      const adminEmail = 'admin@talia.dev';
      const adminPassword = 'admin123';
      
      console.log('🔑 Quick admin access: signing in as', adminEmail);
      
      // Sign in as admin (Supabase will handle signing out the current user)
      const result = await signInWithPassword(adminEmail, adminPassword);
      
      if (result?.user) {
        // The auth state change listener will handle setting the role
        // But we also set it here to ensure it's set immediately
        GraphQLUtils.setUserContext({
          role: 'ADMIN',
          email: adminEmail,
          id: result.user.id || user?.id || 'admin-dev'
        });
        
        console.log('✅ Quick admin access: signed in successfully');
        // Don't reload - let the auth state change handle the UI update
      } else {
        throw new Error('Sign in returned no user');
      }
      
      setSwitchingToAdmin(false);
    } catch (error) {
      console.error('❌ Quick admin access error:', error);
      setSwitchingToAdmin(false);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      alert(`Failed to switch to admin: ${errorMessage}\n\nPlease try:\n1. Signing out first\n2. Using the admin button on the landing page`);
    }
  };

  const handlePreferenceChange = (key, value) => {
    // TODO: Implement preference updates via GraphQL or Supabase
    console.log('Preference change requested:', key, value);
    // For now, preferences can be stored in localStorage
    try {
      const prefs = JSON.parse(localStorage.getItem('userPreferences') || '{}');
      prefs[key] = value;
      localStorage.setItem('userPreferences', JSON.stringify(prefs));
    } catch (error) {
      console.warn('Failed to save preference:', error);
    }
  };

  // Role management removed - roles are now determined by email in SupabaseAuthContext
  // Use Quick Admin Access button to switch to admin role

  const getRoleDisplayName = (role) => {
    const roleMap = {
      'admin': 'Administrator',
      'manager': 'Manager', 
      'user': 'User',
      'guest': 'Guest'
    };
    return roleMap[role] || role;
  };

  const getRoleColor = (role) => {
    const colorMap = {
      'admin': '#dc2626',
      'manager': '#ea580c',
      'user': '#2563eb',
      'guest': '#6b7280'
    };
    return colorMap[role] || '#6b7280';
  };

  return (
    <div style={{
      borderTop: '1px solid #e5e7eb',
      padding: '12px',
      background: '#f9fafb'
    }}>
      {/* User Info */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          padding: '8px',
          borderRadius: '6px',
          transition: 'background-color 0.2s'
        }}
        onClick={() => setShowProfile(!showProfile)}
        onMouseEnter={(e) => e.target.style.background = '#e5e7eb'}
        onMouseLeave={(e) => e.target.style.background = 'transparent'}
      >
        {/* Avatar */}
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: '#3b82f6',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          fontWeight: '500',
          flexShrink: 0
        }}>
          {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
        </div>
        
        {!isCollapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '14px',
              fontWeight: '500',
              color: '#1f2937',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {user.name || user.email}
            </div>
            <div style={{
              fontSize: '12px',
              color: getRoleColor(user.role),
              fontWeight: '500'
            }}>
              {getRoleDisplayName(user.role)}
            </div>
          </div>
        )}
        
        {/* Dropdown Arrow */}
        {!isCollapsed && (
          <div style={{
            fontSize: '12px',
            color: '#6b7280',
            transform: showProfile ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }}>
            ▼
          </div>
        )}
      </div>

      {/* Profile Dropdown */}
      {showProfile && !isCollapsed && (
        <div style={{
          marginTop: '8px',
          padding: '12px',
          background: 'white',
          borderRadius: '6px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          {/* User Details */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              marginBottom: '4px'
            }}>
              Email
            </div>
            <div style={{
              fontSize: '14px',
              color: '#1f2937',
              wordBreak: 'break-all'
            }}>
              {user.email}
            </div>
          </div>

          {/* Role */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              marginBottom: '4px'
            }}>
              Role
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{
                fontSize: '14px',
                color: getRoleColor(user.role || 'user'),
                fontWeight: '500'
              }}>
                {getRoleDisplayName(user.role || 'user')}
              </div>
              {user.role !== 'ADMIN' && user.email !== 'admin@talia.dev' && (
                <span style={{
                  fontSize: '10px',
                  color: '#6b7280',
                  fontStyle: 'italic'
                }}>
                  (Use Quick Admin Access)
                </span>
              )}
            </div>
          </div>

          {/* Quick Preferences */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              marginBottom: '8px'
            }}>
              Quick Settings
            </div>
            
            {/* Theme Toggle */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px'
            }}>
              <span style={{ fontSize: '12px', color: '#374151' }}>Theme</span>
              <select
                value={user.preferences?.theme || 'default'}
                onChange={(e) => handlePreferenceChange('theme', e.target.value)}
                style={{
                  fontSize: '12px',
                  padding: '2px 6px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  background: 'white'
                }}
              >
                <option value="default">Default</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>

            {/* Font Size */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px'
            }}>
              <span style={{ fontSize: '12px', color: '#374151' }}>Font Size</span>
              <select
                value={user.preferences?.fontSize || 12}
                onChange={(e) => handlePreferenceChange('fontSize', parseInt(e.target.value))}
                style={{
                  fontSize: '12px',
                  padding: '2px 6px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  background: 'white'
                }}
              >
                <option value={8}>8px</option>
                <option value={10}>10px</option>
                <option value={12}>12px</option>
                <option value={14}>14px</option>
                <option value={16}>16px</option>
                <option value={18}>18px</option>
                <option value={20}>20px</option>
                <option value={24}>24px</option>
              </select>
            </div>
          </div>

          {/* Quick Admin Access Button (Dev Only) */}
          {user.role !== 'ADMIN' && user.email !== 'admin@talia.dev' && (
            <button
              onClick={handleQuickAdminAccess}
              disabled={switchingToAdmin}
              style={{
                width: '100%',
                background: switchingToAdmin ? '#9ca3af' : '#f59e0b',
                color: 'white',
                border: 'none',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '500',
                cursor: switchingToAdmin ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
                marginBottom: '8px'
              }}
              onMouseEnter={(e) => {
                if (!switchingToAdmin) e.target.style.background = '#d97706';
              }}
              onMouseLeave={(e) => {
                if (!switchingToAdmin) e.target.style.background = '#f59e0b';
              }}
            >
              {switchingToAdmin ? 'Switching to Admin...' : '🔑 Quick Admin Access (Dev)'}
            </button>
          )}

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            disabled={switchingToAdmin}
            style={{
              width: '100%',
              background: switchingToAdmin ? '#9ca3af' : '#dc2626',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '500',
              cursor: switchingToAdmin ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!switchingToAdmin) e.target.style.background = '#b91c1c';
            }}
            onMouseLeave={(e) => {
              if (!switchingToAdmin) e.target.style.background = '#dc2626';
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
