/**
 * Context Row Monitor Container
 * Admin-only component that monitors and displays the current context row
 */

import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import { isAdmin } from '../../../utils/roleUtils';
import ContextRowMonitorPresenter from './ContextRowMonitorPresenter';
import { useTheme } from '../../../contexts/ThemeContext';

const ContextRowMonitorContainer = () => {
  const { user } = useSupabaseAuth();
  const { theme } = useTheme();
  const [currentContext, setCurrentContext] = useState(null);

  // Check if user is admin
  const userRole = user?.role || 'USER';
  const adminAccess = isAdmin(userRole);

  // Listen to all selection events
  useEffect(() => {
    if (!adminAccess) return;

    const handleSelectionEvent = (event) => {
      if (event instanceof CustomEvent) {
        const eventType = event.type;
        const detail = event.detail || {};
        
        // Extract row data - handle different event formats
        let rowData = null;
        let source = 'Unknown';

        if (detail.row_data) {
          rowData = detail.row_data;
        } else if (detail) {
          rowData = detail;
        }

        // Determine source from event type
        if (eventType.includes('sail')) {
          source = 'Sailing Table';
        } else if (eventType.includes('publishedRates')) {
          source = 'Published Rates';
        } else if (eventType.includes('reservation')) {
          source = 'Reservation';
        } else if (eventType.includes('booking')) {
          source = 'Booking Profile';
        } else {
          source = eventType.replace('talia:', '').replace('.select', '').replace('.clear', '');
        }

        // Only update on select events, not clear events
        if (eventType.includes('.select') && rowData) {
          setCurrentContext({
            eventType,
            rowData,
            timestamp: detail.timestamp || new Date().toISOString(),
            source
          });
        } else if (eventType.includes('.clear')) {
          // Clear context on clear events
          setCurrentContext(null);
        }
      }
    };

    // Listen to all talia events
    const eventTypes = [
      'talia:sail.select',
      'talia:sail.clear',
      'talia:publishedRates.select',
      'talia:publishedRates.clear',
      'talia:reservation.select',
      'talia:reservation.clear',
      'talia:booking.select',
      'talia:booking.clear'
    ];

    eventTypes.forEach(eventType => {
      window.addEventListener(eventType, handleSelectionEvent, true);
    });

    // Also intercept all custom events
    const originalDispatchEvent = window.dispatchEvent.bind(window);
    window.dispatchEvent = function(event) {
      if (event instanceof CustomEvent && event.type.startsWith('talia:')) {
        handleSelectionEvent(event);
      }
      return originalDispatchEvent(event);
    };

    return () => {
      eventTypes.forEach(eventType => {
        window.removeEventListener(eventType, handleSelectionEvent, true);
      });
      window.dispatchEvent = originalDispatchEvent;
    };
  }, [adminAccess]);

  // Show access denied for non-admins
  if (!adminAccess) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#666'
      }}>
        <h3>Access Denied</h3>
        <p>This panel is only available to administrators.</p>
      </div>
    );
  }

  return (
    <ContextRowMonitorPresenter 
      currentContext={currentContext}
      theme={theme}
    />
  );
};

export default ContextRowMonitorContainer;

