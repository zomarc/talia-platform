/**
 * User Mapping Table Component
 * Displays the mapping between Supabase auth IDs and Talia user IDs
 * This is purely informational - business logic doesn't depend on it
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import '../admin.css';

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
      <div className="admin-section">
        <h2 className="admin-title">User Mapping Table</h2>
        <div className="admin-loading">Loading mappings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-section">
        <h2 className="admin-title">User Mapping Table</h2>
        <div className="admin-error">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="admin-section">
      <h2 className="admin-title">User Mapping Table</h2>
      <p className="admin-subtitle">
        Simple mapping: Supabase Auth ID → Talia User ID
        <br />
        <em>Maps Supabase authentication users to Talia internal user IDs</em>
      </p>

      {mappings.length === 0 ? (
        <div className="admin-empty">No user mappings yet. Sign in to create the first mapping.</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr className="admin-table-header-row">
              <th className="admin-table-header-cell">Talia User ID</th>
              <th className="admin-table-header-cell">Supabase Auth ID</th>
              <th className="admin-table-header-cell">Email</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((mapping, index) => (
              <tr key={index} className="admin-table-row">
                <td className="admin-table-cell">
                  <strong className="admin-mono" style={{ color: '#2E86AB', fontSize: '16px' }}>
                    {mapping.taliaUserId}
                  </strong>
                </td>
                <td className="admin-table-cell">
                  <code className="admin-mono" style={{ fontSize: '12px', color: '#6C757D', background: '#f8f9fa', padding: '2px 6px', borderRadius: '3px' }}>
                    {mapping.supabaseAuthId}
                  </code>
                </td>
                <td className="admin-table-cell">{mapping.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="admin-info">
        <h3 className="admin-info-title">User Mapping</h3>
        <ul className="admin-info-list">
          <li><strong>supabaseAuthId:</strong> From Supabase Auth (unique UUID)</li>
          <li><strong>taliaUserId:</strong> Talia's internal ID (unique, 1000+)</li>
          <li><strong>Purpose:</strong> Map logged-in user to Talia user ID</li>
          <li><strong>Storage:</strong> Stored in talia_users table in Supabase</li>
        </ul>
      </div>
    </div>
  );
};

export default UserMappingTable;
