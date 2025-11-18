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
    <div style={{
      padding: '40px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center'
    }}>
      <div style={{ 
        fontSize: '48px', 
        marginBottom: '16px' 
      }}>
        ⚠️
      </div>
      
      <h3 style={{
        margin: '0 0 8px 0',
        fontSize: '18px',
        fontWeight: '600',
        color: '#333'
      }}>
        {title}
      </h3>
      
      <p style={{
        color: '#666',
        fontSize: '14px',
        margin: '0 0 24px 0',
        maxWidth: '500px'
      }}>
        {errorMessage}
      </p>
      
      {(onRetry || onDismiss) && (
        <div style={{ display: 'flex', gap: '12px' }}>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                padding: '10px 20px',
                backgroundColor: '#b08d57',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Retry
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              style={{
                padding: '10px 20px',
                backgroundColor: '#e0e0e0',
                color: '#333',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ErrorMessage;

