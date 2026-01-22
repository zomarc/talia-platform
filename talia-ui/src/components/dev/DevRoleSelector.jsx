/**
 * DevRoleSelector - Development-only role selection panel
 * 
 * Allows developers to quickly switch between user roles for testing.
 * Only visible in development mode (import.meta.env.DEV === true).
 */

import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '../../contexts/SupabaseAuthContext';
import '../../styles/dev-components.css';

const DevRoleSelector = ({ inDropdown = false }) => {
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

  // When in dropdown, always show expanded (no collapsed state)
  if (inDropdown) {
    return (
      <div className="dev-role-selector">
        <div className="dev-role-selector__info">
          <div className="dev-role-selector__info-text">
            Current Role: <strong>{currentRole}</strong>
          </div>
          {user?.email && (
            <div className="dev-role-selector__info-text">
              User: {user.email}
            </div>
          )}
        </div>

        <div className="dev-role-selector__roles">
          {roles.map((role) => (
            <button
              key={role}
              onClick={() => handleRoleChange(role)}
              className={`dev-role-selector__role-btn ${currentRole === role ? 'dev-role-selector__role-btn--active' : ''}`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Standalone mode (not in dropdown) - can be collapsed
  if (isCollapsed) {
    return (
      <div
        className="dev-role-selector dev-role-selector--collapsed"
        onClick={() => setIsCollapsed(false)}
        title="Click to expand dev role selector"
      >
        <div className="dev-role-selector__collapsed-label">
          🔧 DEV
        </div>
        <div className="dev-role-selector__collapsed-role">
          {currentRole}
        </div>
      </div>
    );
  }

  return (
    <div className="dev-role-selector">
      <div className="dev-role-selector__header">
        <div className="dev-role-selector__title">
          🔧 Dev Role Selector
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="dev-role-selector__close-btn"
          title="Collapse"
        >
          ×
        </button>
      </div>
      
      <div className="dev-role-selector__info">
        <div className="dev-role-selector__info-text">
          Current Role: <strong>{currentRole}</strong>
        </div>
        {user?.email && (
          <div className="dev-role-selector__info-text">
            User: {user.email}
          </div>
        )}
      </div>

      <div className="dev-role-selector__roles">
        {roles.map((role) => (
          <button
            key={role}
            onClick={() => handleRoleChange(role)}
            className={`dev-role-selector__role-btn ${currentRole === role ? 'dev-role-selector__role-btn--active' : ''}`}
          >
            {role}
          </button>
        ))}
      </div>

      <div className="dev-role-selector__footer">
        ⚠️ Development only
      </div>
    </div>
  );
};

export default DevRoleSelector;
