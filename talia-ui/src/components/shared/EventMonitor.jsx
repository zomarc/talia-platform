/**
 * Event Monitor Component
 * Displays all custom events being dispatched in real-time
 * Enhanced with filtering, export, and grouping
 */

import React, { useState, useEffect, useRef } from 'react';

const EventMonitor = ({ componentFilter = null, theme }) => {
  const [events, setEvents] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState('');
  const [grouped, setGrouped] = useState(false);
  const eventIdCounterRef = useRef(0);
  const lastEventRef = useRef(null);

  // Use theme colors or fallback to defaults
  const colors = theme?.colors || {};
  const bgColor = colors.cardBackground || colors.background || '#1a1a1a';
  const fgColor = colors.foreground || '#ffffff';
  const textSecondary = colors.textSecondary || '#b0b0b0';
  const borderColor = colors.border || '#333333';
  const accentColor = colors.accent || '#b08d57';
  const cardBg = colors.cardBackground || '#2a2a2a';

  // Intercept dispatchEvent to catch ALL custom events - this is the primary capture mechanism
  useEffect(() => {
    if (isPaused) return;

    const captureEvent = (event) => {
      // Capture all CustomEvents, especially talia:* events
      if (event instanceof CustomEvent && (event.type.startsWith('talia:') || event.type.includes('.select') || event.type.includes('.clear'))) {
        const timestamp = new Date().toLocaleTimeString();
        const eventId = `event-${++eventIdCounterRef.current}`;
        const now = Date.now();
        
        console.log('[EventMonitor] ✅ Captured event:', event.type, event.detail);
        
        setEvents(prev => {
          const newEvent = {
            id: eventId,
            name: event.type,
            detail: event.detail,
            timestamp,
            timestampMs: now,
            fullEvent: event
          };
          
          // Check for duplicates - compare event type, detail content, and time (within 500ms)
          const isDuplicate = prev.some(e => 
            e.name === event.type && 
            JSON.stringify(e.detail) === JSON.stringify(event.detail) &&
            Math.abs(e.timestampMs - now) < 500 // Within 500ms
          );
          
          if (isDuplicate) {
            console.log('[EventMonitor] Skipping duplicate event:', event.type);
            return prev;
          }
          
          lastEventRef.current = newEvent;
          return [newEvent, ...prev].slice(0, 100);
        });
      }
    };

    // Store original dispatchEvent if not already stored
    if (!window._originalDispatchEvent) {
      window._originalDispatchEvent = window.dispatchEvent.bind(window);
    }
    
    // Override dispatchEvent to catch all custom events before they're dispatched
    window.dispatchEvent = function(event) {
      captureEvent(event);
      return window._originalDispatchEvent(event);
    };

    // Also listen directly for talia events as a backup (use capture phase)
    const eventTypes = [
      'talia:sail.select',
      'talia:sail.clear',
      'talia:ship.select',
      'talia:ship.clear',
      'talia:publishedRates.select',
      'talia:publishedRates.clear',
      'talia:reservation.select',
      'talia:reservation.clear'
    ];

    const directListener = (event) => {
      if (!isPaused && event instanceof CustomEvent) {
        const timestamp = new Date().toLocaleTimeString();
        const eventId = `event-${++eventIdCounterRef.current}`;
        const now = Date.now();
        
        console.log('[EventMonitor] ✅ Direct listener caught:', event.type, event.detail);
        
        setEvents(prev => {
          const newEvent = {
            id: eventId,
            name: event.type,
            detail: event.detail,
            timestamp,
            timestampMs: now,
            fullEvent: event
          };
          
          // Less aggressive duplicate check - only check if same event within 100ms
          const isDuplicate = prev.some(e => 
            e.name === event.type && 
            JSON.stringify(e.detail) === JSON.stringify(event.detail) &&
            Math.abs(e.timestampMs - now) < 100 // Reduced from 500ms to 100ms
          );
          
          if (isDuplicate) {
            console.log('[EventMonitor] Skipping duplicate event (within 100ms):', event.type);
            return prev;
          }
          
          lastEventRef.current = newEvent;
          console.log('[EventMonitor] ✅ Adding event to list:', event.type);
          return [newEvent, ...prev].slice(0, 100);
        });
      }
    };

    // Use capture phase to catch events before they bubble
    eventTypes.forEach(eventType => {
      window.addEventListener(eventType, directListener, true);
    });

    return () => {
      // Restore original dispatchEvent if it exists
      if (window._originalDispatchEvent) {
        window.dispatchEvent = window._originalDispatchEvent;
        delete window._originalDispatchEvent;
      }
      eventTypes.forEach(eventType => {
        window.removeEventListener(eventType, directListener, true);
      });
    };
  }, [isPaused]);

  const clearEvents = () => {
    setEvents([]);
    eventIdCounterRef.current = 0;
    lastEventRef.current = null;
  };

  const exportEvents = () => {
    const dataStr = JSON.stringify(events, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `events-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filter events by component if specified, and by text filter
  const filteredEvents = events.filter(e => {
    // Component filter: show all events (component-specific filtering can be added later)
    const matchesFilter = !filter || e.name.toLowerCase().includes(filter.toLowerCase());
    return matchesFilter;
  });

  const groupedEvents = grouped
    ? filteredEvents.reduce((acc, event) => {
        const key = event.name;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(event);
        return acc;
      }, {})
    : null;

  return (
    <div style={{
      background: bgColor,
      padding: '12px',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      color: fgColor
    }}>
      <div style={{ marginBottom: '8px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px'
        }}>
          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: fgColor }}>
            📡 Events {events.length > 0 && `(${events.length})`}
          </h4>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setIsPaused(!isPaused)}
              style={{
                padding: '2px 6px',
                background: isPaused ? '#999' : '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px',
                fontWeight: '500'
              }}
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? '▶' : '⏸'}
            </button>
            <button
              onClick={exportEvents}
              style={{
                padding: '2px 6px',
                background: borderColor,
                color: fgColor,
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px'
              }}
              title="Export events"
            >
              💾
            </button>
            <button
              onClick={() => setGrouped(!grouped)}
              style={{
                padding: '2px 6px',
                background: grouped ? accentColor : borderColor,
                color: grouped ? 'white' : fgColor,
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px'
              }}
              title="Group by event type"
            >
              📊
            </button>
            <button
              onClick={clearEvents}
              style={{
                padding: '2px 6px',
                background: borderColor,
                color: fgColor,
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px'
              }}
              title="Clear events"
            >
              🗑️
            </button>
          </div>
        </div>
        <input
          type="text"
          placeholder="Filter events..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            width: '100%',
            padding: '4px 8px',
            border: `1px solid ${borderColor}`,
            borderRadius: '3px',
            fontSize: '11px',
            background: cardBg,
            color: fgColor
          }}
        />
      </div>

      {filteredEvents.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '10px',
          color: textSecondary,
          fontSize: '11px',
          fontStyle: 'italic'
        }}>
          {isPaused ? 'Paused' : filter ? 'No matching events' : 'No events captured yet. Select a sail to trigger events.'}
        </div>
      ) : groupedEvents ? (
        <div style={{
          maxHeight: '280px',
          overflowY: 'auto',
          border: `1px solid ${borderColor}`,
          borderRadius: '4px',
          padding: '6px',
          flex: 1
        }}>
          {Object.entries(groupedEvents).map(([eventName, eventGroup]) => (
            <div key={eventName} style={{ marginBottom: '8px' }}>
              <div style={{
                padding: '4px 8px',
                background: accentColor,
                color: 'white',
                borderRadius: '3px',
                fontSize: '11px',
                fontWeight: '600',
                marginBottom: '4px'
              }}>
                {eventName} ({eventGroup.length})
              </div>
              {eventGroup.map((event, index) => (
                <div
                  key={event.id || index}
                  style={{
                    padding: '4px 8px',
                    marginLeft: '12px',
                    marginBottom: '2px',
                    background: cardBg,
                    border: `1px solid ${borderColor}`,
                    borderRadius: '3px',
                    fontSize: '10px',
                    color: fgColor
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ color: textSecondary }}>{event.timestamp}</span>
                    {event.detail !== undefined && event.detail !== null && (
                      <span style={{ color: textSecondary, fontSize: '9px' }}>
                        {typeof event.detail === 'object' ? 'Object' : 'String'}
                      </span>
                    )}
                  </div>
                  {event.detail !== undefined && event.detail !== null && (
                    <div style={{
                      padding: '4px 6px',
                      marginTop: '4px',
                      background: bgColor,
                      borderRadius: '2px',
                      fontSize: '9px',
                      fontFamily: 'monospace',
                      maxHeight: '80px',
                      overflow: 'auto',
                      color: fgColor
                    }}>
                      {typeof event.detail === 'object' 
                        ? JSON.stringify(event.detail, null, 2)
                        : String(event.detail)
                      }
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          maxHeight: '280px',
          overflowY: 'auto',
          border: `1px solid ${borderColor}`,
          borderRadius: '4px',
          padding: '6px',
          flex: 1
        }}>
          {filteredEvents.map((event, index) => (
            <div
              key={event.id || index}
              style={{
                padding: '6px',
                marginBottom: '3px',
                background: index === 0 ? accentColor + '40' : cardBg,
                border: index === 0 ? `1px solid ${accentColor}` : `1px solid ${borderColor}`,
                borderRadius: '3px',
                fontSize: '11px',
                color: fgColor
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px'
              }}>
                <strong style={{ color: accentColor, fontSize: '11px' }}>{event.name}</strong>
                <span style={{ color: textSecondary, fontSize: '9px' }}>{event.timestamp}</span>
              </div>
              {event.detail !== undefined && event.detail !== null && (
                <div style={{
                  padding: '6px 8px',
                  background: bgColor,
                  borderRadius: '3px',
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  color: fgColor,
                  overflowX: 'auto',
                  wordBreak: 'break-word',
                  maxHeight: '150px',
                  overflowY: 'auto',
                  marginTop: '4px',
                  border: `1px solid ${borderColor}`
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: '9px', color: textSecondary }}>
                    Event Payload:
                  </div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '9px', color: fgColor }}>
                    {typeof event.detail === 'object' 
                      ? JSON.stringify(event.detail, null, 2)
                      : String(event.detail)
                    }
                  </pre>
                </div>
              )}
              {(event.detail === undefined || event.detail === null) && (
                <div style={{
                  color: textSecondary,
                  fontStyle: 'italic',
                  fontSize: '10px',
                  marginTop: '4px'
                }}>
                  (no payload)
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {filteredEvents.length > 0 && (
        <div style={{
          marginTop: '6px',
          textAlign: 'center',
          color: textSecondary,
          fontSize: '10px'
        }}>
          {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
          {filter && ` (filtered from ${events.length})`}
        </div>
      )}
    </div>
  );
};

export default EventMonitor;
