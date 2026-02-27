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
    <div className="landing-page">
      <div className="landing-page__card">
        {/* Logo/Title */}
        <div className="landing-page__header">
          <h1 className="landing-page__title">Talia UI</h1>
          <p className="landing-page__subtitle">Cruise Management Dashboard</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="landing-page__alert landing-page__alert--error">
            {error.message || 'An error occurred'}
          </div>
        )}

        {/* Message Display */}
        {message && (
          <div className="landing-page__alert landing-page__alert--success">
            {message}
          </div>
        )}

        {/* Development Mode Indicator */}
        <div className="landing-page__notice">
          <strong>Development Mode:</strong> Simple email/password authentication
        </div>

        {/* Admin Quick Access Button */}
        <button
          type="button"
          onClick={handleAdminLogin}
          disabled={loading}
          className="landing-page__button landing-page__button--admin"
        >
          {loading ? 'Signing in...' : '🔑 Quick Admin Access (Dev Only)'}
        </button>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="landing-page__form">
          <div className="landing-page__field">
            <label className="landing-page__label">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={loading}
              className="landing-page__input"
            />
          </div>
          <div className="landing-page__field landing-page__field--spaced">
            <label className="landing-page__label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
              className="landing-page__input"
            />
            <p className="landing-page__hint">
              New users will be created automatically
            </p>
          </div>
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="landing-page__button landing-page__button--submit"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

      </div>
    </div>
  );
};

export default LandingPage;
