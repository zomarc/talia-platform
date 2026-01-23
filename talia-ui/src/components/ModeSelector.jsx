/**
 * ModeSelector - Discrete mode selection component
 * 
 * Provides a clean, themed interface for switching between App, Test, and Data modes.
 * Includes source/version information and Dev Role Selector dropdown.
 */

import React, { useState, useEffect } from 'react';
import DevRoleSelector from './dev/DevRoleSelector';
import '../styles/mode-selector.css';

const ModeSelector = ({ currentMode, onModeChange }) => {
  const [showDevDropdown, setShowDevDropdown] = useState(false);
  const [source, setSource] = useState('local');
  const [version, setVersion] = useState('0.1.0');

  // Determine source from environment
  useEffect(() => {
    const envSource = import.meta.env.VITE_ENVIRONMENT || 
                     (import.meta.env.DEV ? 'local' : 'staging');
    setSource(envSource);
  }, []);

  // Get version from package.json (would need to be injected at build time)
  useEffect(() => {
    // In production, this could come from build-time env var
    const envVersion = import.meta.env.VITE_APP_VERSION || '0.1.0';
    setVersion(envVersion);
  }, []);

  const isDevMode = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_MODE === 'true';

  const handleModeClick = (mode) => {
    onModeChange(mode);
    // Close dropdown when switching modes
    if (showDevDropdown) {
      setShowDevDropdown(false);
    }
  };

  const handleAppModeClick = (e) => {
    // Always switch to app mode
    handleModeClick('app');
  };

  const handleDevDropdownToggle = (e) => {
    e.stopPropagation();
    setShowDevDropdown(!showDevDropdown);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showDevDropdown) return;

    const handleClickOutside = (event) => {
      if (!event.target.closest('.mode-selector__app-wrapper')) {
        setShowDevDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDevDropdown]);

  return (
    <div className="mode-selector">
      <div className="mode-selector__container">
        {/* Mode Buttons */}
        <div className="mode-selector__modes">
          <button
            className={`mode-selector__btn ${currentMode === 'test' ? 'mode-selector__btn--active' : ''}`}
            onClick={() => handleModeClick('test')}
            title="Test Mode"
          >
            <span className="mode-selector__icon">🧪</span>
            <span className="mode-selector__label">Test</span>
          </button>
          
          <div className="mode-selector__app-wrapper">
            <button
              className={`mode-selector__btn mode-selector__btn--app ${currentMode === 'app' ? 'mode-selector__btn--active' : ''}`}
              onClick={handleAppModeClick}
              title="App Mode"
            >
              <span className="mode-selector__icon">🚀</span>
              <span className="mode-selector__label">App</span>
            </button>
            
            {/* Dev Tools Toggle Button (only in dev mode) */}
            {isDevMode && currentMode === 'app' && (
              <button
                className={`mode-selector__dev-toggle ${showDevDropdown ? 'mode-selector__dev-toggle--open' : ''}`}
                onClick={handleDevDropdownToggle}
                title={showDevDropdown ? "Hide Development Tools" : "Show Development Tools"}
              >
                <span className="mode-selector__dev-toggle-icon">🔧</span>
              </button>
            )}
            
            {/* Dev Role Selector Dropdown */}
            {isDevMode && showDevDropdown && currentMode === 'app' && (
              <div className="mode-selector__dev-dropdown">
                <div className="mode-selector__dev-header">
                  <span className="mode-selector__dev-title">Development Tools</span>
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
                </div>
              </div>
            )}
          </div>
          
          <button
            className={`mode-selector__btn ${currentMode === 'data' ? 'mode-selector__btn--active' : ''}`}
            onClick={() => handleModeClick('data')}
            title="Data Mode"
          >
            <span className="mode-selector__icon">📊</span>
            <span className="mode-selector__label">Data</span>
          </button>
        </div>

        {/* Source & Version Info - Always visible */}
        <div className="mode-selector__info">
          <div className="mode-selector__source">
            <span className="mode-selector__source-label">Source:</span>
            <span className={`mode-selector__source-value mode-selector__source-value--${source}`}>
              {source}
            </span>
          </div>
          <div className="mode-selector__version">
            <span className="mode-selector__version-label">v</span>
            <span className="mode-selector__version-value">{version}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModeSelector;
