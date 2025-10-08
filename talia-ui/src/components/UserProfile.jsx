import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const UserProfile = ({ isCollapsed, onToggle }) => {
  const { user, signOut, updateUserPreferences, switchRole } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  const [showRoleManager, setShowRoleManager] = useState(false);

  if (!user) return null;

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handlePreferenceChange = (key, value) => {
    updateUserPreferences({ [key]: value });
  };

  const handleRoleChange = (newRole) => {
    if (newRole === user.role) return;
    
    // For demo purposes, we'll switch roles immediately
    // In a real app, this would require admin approval
    console.log('Switching role from', user.role, 'to', newRole);
    switchRole(newRole);
    setShowRoleManager(false);
  };

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
                color: getRoleColor(user.role),
                fontWeight: '500'
              }}>
                {getRoleDisplayName(user.role)}
              </div>
              <button
                onClick={() => setShowRoleManager(!showRoleManager)}
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: '#374151'
                }}
              >
                {showRoleManager ? 'Hide' : 'Change'}
              </button>
            </div>
          </div>

          {/* Role Manager */}
          {showRoleManager && (
            <div style={{
              marginBottom: '12px',
              padding: '8px',
              background: '#f9fafb',
              borderRadius: '4px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                fontSize: '11px',
                color: '#6b7280',
                marginBottom: '6px'
              }}>
                Request Role Change
              </div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {['admin', 'manager', 'user', 'guest'].map(role => (
                  <button
                    key={role}
                    onClick={() => handleRoleChange(role)}
                    disabled={role === user.role}
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      background: role === user.role ? '#e5e7eb' : '#3b82f6',
                      color: role === user.role ? '#9ca3af' : 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: role === user.role ? 'not-allowed' : 'pointer',
                      opacity: role === user.role ? 0.5 : 1
                    }}
                  >
                    {getRoleDisplayName(role)}
                  </button>
                ))}
              </div>
            </div>
          )}

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

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            style={{
              width: '100%',
              background: '#dc2626',
              color: 'white',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = '#b91c1c'}
            onMouseLeave={(e) => e.target.style.background = '#dc2626'}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
