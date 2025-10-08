import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const LandingPage = () => {
  const { signIn, verifyCode, error } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email'); // 'email' or 'code'
  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      await signIn(email);
      setStep('code');
    } catch (err) {
      console.error('Sign in error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    if (!code) return;

    setLoading(true);
    try {
      await verifyCode(email, code);
    } catch (err) {
      console.error('Code verification error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setCode('');
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

        {/* Email Step */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
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
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email}
              style={{
                width: '100%',
                background: loading ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '0.75rem',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              {loading ? 'Sending...' : 'Send Magic Code'}
            </button>
          </form>
        )}

        {/* Code Step */}
        {step === 'code' && (
          <form onSubmit={handleCodeSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{
                color: '#374151',
                marginBottom: '1rem',
                fontSize: '0.875rem'
              }}>
                We sent a 6-digit code to <strong>{email}</strong>
              </p>
              <label style={{
                display: 'block',
                textAlign: 'left',
                marginBottom: '0.5rem',
                fontWeight: '500',
                color: '#374151'
              }}>
                Verification Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code"
                required
                maxLength="6"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  textAlign: 'center',
                  letterSpacing: '0.1em',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={handleBackToEmail}
                style={{
                  flex: 1,
                  background: 'transparent',
                  color: '#6b7280',
                  border: '1px solid #d1d5db',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                style={{
                  flex: 1,
                  background: loading ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
            </div>
          </form>
        )}

        {/* Demo Mode */}
        <div style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid #e5e7eb'
        }}>
          <p style={{
            color: '#6b7280',
            fontSize: '0.875rem',
            margin: '0 0 1rem 0'
          }}>
            Want to try without signing up?
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                // Create a demo user with admin role
                const demoUser = {
                  id: 'demo-admin',
                  email: 'admin@demo.com',
                  name: 'Demo Admin',
                  role: 'admin',
                  preferences: {
                    theme: 'default',
                    fontSize: 12,
                    fontFamily: 'Inter',
                    spacingMode: 'default'
                  },
                  createdAt: new Date(),
                  lastLogin: new Date(),
                  isActive: true
                };
                // This would normally be handled by the auth context
                console.log('Demo admin mode clicked', demoUser);
                alert('Demo admin mode - this would log you in as an admin user');
              }}
              style={{
                background: 'transparent',
                color: '#dc2626',
                border: '1px solid #dc2626',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              Demo Admin
            </button>
            <button
              onClick={() => {
                // Create a demo user with manager role
                const demoUser = {
                  id: 'demo-manager',
                  email: 'manager@demo.com',
                  name: 'Demo Manager',
                  role: 'manager',
                  preferences: {
                    theme: 'default',
                    fontSize: 12,
                    fontFamily: 'Inter',
                    spacingMode: 'default'
                  },
                  createdAt: new Date(),
                  lastLogin: new Date(),
                  isActive: true
                };
                console.log('Demo manager mode clicked', demoUser);
                alert('Demo manager mode - this would log you in as a manager user');
              }}
              style={{
                background: 'transparent',
                color: '#ea580c',
                border: '1px solid #ea580c',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              Demo Manager
            </button>
            <button
              onClick={() => {
                // Create a demo user with user role
                const demoUser = {
                  id: 'demo-user',
                  email: 'user@demo.com',
                  name: 'Demo User',
                  role: 'user',
                  preferences: {
                    theme: 'default',
                    fontSize: 12,
                    fontFamily: 'Inter',
                    spacingMode: 'default'
                  },
                  createdAt: new Date(),
                  lastLogin: new Date(),
                  isActive: true
                };
                console.log('Demo user mode clicked', demoUser);
                alert('Demo user mode - this would log you in as a regular user');
              }}
              style={{
                background: 'transparent',
                color: '#3b82f6',
                border: '1px solid #3b82f6',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              Demo User
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
