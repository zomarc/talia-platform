import React from 'react';

/**
 * Reusable Loading Spinner Component
 */
const LoadingSpinner = ({
  size = 'medium',
  message = 'Loading...',
  fullScreen = false
}) => {
  const sizeClass = size === 'small'
    ? 'talia-loading__spinner--small'
    : size === 'large'
      ? 'talia-loading__spinner--large'
      : '';

  if (fullScreen) {
    return (
      <div className="talia-loading talia-loading--fullscreen" role="status" aria-live="polite">
        <div className={`talia-loading__spinner ${sizeClass}`} aria-hidden="true" />
        <span className="talia-loading__text">{message}</span>
      </div>
    );
  }

  return (
    <div className="talia-loading" role="status" aria-live="polite">
      <div className={`talia-loading__spinner ${sizeClass}`} aria-hidden="true" />
      <span className="talia-loading__text">{message}</span>
    </div>
  );
};

export default LoadingSpinner;

