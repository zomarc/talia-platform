import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError() {
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
        <div className="error-boundary">
          <div className="error-boundary__card">
            <div className="error-boundary__header">
              <h1 className="error-boundary__title">🚨 Application Error</h1>
              <p className="error-boundary__subtitle">
                Something went wrong while rendering this view
              </p>
            </div>

            <div className="error-boundary__section error-boundary__section--error">
              <h3 className="error-boundary__section-title error-boundary__section-title--error">
                Error Details:
              </h3>
              <pre className="error-boundary__error-details">
                {this.state.error && this.state.error.toString()}
              </pre>
            </div>

            <div className="error-boundary__section error-boundary__section--info">
              <h3 className="error-boundary__section-title error-boundary__section-title--info">
                Troubleshooting Steps:
              </h3>
              <ol className="error-boundary__steps">
                <li>Check the browser console for detailed error logs</li>
                <li>Verify your Supabase connection is configured correctly</li>
                <li>Ensure you have a stable internet connection</li>
                <li>Try refreshing the page</li>
                <li>Clear browser cache and cookies</li>
              </ol>
            </div>

            <div className="error-boundary__actions">
              <button
                onClick={() => window.location.reload()}
                className="error-boundary__button error-boundary__button--reload"
              >
                🔄 Reload Page
              </button>

              <button
                onClick={() => {
                  console.clear();
                  this.setState({ hasError: false, error: null, errorInfo: null });
                }}
                className="error-boundary__button error-boundary__button--retry"
              >
                🔄 Try Again
              </button>
            </div>

            {this.state.errorInfo && (
              <details className="error-boundary__details">
                <summary className="error-boundary__details-summary">
                  Show Technical Details
                </summary>
                <pre className="error-boundary__details-content">
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
