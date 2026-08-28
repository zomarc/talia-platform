/**
 * ModeSelector - Discrete mode selection component
 *
 * Provides a clean, themed interface for the main app mode.
 * Includes source/version information (with instance host + connection dropdown)
 * and Dev Role Selector dropdown.
 */

import React, { useCallback, useEffect, useState } from 'react';
import DevRoleSelector from './dev/DevRoleSelector';
import { DASHBOARD_OPEN_PANEL_EVENT } from './dockview/eventConstants';
import { GraphQLUtils } from '../lib/apolloClient';
import { canAccessPrivilegedPanels, normalizeRole } from '../utils/roleUtils';
import { getTaliaVersionDisplayLabel } from '../config/taliaVersion';
import { trackedFetchGraphql } from '../services/data/trackedGraphql';
import {
  applyInstanceBrowserChrome,
  normalizeInstanceLabel,
  resolveDeployInstanceLabel,
  resolveEnvInstanceLabel,
} from '../lib/instanceIdentity';
import { IconApp, IconChevron, IconWrench } from './shared/StatusBarIcons';
import '../styles/mode-selector.css';

const resolveGraphqlEndpoint = () => {
  const fromEnv = import.meta.env.VITE_GRAPHQL_ENDPOINT;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim();
  if (typeof window === 'undefined') return '/api/graphql';
  return `${window.location.origin}/api/graphql`;
};

const readUiHostInfo = () => {
  if (typeof window === 'undefined') {
    return {
      host: '—',
      hostname: '—',
      port: '',
      origin: '—',
      protocol: '—',
    };
  }
  const { hostname, port, host, origin, protocol } = window.location;
  return {
    host: host || hostname || '—',
    hostname: hostname || '—',
    port: port || (protocol === 'https:' ? '443' : protocol === 'http:' ? '80' : ''),
    origin: origin || '—',
    protocol: (protocol || '').replace(':', '') || '—',
  };
};

const ModeSelector = ({ currentMode, onModeChange }) => {
  const [showDevDropdown, setShowDevDropdown] = useState(false);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [source, setSource] = useState(() => resolveEnvInstanceLabel());
  const [userRole, setUserRole] = useState(() => normalizeRole(GraphQLUtils.getUserRole() || 'USER'));
  const [uiHost, setUiHost] = useState(() => readUiHostInfo());
  const [graphqlEndpoint, setGraphqlEndpoint] = useState(() => resolveGraphqlEndpoint());
  const [connection, setConnection] = useState({
    status: 'unknown', // online | offline | checking | unknown
    detail: 'Not checked yet',
    checkedAt: null,
  });

  // Prefer talia-instance.json (stamped at deploy pack time) so the header matches the host you
  // deployed to, even if VITE_ENVIRONMENT was baked for another target (e.g. same dist to MVP).
  useEffect(() => {
    let cancelled = false;
    resolveDeployInstanceLabel().then((label) => {
      if (cancelled || !label) return;
      const normalized = normalizeInstanceLabel(label) || label;
      setSource(normalized);
      applyInstanceBrowserChrome(normalized);
    });
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

  const probeConnection = useCallback(async () => {
    const endpoint = resolveGraphqlEndpoint();
    setGraphqlEndpoint(endpoint);
    setUiHost(readUiHostInfo());
    setConnection((prev) => ({
      ...prev,
      status: 'checking',
      detail: 'Checking GraphQL…',
    }));
    try {
      await trackedFetchGraphql({
        url: endpoint.startsWith('http') ? endpoint : '/api/graphql',
        query: 'query SourceHealth { __typename }',
        component: 'ModeSelector',
        purpose: 'Source dropdown GraphQL health',
        tableName: 'instance_health',
      });
      setConnection({
        status: 'online',
        detail: 'GraphQL reachable via this UI',
        checkedAt: new Date(),
      });
    } catch (error) {
      setConnection({
        status: 'offline',
        detail: error?.message || 'GraphQL unreachable',
        checkedAt: new Date(),
      });
    }
  }, []);

  // Light status probe so the chip shows online/offline without opening the menu
  useEffect(() => {
    probeConnection();
    const onFocus = () => probeConnection();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [probeConnection]);

  useEffect(() => {
    if (!showSourceDropdown) return;
    probeConnection();
  }, [showSourceDropdown, probeConnection]);

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
    if (showSourceDropdown) {
      setShowSourceDropdown(false);
    }
  };

  const handleAppModeClick = () => {
    handleModeClick();
  };

  const handleDevDropdownToggle = (e) => {
    e.stopPropagation();
    setShowSourceDropdown(false);
    setShowDevDropdown(!showDevDropdown);
  };

  const handleSourceDropdownToggle = (e) => {
    e.stopPropagation();
    setShowDevDropdown(false);
    setShowSourceDropdown((open) => !open);
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
    setShowSourceDropdown(false);
  };

  const handleOpenAdminDashboard = () => openDashboardPanel('admin-dashboard', 'Admin Dashboard');
  const handleOpenTestWorkbench = () => openDashboardPanel('test-workbench-panel', 'Test Workbench');
  const handleOpenDataManagement = () => openDashboardPanel('data-management-panel', 'Data Management');

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!showDevDropdown && !showSourceDropdown) return;

    const handleClickOutside = (event) => {
      if (showDevDropdown && !event.target.closest('.mode-selector__dev-area')) {
        setShowDevDropdown(false);
      }
      if (showSourceDropdown && !event.target.closest('.mode-selector__source-area')) {
        setShowSourceDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDevDropdown, showSourceDropdown]);

  const connectionLabel =
    connection.status === 'online'
      ? 'Online'
      : connection.status === 'offline'
        ? 'Offline'
        : connection.status === 'checking'
          ? 'Checking…'
          : 'Unknown';

  const checkedAtLabel = connection.checkedAt
    ? connection.checkedAt.toLocaleTimeString()
    : '—';

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
              <span className="mode-selector__icon"><IconApp /></span>
            </button>
          </div>
        </div>

        {/* Source & Version Info — click for host/IP + connection status */}
        <div className="mode-selector__info mode-selector__source-area">
          <button
            type="button"
            className={`mode-selector__source-toggle ${showSourceDropdown ? 'mode-selector__source-toggle--open' : ''}`}
            onClick={handleSourceDropdownToggle}
            aria-expanded={showSourceDropdown}
            aria-haspopup="dialog"
            title="Show UI host and connection status"
          >
            <span
              className={`mode-selector__conn-dot mode-selector__conn-dot--${connection.status}`}
              aria-hidden="true"
            />
            <span className="mode-selector__source">
              <span className="mode-selector__source-label">Source:</span>
              <span className={`mode-selector__source-value mode-selector__source-value--${sourceClassKey}`}>
                {source}
              </span>
            </span>
            <span className="mode-selector__version">
              <span className="mode-selector__version-label">v</span>
              <span className="mode-selector__version-value">{versionLabel}</span>
            </span>
            <span className="mode-selector__source-chevron" aria-hidden="true">
              <IconChevron open={showSourceDropdown} />
            </span>
          </button>

          {showSourceDropdown && (
            <div className="mode-selector__source-dropdown" role="dialog" aria-label="UI instance connection">
              <div className="mode-selector__source-dropdown-header">
                <span className="mode-selector__source-dropdown-title">This UI instance</span>
                <button
                  type="button"
                  className="mode-selector__source-refresh"
                  onClick={(e) => {
                    e.stopPropagation();
                    probeConnection();
                  }}
                  disabled={connection.status === 'checking'}
                >
                  {connection.status === 'checking' ? 'Checking…' : 'Refresh'}
                </button>
                <button
                  type="button"
                  className="mode-selector__source-close"
                  onClick={() => setShowSourceDropdown(false)}
                  title="Close"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="mode-selector__source-dropdown-body">
                <dl className="mode-selector__source-dl">
                  <div>
                    <dt>Deploy target</dt>
                    <dd>
                      <span className={`mode-selector__source-value mode-selector__source-value--${sourceClassKey}`}>
                        {source}
                      </span>
                      <span className="mode-selector__source-muted"> v{versionLabel}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>UI host</dt>
                    <dd className="mode-selector__source-mono">{uiHost.host}</dd>
                  </div>
                  <div>
                    <dt>Hostname / IP</dt>
                    <dd className="mode-selector__source-mono">{uiHost.hostname}</dd>
                  </div>
                  <div>
                    <dt>Port</dt>
                    <dd className="mode-selector__source-mono">{uiHost.port || '—'}</dd>
                  </div>
                  <div>
                    <dt>Origin</dt>
                    <dd className="mode-selector__source-mono">{uiHost.origin}</dd>
                  </div>
                  <div>
                    <dt>GraphQL</dt>
                    <dd className="mode-selector__source-mono">{graphqlEndpoint}</dd>
                  </div>
                  <div>
                    <dt>Connection</dt>
                    <dd>
                      <span
                        className={`mode-selector__conn-badge mode-selector__conn-badge--${connection.status}`}
                      >
                        {connectionLabel}
                      </span>
                      <span className="mode-selector__source-muted"> · {connection.detail}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Checked</dt>
                    <dd className="mode-selector__source-muted">{checkedAtLabel}</dd>
                  </div>
                </dl>
                <p className="mode-selector__source-hint">
                  Deploy target is stamped on this build; host/IP is the page you are viewing now
                  (direct Azure IP vs discuss tunnel can differ).
                </p>
                {canOpenPrivileged && (
                  <button
                    type="button"
                    className="mode-selector__source-details-btn"
                    onClick={handleOpenDataManagement}
                  >
                    Open Data Management → Instance &amp; connections
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Dev Tools Toggle Button (only in dev mode) */}
        {isDevMode && currentMode === 'app' && (
          <div className="mode-selector__dev-area">
            <button
              className={`mode-selector__dev-toggle ${showDevDropdown ? 'mode-selector__dev-toggle--open' : ''}`}
              onClick={handleDevDropdownToggle}
              title={showDevDropdown ? 'Hide Development Tools' : 'Show Development Tools'}
            >
              <span className="mode-selector__dev-toggle-icon"><IconWrench /></span>
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
