/**
 * Component Wrapper
 * Wraps components with performance tracking, error boundary, and theming
 */

import React, { useState } from 'react';
import { usePerformanceTracking } from '../../hooks/usePerformanceTracking';
import ErrorMessage from '../shared/ErrorMessage';

const ComponentWrapper = ({ componentName, Component, props = {}, theme = {} }) => {
  const performanceData = usePerformanceTracking(componentName);
  const [error, setError] = useState(null);

  // Default theme
  const defaultTheme = {
    colors: {
      background: '#ffffff',
      foreground: '#2b2b2b',
      sidebar: '#f7f3ee',
      sidebarBorder: '#e8dfd0',
      sidebarHeader: '#f5efe6',
      accent: '#b08d57',
    },
    ...theme
  };

  // Error boundary
  if (error) {
    return (
      <ErrorMessage
        error={error}
        title={`Error rendering ${componentName}`}
        onRetry={() => setError(null)}
      />
    );
  }

  try {
    return (
      <div style={{ height: '100%', width: '100%' }}>
        <Component {...props} theme={defaultTheme} />
      </div>
    );
  } catch (err) {
    setError(err);
    return (
      <ErrorMessage
        error={err}
        title={`Error rendering ${componentName}`}
        onRetry={() => setError(null)}
      />
    );
  }
};

export default ComponentWrapper;

