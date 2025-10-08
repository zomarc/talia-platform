/**
 * Talia User Table Component
 * Displays Talia's internal user system (separate from auth)
 */

import React, { useState } from 'react';
import taliaUserService from '../../services/TaliaUserService';

const TaliaUserTable = () => {
  const [users, setUsers] = useState(taliaUserService.getAllTaliaUsers());
  const [editingUser, setEditingUser] = useState(null);
  const [newRole, setNewRole] = useState('');

  const handleRoleChange = (taliaUserId) => {
    if (newRole) {
      taliaUserService.updateTaliaUserRole(taliaUserId, newRole);
      setUsers(taliaUserService.getAllTaliaUsers());
      setEditingUser(null);
      setNewRole('');
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
    <div style={styles.container}>
      <h2 style={styles.title}>Talia Users</h2>
      <p style={styles.subtitle}>
        Internal Talia user system - manages user roles and permissions.
        <br />
        <em>Note: This is independent of authentication. Users are identified by Talia user ID.</em>
      </p>

      {users.length === 0 ? (
        <div style={styles.empty}>No Talia users yet. Sign in to create the first user.</div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr style={styles.headerRow}>
              <th style={styles.headerCell}>Talia User ID</th>
              <th style={styles.headerCell}>Email</th>
              <th style={styles.headerCell}>Name</th>
              <th style={styles.headerCell}>Role</th>
              <th style={styles.headerCell}>Status</th>
              <th style={styles.headerCell}>Created</th>
              <th style={styles.headerCell}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.taliaUserId} style={styles.dataRow}>
                <td style={styles.dataCell}>
                  <strong style={styles.taliaId}>{user.taliaUserId}</strong>
                </td>
                <td style={styles.dataCell}>{user.email}</td>
                <td style={styles.dataCell}>{user.name}</td>
                <td style={styles.dataCell}>
                  {editingUser === user.taliaUserId ? (
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      style={styles.roleSelect}
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
                <td style={styles.dataCell}>
                  <span style={{
                    ...styles.statusBadge,
                    backgroundColor: user.isActive ? '#d4edda' : '#f8d7da',
                    color: user.isActive ? '#155724' : '#721c24'
                  }}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={styles.dataCell}>
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td style={styles.dataCell}>
                  {editingUser === user.taliaUserId ? (
                    <div style={styles.actionButtons}>
                      <button
                        onClick={() => handleRoleChange(user.taliaUserId)}
                        style={styles.saveButton}
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEditing}
                        style={styles.cancelButton}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditing(user)}
                      style={styles.editButton}
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

      <div style={styles.info}>
        <h3 style={styles.infoTitle}>About Talia Users</h3>
        <ul style={styles.infoList}>
          <li><strong>Talia User ID:</strong> Internal numerical ID used throughout the application</li>
          <li><strong>Role-Based Access:</strong> Admin, Manager, User, Guest roles with different permissions</li>
          <li><strong>Independent:</strong> Not tied to any specific authentication system</li>
          <li><strong>Portable:</strong> Easy to export/import when changing databases</li>
        </ul>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px'
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
    borderBottom: '1px solid #dee2e6'
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
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  roleSelect: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #dee2e6',
    fontSize: '14px'
  },
  actionButtons: {
    display: 'flex',
    gap: '8px'
  },
  editButton: {
    padding: '6px 12px',
    backgroundColor: '#2E86AB',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  saveButton: {
    padding: '6px 12px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  cancelButton: {
    padding: '6px 12px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold'
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

export default TaliaUserTable;
