/**
 * DevRoleSelector - Development-only role selection panel
 * 
 * Allows developers to quickly switch between user roles for testing.
 * Only visible in development mode (import.meta.env.DEV === true).
 */

import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '../../contexts/SupabaseAuthContext';

const DevRoleSelector = () => {
  const { user, updateUserRole, isDevMode } = useSupabaseAuth();
  const [currentRole, setCurrentRole] = useState(user?.role || 'ADMIN');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Only show in dev mode
  if (!isDevMode) {
    return null;
  }

  // Update current role when user changes
  useEffect(() => {
    if (user?.role) {
      setCurrentRole(user.role);
    }
  }, [user?.role]);

  const roles = ['ADMIN', 'MANAGER', 'USER', 'GUEST'];

  const handleRoleChange = (newRole) => {
    setCurrentRole(newRole);
    if (updateUserRole) {
      updateUserRole(newRole);
      // Force page refresh to update all components
      window.location.reload();
    }
  };

  if (isCollapsed) {
    return (
      <div
        style={{
          position: 'fixed',
          top: '50px',
          right: '10px',
          zIndex: 9998,
          background: '#fff3cd',
          border: '2px solid #ffc107',
          borderRadius: '8px',
          padding: '8px',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}
        onClick={() => setIsCollapsed(false)}
        title="Click to expand dev role selector"
      >
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#856404' }}>
          🔧 DEV
        </div>
        <div style={{ fontSize: '10px', color: '#856404', marginTop: '2px' }}>
          {currentRole}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '50px',
        right: '10px',
        zIndex: 9998,
        background: '#fff3cd',
        border: '2px solid #ffc107',
        borderRadius: '8px',
        padding: '12px',
        minWidth: '200px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#856404' }}>
          🔧 Dev Role Selector
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            color: '#856404',
            padding: '0',
            lineHeight: '1'
          }}
          title="Collapse"
        >
          ×
        </button>
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '10px', color: '#856404', marginBottom: '4px' }}>
          Current Role: <strong>{currentRole}</strong>
        </div>
        {user?.email && (
          <div style={{ fontSize: '10px', color: '#856404' }}>
            User: {user.email}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {roles.map((role) => (
          <button
            key={role}
            onClick={() => handleRoleChange(role)}
            style={{
              padding: '6px 12px',
              background: currentRole === role ? '#ffc107' : '#fff',
              color: currentRole === role ? '#000' : '#856404',
              border: `1px solid ${currentRole === role ? '#ffc107' : '#ffc107'}`,
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: currentRole === role ? 'bold' : 'normal',
              transition: 'all 0.2s',
              textAlign: 'left'
            }}
          >
            {role}
          </button>
        ))}
      </div>

      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #ffc107', fontSize: '9px', color: '#856404' }}>
        ⚠️ Development only
      </div>
    </div>
  );
};

export default DevRoleSelector;
