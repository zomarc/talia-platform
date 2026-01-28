/**
 * User Mapping Table Component
 * Displays the mapping between Supabase auth IDs and Talia user IDs
 * This is purely informational - business logic doesn't depend on it
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

const UserMappingTable = () => {
  const [mappings, setMappings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadMappings();
  }, []);

  const loadMappings = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('talia_users')
        .select('id, talia_user_id, email')
        .order('talia_user_id', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      const mappedData = (data || []).map(user => ({
        taliaUserId: user.talia_user_id,
        supabaseAuthId: user.id,
        email: user.email
      }));

      setMappings(mappedData);
    } catch (err) {
      console.error('Error loading user mappings:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>User Mapping Table</h2>
        <div style={styles.loading}>Loading mappings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>User Mapping Table</h2>
        <div style={styles.error}>Error: {error}</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>User Mapping Table</h2>
      <p style={styles.subtitle}>
        Simple mapping: Supabase Auth ID → Talia User ID
        <br />
        <em>Maps Supabase authentication users to Talia internal user IDs</em>
      </p>

      {mappings.length === 0 ? (
        <div style={styles.empty}>No user mappings yet. Sign in to create the first mapping.</div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr style={styles.headerRow}>
              <th style={styles.headerCell}>Talia User ID</th>
              <th style={styles.headerCell}>Supabase Auth ID</th>
              <th style={styles.headerCell}>Email</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((mapping, index) => (
              <tr key={index} style={styles.dataRow}>
                <td style={styles.dataCell}>
                  <strong style={styles.taliaId}>{mapping.taliaUserId}</strong>
                </td>
                <td style={styles.dataCell}>
                  <code style={styles.authId}>{mapping.supabaseAuthId}</code>
                </td>
                <td style={styles.dataCell}>{mapping.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={styles.info}>
        <h3 style={styles.infoTitle}>User Mapping</h3>
        <ul style={styles.infoList}>
          <li><strong>supabaseAuthId:</strong> From Supabase Auth (unique UUID)</li>
          <li><strong>taliaUserId:</strong> Talia's internal ID (unique, 1000+)</li>
          <li><strong>Purpose:</strong> Map logged-in user to Talia user ID</li>
          <li><strong>Storage:</strong> Stored in talia_users table in Supabase</li>
        </ul>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto'
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#2E86AB',
    marginBottom: '8px'
  },
  subtitle: {
    fontSize: '14px',
    color: '#6C757D',
    marginBottom: '20px',
    lineHeight: '1.6'
  },
  loading: {
    padding: '20px',
    textAlign: 'center',
    color: '#6C757D'
  },
  error: {
    padding: '20px',
    backgroundColor: '#f8d7da',
    color: '#721c24',
    borderRadius: '4px',
    border: '1px solid #f5c6cb'
  },
  empty: {
    padding: '40px',
    textAlign: 'center',
    color: '#6C757D',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
    border: '1px solid #dee2e6'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: 'white',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  headerRow: {
    backgroundColor: '#2E86AB',
    color: 'white'
  },
  headerCell: {
    padding: '12px',
    textAlign: 'left',
    fontWeight: 'bold',
    fontSize: '14px'
  },
  dataRow: {
    borderBottom: '1px solid #dee2e6',
    ':hover': {
      backgroundColor: '#f8f9fa'
    }
  },
  dataCell: {
    padding: '12px',
    fontSize: '14px',
    color: '#212529'
  },
  taliaId: {
    color: '#2E86AB',
    fontSize: '16px',
    fontFamily: 'monospace'
  },
  authId: {
    fontSize: '12px',
    color: '#6C757D',
    backgroundColor: '#f8f9fa',
    padding: '2px 6px',
    borderRadius: '3px',
    fontFamily: 'monospace'
  },
  info: {
    marginTop: '30px',
    padding: '20px',
    backgroundColor: '#e7f3ff',
    borderRadius: '4px',
    border: '1px solid #b3d9ff'
  },
  infoTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#2E86AB',
    marginBottom: '12px'
  },
  infoList: {
    listStyle: 'none',
    padding: 0,
    margin: 0
  }
};

const styleSheet = document.createElement('style');
styleSheet.textContent = `
  table tbody tr:hover {
    background-color: #f8f9fa !important;
  }
`;
document.head.appendChild(styleSheet);

export default UserMappingTable;
