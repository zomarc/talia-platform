/**
 * Event Monitor Component
 * Displays all custom events being dispatched in real-time
 * Enhanced with filtering, export, and grouping
 */

import React, { useState, useEffect, useRef } from 'react';

const EventMonitor = () => {
  const [events, setEvents] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState('');
  const [grouped, setGrouped] = useState(false);
  const eventIdCounterRef = useRef(0);
  const lastEventRef = useRef(null);

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
    <div className="event-monitor">
      <div className="event-monitor__header">
        <div className="event-monitor__title-row">
          <h4 className="event-monitor__title">
            📡 Events {events.length > 0 && `(${events.length})`}
          </h4>
          <div className="event-monitor__actions">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`event-monitor__btn event-monitor__btn--pause ${isPaused ? 'is-paused' : ''}`}
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? '▶' : '⏸'}
            </button>
            <button
              onClick={exportEvents}
              className="event-monitor__btn event-monitor__btn--neutral"
              title="Export events"
            >
              💾
            </button>
            <button
              onClick={() => setGrouped(!grouped)}
              className={`event-monitor__btn event-monitor__btn--neutral event-monitor__btn--group ${grouped ? 'is-active' : ''}`}
              title="Group by event type"
            >
              📊
            </button>
            <button
              onClick={clearEvents}
              className="event-monitor__btn event-monitor__btn--neutral"
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
          className="event-monitor__filter"
        />
      </div>

      {filteredEvents.length === 0 ? (
        <div className="event-monitor__empty">
          {isPaused ? 'Paused' : filter ? 'No matching events' : 'No events captured yet. Select a sail to trigger events.'}
        </div>
      ) : groupedEvents ? (
        <div className="event-monitor__list">
          {Object.entries(groupedEvents).map(([eventName, eventGroup]) => (
            <div key={eventName} className="event-monitor__group">
              <div className="event-monitor__group-header">
                {eventName} ({eventGroup.length})
              </div>
              {eventGroup.map((event, index) => (
                <div
                  key={event.id || index}
                  className="event-monitor__group-item"
                >
                  <div className="event-monitor__meta">
                    <span className="event-monitor__timestamp">{event.timestamp}</span>
                    {event.detail !== undefined && event.detail !== null && (
                      <span className="event-monitor__detail-type">
                        {typeof event.detail === 'object' ? 'Object' : 'String'}
                      </span>
                    )}
                  </div>
                  {event.detail !== undefined && event.detail !== null && (
                    <div className="event-monitor__detail">
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
        <div className="event-monitor__list">
          {filteredEvents.map((event, index) => (
            <div
              key={event.id || index}
              className={`event-monitor__event ${index === 0 ? 'event-monitor__event--latest' : ''}`}
            >
              <div className="event-monitor__event-header">
                <strong className="event-monitor__event-name">{event.name}</strong>
                <span className="event-monitor__timestamp">{event.timestamp}</span>
              </div>
              {event.detail !== undefined && event.detail !== null && (
                <div className="event-monitor__payload">
                  <div className="event-monitor__payload-title">
                    Event Payload:
                  </div>
                  <pre className="event-monitor__payload-pre">
                    {typeof event.detail === 'object' 
                      ? JSON.stringify(event.detail, null, 2)
                      : String(event.detail)
                    }
                  </pre>
                </div>
              )}
              {(event.detail === undefined || event.detail === null) && (
                <div className="event-monitor__no-payload">
                  (no payload)
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {filteredEvents.length > 0 && (
        <div className="event-monitor__footer">
          {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
          {filter && ` (filtered from ${events.length})`}
        </div>
      )}
    </div>
  );
};

export default EventMonitor;
