/**
 * Event Monitor Component
 * Displays all custom events being dispatched in real-time
 */

import React, { useState, useEffect } from 'react';

const EventMonitor = () => {
  const [events, setEvents] = useState([]);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const eventListener = (event) => {
      // Only capture events that include "talia" in the name
      if (event.type.toLowerCase().includes('talia')) {
        if (!isPaused) {
          const timestamp = new Date().toLocaleTimeString();
          setEvents(prev => [
            {
              name: event.type,
              detail: event.detail,
              timestamp,
              fullEvent: event
            },
            ...prev
          ].slice(0, 50)); // Keep last 50 events
        }
      }
    };

    // Listen for ALL events on the window (intercepting custom events)
    // We'll catch any event type and filter for 'talia'
    const eventTypes = Object.keys(window).filter(key => key.startsWith('on'));
    
    // Add a universal event listener by patching addEventListener
    const originalAddEventListener = window.addEventListener;
    window.addEventListener = function(type, listener, options) {
      // Call original
      const result = originalAddEventListener.call(window, type, listener, options);
      
      // Also add our listener
      originalAddEventListener.call(window, type, (e) => {
        eventListener(e);
      }, options);
      
      return result;
    };

    // Also listen using document events
    document.addEventListener('click', eventListener, true);
    document.addEventListener('change', eventListener, true);
    document.addEventListener('input', eventListener, true);

    return () => {
      // Restore original
      window.addEventListener = originalAddEventListener;
      document.removeEventListener('click', eventListener, true);
      document.removeEventListener('change', eventListener, true);
      document.removeEventListener('input', eventListener, true);
    };
  }, [isPaused]);

  // Use MutationObserver to catch CustomEvents
  useEffect(() => {
    const observer = new MutationObserver(() => {
      // This will catch events through observation
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, []);

  // Universal event capture
  useEffect(() => {
    const captureEvent = (event) => {
      // Only capture custom events with 'talia' in the name
      if (event.type && event.type.toLowerCase().includes('talia')) {
        if (!isPaused) {
          const timestamp = new Date().toLocaleTimeString();
          setEvents(prev => [
            {
              name: event.type,
              detail: event.detail,
              timestamp,
              fullEvent: event
            },
            ...prev
          ].slice(0, 50));
        }
      }
    };

    // Try to catch all window custom events by overriding dispatchEvent
    const originalDispatchEvent = window.dispatchEvent.bind(window);
    window.dispatchEvent = function(event) {
      captureEvent(event);
      return originalDispatchEvent(event);
    };

    return () => {
      window.dispatchEvent = originalDispatchEvent;
    };
  }, [isPaused]);

  const clearEvents = () => {
    setEvents([]);
  };

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
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px'
      }}>
        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>
          📡 Events
        </h4>
        <div style={{ display: 'flex', gap: '8px' }}>
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
          >
            {isPaused ? '▶' : '⏸'}
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
          >
            🗑️
          </button>
        </div>
      </div>

      {events.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '10px',
          color: '#999',
          fontSize: '11px',
          fontStyle: 'italic'
        }}>
          {isPaused ? 'Paused' : 'No events'}
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
          {events.map((event, index) => (
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
                marginBottom: '3px'
              }}>
                <strong style={{ color: '#b08d57', fontSize: '11px' }}>{event.name}</strong>
                <span style={{ color: '#999', fontSize: '9px' }}>{event.timestamp}</span>
              </div>
              {event.detail && (
                <div style={{
                  padding: '3px 6px',
                  background: '#f5f5f5',
                  borderRadius: '2px',
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  color: '#333',
                  overflowX: 'auto',
                  wordBreak: 'break-word'
                }}>
                  {typeof event.detail === 'object' 
                    ? JSON.stringify(event.detail, null, 2)
                    : String(event.detail)
                  }
                </div>
              )}
              {!event.detail && (
                <div style={{
                  color: '#999',
                  fontStyle: 'italic',
                  fontSize: '10px'
                }}>
                  (no detail)
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {events.length > 0 && (
        <div style={{
          marginTop: '6px',
          textAlign: 'center',
          color: '#666',
          fontSize: '10px'
        }}>
          {events.length} event{events.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default EventMonitor;

