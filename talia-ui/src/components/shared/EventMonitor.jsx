/**
 * Event Monitor Component
 * Displays all custom events being dispatched in real-time
 * Enhanced with filtering, export, and grouping
 */

import React, { useState, useEffect } from 'react';

const EventMonitor = ({ componentFilter = null }) => {
  const [events, setEvents] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState('');
  const [grouped, setGrouped] = useState(false);

  // Intercept dispatchEvent to catch ALL custom events - this is the primary capture mechanism
  useEffect(() => {
    if (isPaused) return;

    const captureEvent = (event) => {
      // Capture all CustomEvents
      if (event instanceof CustomEvent) {
        const timestamp = new Date().toLocaleTimeString();
        console.log('[EventMonitor] ✅ Captured event:', event.type, event.detail);
        setEvents(prev => {
          const newEvent = {
            name: event.type,
            detail: event.detail,
            timestamp,
            fullEvent: event
          };
          // Avoid duplicates by checking if the same event was just added
          if (prev.length > 0 && prev[0].name === event.type && prev[0].timestamp === timestamp) {
            return prev;
          }
          return [newEvent, ...prev].slice(0, 100);
        });
      }
    };

    // Store original dispatchEvent
    const originalDispatchEvent = window.dispatchEvent.bind(window);
    
    // Override dispatchEvent to catch all custom events before they're dispatched
    window.dispatchEvent = function(event) {
      captureEvent(event);
      return originalDispatchEvent(event);
    };

    // Also listen directly for talia events as a backup
    const eventTypes = [
      'talia:sail.select',
      'talia:sail.clear',
      'talia:sailing.select',
      'talia:sailing.clear',
      'publishedRatesSelect',
      'publishedRatesClear',
      'sailingCabinSelect',
      'sailingCabinClear'
    ];

    const directListener = (event) => {
      if (!isPaused && event instanceof CustomEvent) {
        const timestamp = new Date().toLocaleTimeString();
        console.log('[EventMonitor] ✅ Direct listener caught:', event.type, event.detail);
        setEvents(prev => {
          const newEvent = {
            name: event.type,
            detail: event.detail,
            timestamp,
            fullEvent: event
          };
          // Avoid duplicates
          if (prev.length > 0 && prev[0].name === event.type && prev[0].timestamp === timestamp) {
            return prev;
          }
          return [newEvent, ...prev].slice(0, 100);
        });
      }
    };

    eventTypes.forEach(eventType => {
      window.addEventListener(eventType, directListener, true);
    });

    return () => {
      window.dispatchEvent = originalDispatchEvent;
      eventTypes.forEach(eventType => {
        window.removeEventListener(eventType, directListener, true);
      });
    };
  }, [isPaused]);

  const clearEvents = () => {
    setEvents([]);
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
      background: 'white',
      padding: '12px',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ marginBottom: '8px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px'
        }}>
          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>
            📡 Events
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
                background: '#e0e0e0',
                color: '#333',
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
                background: grouped ? '#b08d57' : '#e0e0e0',
                color: grouped ? 'white' : '#333',
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
                background: '#e0e0e0',
                color: '#333',
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
            border: '1px solid #ddd',
            borderRadius: '3px',
            fontSize: '11px'
          }}
        />
      </div>

      {filteredEvents.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '10px',
          color: '#999',
          fontSize: '11px',
          fontStyle: 'italic'
        }}>
          {isPaused ? 'Paused' : filter ? 'No matching events' : 'No events'}
        </div>
      ) : groupedEvents ? (
        <div style={{
          maxHeight: '280px',
          overflowY: 'auto',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          padding: '6px',
          flex: 1
        }}>
          {Object.entries(groupedEvents).map(([eventName, eventGroup]) => (
            <div key={eventName} style={{ marginBottom: '8px' }}>
              <div style={{
                padding: '4px 8px',
                background: '#b08d57',
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
                  key={index}
                  style={{
                    padding: '4px 8px',
                    marginLeft: '12px',
                    marginBottom: '2px',
                    background: '#f9f9f9',
                    border: '1px solid #e0e0e0',
                    borderRadius: '3px',
                    fontSize: '10px'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ color: '#666' }}>{event.timestamp}</span>
                    {event.detail !== undefined && event.detail !== null && (
                      <span style={{ color: '#999', fontSize: '9px' }}>
                        {typeof event.detail === 'object' ? 'Object' : 'String'}
                      </span>
                    )}
                  </div>
                  {event.detail !== undefined && event.detail !== null && (
                    <div style={{
                      padding: '4px 6px',
                      marginTop: '4px',
                      background: '#f0f0f0',
                      borderRadius: '2px',
                      fontSize: '9px',
                      fontFamily: 'monospace',
                      maxHeight: '80px',
                      overflow: 'auto'
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
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          padding: '6px',
          flex: 1
        }}>
          {filteredEvents.map((event, index) => (
            <div
              key={index}
              style={{
                padding: '6px',
                marginBottom: '3px',
                background: index === 0 ? '#fff3cd' : '#f9f9f9',
                border: index === 0 ? '1px solid #ffc107' : '1px solid #e0e0e0',
                borderRadius: '3px',
                fontSize: '11px'
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px'
              }}>
                <strong style={{ color: '#b08d57', fontSize: '11px' }}>{event.name}</strong>
                <span style={{ color: '#999', fontSize: '9px' }}>{event.timestamp}</span>
              </div>
              {event.detail !== undefined && event.detail !== null && (
                <div style={{
                  padding: '6px 8px',
                  background: '#f5f5f5',
                  borderRadius: '3px',
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  color: '#333',
                  overflowX: 'auto',
                  wordBreak: 'break-word',
                  maxHeight: '150px',
                  overflowY: 'auto',
                  marginTop: '4px',
                  border: '1px solid #e0e0e0'
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: '9px', color: '#666' }}>
                    Event Payload:
                  </div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '9px' }}>
                    {typeof event.detail === 'object' 
                      ? JSON.stringify(event.detail, null, 2)
                      : String(event.detail)
                    }
                  </pre>
                </div>
              )}
              {(event.detail === undefined || event.detail === null) && (
                <div style={{
                  color: '#999',
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
          color: '#666',
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

