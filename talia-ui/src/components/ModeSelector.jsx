/**
 * ModeSelector - Discrete mode selection component
 * 
 * Provides a clean, themed interface for the main app mode.
 * Includes source/version information and Dev Role Selector dropdown.
 */

import React, { useState, useEffect } from 'react';
import DevRoleSelector from './dev/DevRoleSelector';
import { DASHBOARD_OPEN_PANEL_EVENT } from './dockview/eventConstants';
import { GraphQLUtils } from '../lib/apolloClient';
import { canAccessPrivilegedPanels, normalizeRole } from '../utils/roleUtils';
import { getTaliaVersionDisplayLabel } from '../config/taliaVersion';
import '../styles/mode-selector.css';

const resolveEnvSourceLabel = () => {
  const raw =
    import.meta.env.VITE_ENVIRONMENT ||
    (import.meta.env.DEV ? 'local' : 'production');
  return String(raw || 'local').toLowerCase();
};

const normalizeInstanceLabel = (value) => {
  const s = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  return s || null;
};

const ModeSelector = ({ currentMode, onModeChange }) => {
  const [showDevDropdown, setShowDevDropdown] = useState(false);
  const [source, setSource] = useState(() => resolveEnvSourceLabel());
  const [userRole, setUserRole] = useState(() => normalizeRole(GraphQLUtils.getUserRole() || 'USER'));

  // Prefer talia-instance.json (stamped at deploy pack time) so the header matches the host you
  // deployed to, even if VITE_ENVIRONMENT was baked for another target (e.g. same dist to MVP).
  useEffect(() => {
    let cancelled = false;
    const rawBase = import.meta.env.BASE_URL || '/';
    const lead = rawBase.startsWith('/') ? rawBase : `/${rawBase}`;
    const prefix = lead.endsWith('/') ? lead : `${lead}/`;
    const path = `${prefix}talia-instance.json`.replace(/([^:]\/)\/+/g, '$1');
    const url = new URL(path, window.location.origin).href;

    fetch(url, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data || typeof data.deployTarget !== 'string') return;
        const fromManifest = normalizeInstanceLabel(data.deployTarget);
        if (fromManifest) setSource(fromManifest);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const syncRole = () => setUserRole(normalizeRole(GraphQLUtils.getUserRole() || 'USER'));
    const onStorage = (event) => {
      if (!event || event.key === 'userRole' || event.key === 'devUserRole') syncRole();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', syncRole);
    syncRole();
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', syncRole);
    };
  }, []);
  const versionLabel = getTaliaVersionDisplayLabel();

  const sourceClassKey = ['local', 'staging', 'mvp', 'production'].includes(source) ? source : 'unknown';

  const isDevMode = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_MODE === 'true';
  const canOpenPrivileged = canAccessPrivilegedPanels(userRole);

  const handleModeClick = () => {
    onModeChange('app');
    // Close dropdown when switching modes
    if (showDevDropdown) {
      setShowDevDropdown(false);
    }
  };

  const handleAppModeClick = () => {
    handleModeClick();
  };

  const handleDevDropdownToggle = (e) => {
    e.stopPropagation();
    setShowDevDropdown(!showDevDropdown);
  };

  const openDashboardPanel = (componentType, title) => {
    window.dispatchEvent(
      new CustomEvent(DASHBOARD_OPEN_PANEL_EVENT, {
        detail: {
          componentType,
          title,
        },
      })
    );
    setShowDevDropdown(false);
  };

  const handleOpenAdminDashboard = () => openDashboardPanel('admin-dashboard', 'Admin Dashboard');
  const handleOpenTestWorkbench = () => openDashboardPanel('test-workbench-panel', 'Test Workbench');
  const handleOpenDataManagement = () => openDashboardPanel('data-management-panel', 'Data Management');

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showDevDropdown) return;

    const handleClickOutside = (event) => {
      if (!event.target.closest('.mode-selector__dev-area')) {
        setShowDevDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDevDropdown]);

  return (
    <div className="mode-selector">
      <div className="mode-selector__container">
        {/* Mode Button */}
        <div className="mode-selector__modes">
          <div className="mode-selector__app-wrapper">
            <button
              className={`mode-selector__btn mode-selector__btn--app ${currentMode === 'app' ? 'mode-selector__btn--active' : ''}`}
              onClick={handleAppModeClick}
              title="App Mode"
              aria-label="Switch to app mode"
            >
              <span className="mode-selector__icon">🚀</span>
            </button>
          </div>
        </div>

        {/* Source & Version Info */}
        <div className="mode-selector__info">
          <div className="mode-selector__source">
            <span className="mode-selector__source-label">Source:</span>
            <span className={`mode-selector__source-value mode-selector__source-value--${sourceClassKey}`}>
              {source}
            </span>
          </div>
          <div className="mode-selector__version">
            <span className="mode-selector__version-label">v</span>
            <span className="mode-selector__version-value">{versionLabel}</span>
          </div>
        </div>

        {/* Dev Tools Toggle Button (only in dev mode) */}
        {isDevMode && currentMode === 'app' && (
          <div className="mode-selector__dev-area">
            <button
              className={`mode-selector__dev-toggle ${showDevDropdown ? 'mode-selector__dev-toggle--open' : ''}`}
              onClick={handleDevDropdownToggle}
              title={showDevDropdown ? "Hide Development Tools" : "Show Development Tools"}
            >
              <span className="mode-selector__dev-toggle-icon">🔧</span>
            </button>

            {/* Dev Role Selector Dropdown */}
            {showDevDropdown && (
              <div className="mode-selector__dev-dropdown">
                <div className="mode-selector__dev-header">
                  <span className="mode-selector__dev-title">Development Tools</span>
                  <button
                    type="button"
                    className="mode-selector__dev-open-admin"
                    onClick={handleOpenAdminDashboard}
                    title="Open Admin Dashboard panel"
                    disabled={!canOpenPrivileged}
                  >
                    Admin
                  </button>
                  <button
                    className="mode-selector__dev-close"
                    onClick={() => setShowDevDropdown(false)}
                    title="Close"
                  >
                    ×
                  </button>
                </div>
                <div className="mode-selector__dev-content">
                  <DevRoleSelector inDropdown={true} />
                  <div className="mode-selector__dev-shortcuts">
                    <button
                      type="button"
                      className="mode-selector__dev-shortcut-btn"
                      onClick={handleOpenAdminDashboard}
                      title="Open Admin Dashboard panel"
                      disabled={!canOpenPrivileged}
                    >
                      ⚙️ Open Admin Dashboard
                    </button>
                    {canOpenPrivileged && (
                      <>
                        <button
                          type="button"
                          className="mode-selector__dev-shortcut-btn"
                          onClick={handleOpenTestWorkbench}
                          title="Open Test Workbench panel"
                        >
                          🧪 Open Test Workbench
                        </button>
                        <button
                          type="button"
                          className="mode-selector__dev-shortcut-btn"
                          onClick={handleOpenDataManagement}
                          title="Open Data Management panel"
                        >
                          📊 Open Data Management
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModeSelector;
