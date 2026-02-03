import React from 'react';

/**
 * Reusable Error Message Component
 */
const ErrorMessage = ({ 
  error, 
  title = 'Something went wrong',
  onRetry = null,
  onDismiss = null
}) => {
  const errorMessage = error?.message || error?.toString() || 'An unknown error occurred';
  
  return (
    <div className="talia-error" role="alert">
      <span className="talia-error__icon" aria-hidden="true">⚠️</span>
      <h3 className="talia-error__title">{title}</h3>
      <p className="talia-error__message">{errorMessage}</p>

      {(onRetry || onDismiss) && (
        <div className="talia-report__actions">
          {onRetry && (
            <button className="talia-btn talia-btn--primary" onClick={onRetry}>
              Retry
            </button>
          )}
          {onDismiss && (
            <button className="talia-btn" onClick={onDismiss}>
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ErrorMessage;

