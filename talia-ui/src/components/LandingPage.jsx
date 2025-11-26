import React, { useState } from 'react';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';
import { GraphQLUtils } from '../lib/apolloClient';

const LandingPage = () => {
  const { signInWithPassword, error } = useSupabaseAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setMessage('');
    try {
      await signInWithPassword(email, password);
      setMessage('Signing in...');
      // User will be redirected automatically when auth state changes
    } catch (err) {
      console.error('Sign in error:', err);
      setMessage(''); // Error message will be displayed by the context
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    setLoading(true);
    setMessage('');
    try {
      // Use a standard admin email for development
      const adminEmail = 'admin@talia.dev';
      const adminPassword = 'admin123';
      
      // Sign in as admin (will create if doesn't exist)
      await signInWithPassword(adminEmail, adminPassword);
      
      // Set admin role in localStorage for GraphQL context
      // Note: Using uppercase ADMIN to match GraphQL enum
      GraphQLUtils.setUserContext({
        role: 'ADMIN',
        email: adminEmail,
        id: 'admin-dev'
      });
      
      setMessage('Signing in as Administrator...');
    } catch (err) {
      console.error('Admin login error:', err);
      setMessage('Failed to login as admin. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center'
      }}>
        {/* Logo/Title */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#1a1a1a',
            margin: '0 0 0.5rem 0'
          }}>
            Talia UI
          </h1>
          <p style={{
            color: '#666',
            margin: 0,
            fontSize: '1rem'
          }}>
            Cruise Management Dashboard
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div style={{
            background: '#fee2e2',
            color: '#dc2626',
            padding: '0.75rem',
            borderRadius: '6px',
            marginBottom: '1rem',
            fontSize: '0.875rem'
          }}>
            {error.message || 'An error occurred'}
          </div>
        )}

        {/* Message Display */}
        {message && (
          <div style={{
            background: '#d1fae5',
            color: '#065f46',
            padding: '0.75rem',
            borderRadius: '6px',
            marginBottom: '1rem',
            fontSize: '0.875rem'
          }}>
            {message}
          </div>
        )}

        {/* Development Mode Indicator */}
        <div style={{
          background: '#fef3c7',
          border: '1px solid #fbbf24',
          borderRadius: '6px',
          padding: '0.75rem',
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
          color: '#92400e'
        }}>
          <strong>Development Mode:</strong> Simple email/password authentication
        </div>

        {/* Admin Quick Access Button */}
        <button
          type="button"
          onClick={handleAdminLogin}
          disabled={loading}
          style={{
            width: '100%',
            background: loading ? '#9ca3af' : '#dc2626',
            color: 'white',
            border: 'none',
            padding: '0.75rem',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: '1.5rem',
            transition: 'background-color 0.2s'
          }}
        >
          {loading ? 'Signing in...' : '🔑 Quick Admin Access (Dev Only)'}
        </button>

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              textAlign: 'left',
              marginBottom: '0.5rem',
              fontWeight: '500',
              color: '#374151'
            }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem',
                boxSizing: 'border-box',
                backgroundColor: loading ? '#f3f4f6' : 'white'
              }}
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              textAlign: 'left',
              marginBottom: '0.5rem',
              fontWeight: '500',
              color: '#374151'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem',
                boxSizing: 'border-box',
                backgroundColor: loading ? '#f3f4f6' : 'white'
              }}
            />
            <p style={{
              margin: '0.5rem 0 0 0',
              fontSize: '0.75rem',
              color: '#6b7280',
              textAlign: 'left'
            }}>
              New users will be created automatically
            </p>
          </div>
          <button
            type="submit"
            disabled={loading || !email || !password}
            style={{
              width: '100%',
              background: loading || !email || !password ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '0.75rem',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

      </div>
    </div>
  );
};

export default LandingPage;
