/**
 * Talia User Table Component
 * Displays Talia's internal user system (separate from auth)
 */

import React, { useState, useEffect } from 'react';
import taliaUserService from '../../../services/TaliaUserService';
import '../admin.css';

const TaliaUserTable = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [newRole, setNewRole] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const userList = await taliaUserService.getAllTaliaUsers();
      setUsers(userList);
    } catch (err) {
      console.error('Error loading users:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (taliaUserId) => {
    if (newRole) {
      try {
        await taliaUserService.updateTaliaUserRole(taliaUserId, newRole);
        await loadUsers();
        setEditingUser(null);
        setNewRole('');
      } catch (err) {
        console.error('Error updating role:', err);
        setError(err.message);
      }
    }
  };

  const startEditing = (user) => {
    setEditingUser(user.taliaUserId);
    setNewRole(user.taliaRole);
  };

  const cancelEditing = () => {
    setEditingUser(null);
    setNewRole('');
  };

  const getRoleBadgeStyle = (role) => {
    const baseStyle = {
      padding: '4px 12px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: 'bold',
      textTransform: 'uppercase'
    };

    switch (role) {
      case 'admin':
        return { ...baseStyle, backgroundColor: '#dc3545', color: 'white' };
      case 'manager':
        return { ...baseStyle, backgroundColor: '#ffc107', color: '#212529' };
      case 'user':
        return { ...baseStyle, backgroundColor: '#28a745', color: 'white' };
      default:
        return { ...baseStyle, backgroundColor: '#6c757d', color: 'white' };
    }
  };

  return (
    <div className="admin-section">
      <h2 className="admin-title">Talia Users</h2>
      <p className="admin-subtitle">
        Internal Talia user system - manages user roles and permissions.
        <br />
        <em>Note: This is independent of authentication. Users are identified by Talia user ID.</em>
      </p>

      {loading ? (
        <div className="admin-empty">Loading Talia users...</div>
      ) : error ? (
        <div className="admin-empty">Error loading users: {error}</div>
      ) : users.length === 0 ? (
        <div className="admin-empty">No Talia users yet. Sign in to create the first user.</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr className="admin-table-header-row">
              <th className="admin-table-header-cell">Talia User ID</th>
              <th className="admin-table-header-cell">Email</th>
              <th className="admin-table-header-cell">Name</th>
              <th className="admin-table-header-cell">Role</th>
              <th className="admin-table-header-cell">Status</th>
              <th className="admin-table-header-cell">Created</th>
              <th className="admin-table-header-cell">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.taliaUserId} className="admin-table-row">
                <td className="admin-table-cell">
                  <strong className="admin-mono" style={{ color: '#2E86AB', fontSize: '16px' }}>
                    {user.taliaUserId}
                  </strong>
                </td>
                <td className="admin-table-cell">{user.email}</td>
                <td className="admin-table-cell">{user.name}</td>
                <td className="admin-table-cell">
                  {editingUser === user.taliaUserId ? (
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="admin-select"
                    >
                      <option value="user">User</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                      <option value="guest">Guest</option>
                    </select>
                  ) : (
                    <span style={getRoleBadgeStyle(user.taliaRole)}>
                      {user.taliaRole}
                    </span>
                  )}
                </td>
                <td className="admin-table-cell">
                  <span className={`admin-badge ${user.isActive ? 'admin-badge-active' : 'admin-badge-inactive'}`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="admin-table-cell">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="admin-table-cell">
                  {editingUser === user.taliaUserId ? (
                    <div className="admin-actions">
                      <button
                        onClick={() => handleRoleChange(user.taliaUserId)}
                        className="admin-btn admin-btn-success"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="admin-btn admin-btn-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditing(user)}
                      className="admin-btn admin-btn-primary"
                    >
                      Edit Role
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="admin-info">
        <h3 className="admin-info-title">About Talia Users</h3>
        <ul className="admin-info-list">
          <li><strong>Talia User ID:</strong> Internal numerical ID used throughout the application</li>
          <li><strong>Role-Based Access:</strong> Admin, Manager, User, Guest roles with different permissions</li>
          <li><strong>Independent:</strong> Not tied to any specific authentication system</li>
          <li><strong>Portable:</strong> Easy to export/import when changing databases</li>
        </ul>
      </div>
    </div>
  );
};

export default TaliaUserTable;
