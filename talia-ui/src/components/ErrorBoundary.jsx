import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console
    console.error('🚨 ErrorBoundary caught an error:', error);
    console.error('🚨 Error info:', errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, sans-serif',
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
            maxWidth: '600px',
            width: '100%'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h1 style={{
                fontSize: '2rem',
                fontWeight: 'bold',
                color: '#dc2626',
                margin: '0 0 1rem 0'
              }}>
                🚨 Application Error
              </h1>
              <p style={{
                color: '#6b7280',
                margin: 0,
                fontSize: '1rem'
              }}>
                Something went wrong in the authentication system
              </p>
            </div>

            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{
                color: '#dc2626',
                margin: '0 0 0.5rem 0',
                fontSize: '1rem'
              }}>
                Error Details:
              </h3>
              <pre style={{
                color: '#991b1b',
                fontSize: '0.875rem',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {this.state.error && this.state.error.toString()}
              </pre>
            </div>

            <div style={{
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{
                color: '#0369a1',
                margin: '0 0 0.5rem 0',
                fontSize: '1rem'
              }}>
                Troubleshooting Steps:
              </h3>
              <ol style={{
                color: '#0c4a6e',
                fontSize: '0.875rem',
                margin: 0,
                paddingLeft: '1.5rem'
              }}>
                <li>Check the browser console for detailed error logs</li>
                <li>Verify your InstantDB project ID is correct</li>
                <li>Ensure you have a stable internet connection</li>
                <li>Try refreshing the page</li>
                <li>Clear browser cache and cookies</li>
              </ol>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                🔄 Reload Page
              </button>
              
              <button
                onClick={() => {
                  console.clear();
                  this.setState({ hasError: false, error: null, errorInfo: null });
                }}
                style={{
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                🔄 Try Again
              </button>
            </div>

            {this.state.errorInfo && (
              <details style={{ marginTop: '1.5rem' }}>
                <summary style={{
                  cursor: 'pointer',
                  color: '#6b7280',
                  fontSize: '0.875rem',
                  marginBottom: '0.5rem'
                }}>
                  Show Technical Details
                </summary>
                <pre style={{
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  padding: '0.75rem',
                  fontSize: '0.75rem',
                  color: '#374151',
                  overflow: 'auto',
                  maxHeight: '200px'
                }}>
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
