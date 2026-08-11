import React from 'react';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

/**
 * Shared state wrapper for data-driven panels.
 * Keeps loading/error/empty handling consistent and minimal.
 *
 * While refreshing with previous content (`loading && !empty`), children stay
 * mounted so ReportShell can grey the panel instead of flashing a spinner.
 */
const PanelDataState = ({
  loading = false,
  loadingMessage = 'Loading data...',
  error = null,
  errorTitle = 'Failed to load data',
  empty = false,
  emptyMessage = 'No data available',
  onRetry = null,
  children
}) => {
  // Initial load only — keep prior content visible during sail/filter refresh.
  if (loading && empty) {
    return <LoadingSpinner message={loadingMessage} fullScreen={false} />;
  }

  if (error && (empty || !loading)) {
    return <ErrorMessage error={error} title={errorTitle} onRetry={onRetry} />;
  }

  if (empty && !loading) {
    return (
      <div className="focus-panel-empty">
        <p>{emptyMessage}</p>
        {onRetry && (
          <div className="focus-panel-empty__action">
            <button className="talia-btn talia-btn--primary" onClick={onRetry}>
              Retry
            </button>
          </div>
        )}
      </div>
    );
  }

  return children || null;
};

export default PanelDataState;
