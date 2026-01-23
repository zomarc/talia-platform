/**
 * StatusBar Component
 * 
 * Unified title bar at the top of the page showing:
 * - Focus save confirmations
 * - Current event from report selection
 * - Persisted event information
 * - Mode selection (integrated on the right)
 * - Clickable to view details
 */

import React, { useState, useEffect } from 'react';
import ModeSelector from '../ModeSelector';
// CSS imported globally in main.jsx

const StatusBar = ({ statusMessage, currentEvent, persistedEvent, currentMode, onModeChange }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [displayMessage, setDisplayMessage] = useState(statusMessage);

  // Update display message when statusMessage changes
  useEffect(() => {
    if (statusMessage) {
      setDisplayMessage(statusMessage);
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setDisplayMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  // Get event summary
  const getEventSummary = (event) => {
    if (!event) return null;
    
    const eventType = event.name || event.eventType || 'Unknown';
    const detail = event.detail || event.rowData || {};
    
    // Extract key information
    const source = event.source || eventType.replace('talia:', '').replace('.select', '').replace('.clear', '');
    const timestamp = event.timestamp || detail.timestamp || new Date().toLocaleTimeString();
    
    // Get primary identifier from detail
    let identifier = '';
    if (detail.sail_code) identifier = `Sail: ${detail.sail_code}`;
    else if (detail.ship_code) identifier = `Ship: ${detail.ship_code}`;
    else if (detail.id) identifier = `ID: ${detail.id}`;
    else if (detail.title) identifier = detail.title;
    else if (Object.keys(detail).length > 0) {
      // Try to find a meaningful identifier
      const keys = Object.keys(detail);
      const firstKey = keys.find(k => k !== 'timestamp' && k !== 'row_data');
      if (firstKey) identifier = `${firstKey}: ${detail[firstKey]}`;
    }
    
    return {
      source,
      identifier,
      timestamp,
      eventType,
      detail
    };
  };

  const currentEventSummary = getEventSummary(currentEvent);
  const persistedEventSummary = getEventSummary(persistedEvent);

  // Always render - mode selector should always be visible
  return (
    <div className="status-bar">
      <div className="status-bar__container">
        {/* Left side: Status messages and events */}
        <div className="status-bar__left">
          {/* Status Message (temporary) */}
          {displayMessage && (
            <div className="status-bar__message status-bar__message--success">
              <span className="status-bar__icon">✓</span>
              <span className="status-bar__text">{displayMessage}</span>
            </div>
          )}

          {/* Current Event */}
          {currentEventSummary && (
            <div 
              className="status-bar__item status-bar__item--clickable"
              onClick={() => setShowDetails(!showDetails)}
              title="Click to view details"
            >
              <span className="status-bar__label">Current Event:</span>
              <span className="status-bar__value">
                {currentEventSummary.source}
                {currentEventSummary.identifier && ` - ${currentEventSummary.identifier}`}
              </span>
              <span className="status-bar__timestamp">{currentEventSummary.timestamp}</span>
              <span className="status-bar__expand">{showDetails ? '▲' : '▼'}</span>
            </div>
          )}

          {/* Persisted Event */}
          {persistedEventSummary && (
            <div 
              className="status-bar__item status-bar__item--clickable"
              onClick={() => setShowDetails(!showDetails)}
              title="Click to view details"
            >
              <span className="status-bar__label">Persisted:</span>
              <span className="status-bar__value">
                {persistedEventSummary.source}
                {persistedEventSummary.identifier && ` - ${persistedEventSummary.identifier}`}
              </span>
              <span className="status-bar__timestamp">{persistedEventSummary.timestamp}</span>
            </div>
          )}
        </div>

        {/* Right side: Mode selector (always visible) */}
        {currentMode && onModeChange && (
          <div className="status-bar__right">
            <ModeSelector currentMode={currentMode} onModeChange={onModeChange} />
          </div>
        )}
      </div>

      {/* Details Panel */}
      {showDetails && (currentEventSummary || persistedEventSummary) && (
        <div className="status-bar__details">
          <div className="status-bar__details-header">
            <span className="status-bar__details-title">Event Details</span>
            <button 
              className="status-bar__details-close"
              onClick={() => setShowDetails(false)}
              title="Close"
            >
              ×
            </button>
          </div>
          
          <div className="status-bar__details-content">
            {currentEventSummary && (
              <div className="status-bar__details-section">
                <div className="status-bar__details-section-title">Current Event</div>
                <div className="status-bar__details-row">
                  <span className="status-bar__details-label">Type:</span>
                  <span className="status-bar__details-value">{currentEventSummary.eventType}</span>
                </div>
                <div className="status-bar__details-row">
                  <span className="status-bar__details-label">Source:</span>
                  <span className="status-bar__details-value">{currentEventSummary.source}</span>
                </div>
                <div className="status-bar__details-row">
                  <span className="status-bar__details-label">Timestamp:</span>
                  <span className="status-bar__details-value">{currentEventSummary.timestamp}</span>
                </div>
                <div className="status-bar__details-data">
                  <span className="status-bar__details-label">Data:</span>
                  <pre className="status-bar__details-json">
                    {JSON.stringify(currentEventSummary.detail, null, 2)}
                  </pre>
                </div>
              </div>
            )}
            
            {persistedEventSummary && (
              <div className="status-bar__details-section">
                <div className="status-bar__details-section-title">Persisted Event</div>
                <div className="status-bar__details-row">
                  <span className="status-bar__details-label">Type:</span>
                  <span className="status-bar__details-value">{persistedEventSummary.eventType}</span>
                </div>
                <div className="status-bar__details-row">
                  <span className="status-bar__details-label">Source:</span>
                  <span className="status-bar__details-value">{persistedEventSummary.source}</span>
                </div>
                <div className="status-bar__details-row">
                  <span className="status-bar__details-label">Timestamp:</span>
                  <span className="status-bar__details-value">{persistedEventSummary.timestamp}</span>
                </div>
                <div className="status-bar__details-data">
                  <span className="status-bar__details-label">Data:</span>
                  <pre className="status-bar__details-json">
                    {JSON.stringify(persistedEventSummary.detail, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusBar;
