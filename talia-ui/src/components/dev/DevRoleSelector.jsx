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
  const { user, updateUserRole, isDevMode, devUsers, switchDevUser } = useSupabaseAuth();
  const [currentRole, setCurrentRole] = useState(user?.role || 'ADMIN');
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    if (!isDevMode) return;
    if (user?.role) {
      setCurrentRole(user.role);
    }
  }, [isDevMode, user?.role]);

  if (!isDevMode) {
    return null;
  }

  const roles = ['ADMIN', 'MANAGER', 'USER', 'GUEST'];

  const handleRoleChange = (newRole) => {
    setCurrentRole(newRole);
    if (updateUserRole) {
      updateUserRole(newRole);
      window.location.reload();
    }
  };

  const handleUserSwitch = (devUserId) => {
    if (switchDevUser) {
      switchDevUser(devUserId);
      window.location.reload();
    }
  };

  const userSwitcherBlock = (
    <>
      <div className="dev-role-selector__section-label">Switch User</div>
      <div className="dev-role-selector__users">
        {(devUsers || []).map((devUser) => (
          <button
            key={devUser.id}
            onClick={() => handleUserSwitch(devUser.id)}
            className={`dev-role-selector__user-btn ${user?.id === devUser.id ? 'dev-role-selector__user-btn--active' : ''}`}
            title={`${devUser.email} (${devUser.role})`}
          >
            <span className="dev-role-selector__user-name">{devUser.name}</span>
            <span className="dev-role-selector__user-role">{devUser.role}</span>
          </button>
        ))}
      </div>
    </>
  );

  if (inDropdown) {
    return (
      <div className="dev-role-selector">
        <div className="dev-role-selector__info">
          <div className="dev-role-selector__info-text">
            User: <strong>{user?.name || user?.email}</strong> &middot; Role: <strong>{currentRole}</strong>
          </div>
        </div>

        {userSwitcherBlock}

        <div className="dev-role-selector__section-label">Override Role</div>
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

  if (isCollapsed) {
    return (
      <div
        className="dev-role-selector dev-role-selector--collapsed"
        onClick={() => setIsCollapsed(false)}
        title="Click to expand dev tools"
      >
        <div className="dev-role-selector__collapsed-label">
          🔧 DEV
        </div>
        <div className="dev-role-selector__collapsed-role">
          {user?.name || currentRole}
        </div>
      </div>
    );
  }

  return (
    <div className="dev-role-selector">
      <div className="dev-role-selector__header">
        <div className="dev-role-selector__title">
          🔧 Dev Tools
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
          User: <strong>{user?.name || user?.email}</strong> &middot; Role: <strong>{currentRole}</strong>
        </div>
      </div>

      {userSwitcherBlock}

      <div className="dev-role-selector__section-label">Override Role</div>
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
