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

  const roleClass = `dashboard-user-profile__role dashboard-user-profile__role--${(user.role || 'user').toLowerCase()}`;

  return (
    <div className="dashboard-user-profile">
      {/* User Info */}
      <div 
        className="dashboard-user-profile__info"
        onClick={() => setShowProfile(!showProfile)}
      >
        {/* Avatar */}
        <div className="dashboard-user-profile__avatar">
          {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
        </div>
        
        {!isCollapsed && (
          <div className="dashboard-user-profile__details">
            <div className="dashboard-user-profile__name">
              {user.name || user.email}
            </div>
            <div className={roleClass}>
              {getRoleDisplayName(user.role)}
            </div>
          </div>
        )}
        
        {/* Dropdown Arrow */}
        {!isCollapsed && (
          <div className={`dashboard-user-profile__dropdown ${showProfile ? 'dashboard-user-profile__dropdown--open' : ''}`}>
            ▼
          </div>
        )}
      </div>

      {/* Profile Dropdown */}
      {showProfile && !isCollapsed && (
        <div className="dashboard-user-profile__dropdown-panel">
          {/* User Details */}
          <div className="dashboard-user-profile__detail-group">
            <div className="dashboard-user-profile__detail-label">Email</div>
            <div className="dashboard-user-profile__detail-value">
              {user.email}
            </div>
          </div>

          {/* Role */}
          <div className="dashboard-user-profile__detail-group">
            <div className="dashboard-user-profile__detail-label">Role</div>
            <div className="dashboard-user-profile__detail-row">
              <div className={roleClass}>
                {getRoleDisplayName(user.role || 'user')}
              </div>
              {user.role !== 'ADMIN' && user.email !== 'admin@talia.dev' && (
                <span className="dashboard-user-profile__hint">
                  (Use Quick Admin Access)
                </span>
              )}
            </div>
          </div>

          {/* Quick Preferences */}
          <div className="dashboard-user-profile__settings-group">
            <div className="dashboard-user-profile__settings-title">Quick Settings</div>
            
            {/* Theme Toggle */}
            <div className="dashboard-user-profile__settings-row">
              <span>Theme</span>
              <select
                className="dashboard-user-profile__settings-select"
                value={user.preferences?.theme || 'default'}
                onChange={(e) => handlePreferenceChange('theme', e.target.value)}
              >
                <option value="default">Default</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>

            {/* Font Size */}
            <div className="dashboard-user-profile__settings-row">
              <span>Font Size</span>
              <select
                className="dashboard-user-profile__settings-select"
                value={user.preferences?.fontSize || 12}
                onChange={(e) => handlePreferenceChange('fontSize', parseInt(e.target.value))}
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
              className={`dashboard-user-profile__action-btn dashboard-user-profile__action-btn--warning`}
            >
              {switchingToAdmin ? 'Switching to Admin...' : '🔑 Quick Admin Access (Dev)'}
            </button>
          )}

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            disabled={switchingToAdmin}
            className="dashboard-user-profile__action-btn dashboard-user-profile__action-btn--danger"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
