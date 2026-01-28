/**
 * Focus Groups Manager Component
 * Admin interface for managing focus groups/screen sets
 */

import React, { useState, useEffect } from 'react';
import { useTaliaFocusManagement } from '../../../hooks/useTaliaFocusManagement';
import '../admin.css';

const FocusGroupsManager = () => {
  const {
    focusGroups,
    loading,
    error,
    loadFocusGroups,
    createFocusGroup,
    updateFocusGroup,
    deleteFocusGroup,
    isAdmin
  } = useTaliaFocusManagement();

  const [editingGroup, setEditingGroup] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true
  });

  useEffect(() => {
    loadFocusGroups();
  }, [loadFocusGroups]);

  if (!isAdmin) {
    return (
      <div className="admin-section" style={{ color: '#c2185b' }}>
        <h2>Access Denied</h2>
        <p>Admin access required to manage focus groups.</p>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      alert('Group name is required');
      return;
    }

    try {
      await createFocusGroup(formData);
      setShowCreateForm(false);
      setFormData({ name: '', description: '', isActive: true });
      loadFocusGroups();
    } catch (err) {
      console.error('Error creating focus group:', err);
    }
  };

  const handleUpdate = async (groupId) => {
    if (!formData.name.trim()) {
      alert('Group name is required');
      return;
    }

    try {
      await updateFocusGroup(groupId, formData);
      setEditingGroup(null);
      setFormData({ name: '', description: '', isActive: true });
      loadFocusGroups();
    } catch (err) {
      console.error('Error updating focus group:', err);
    }
  };

  const handleDelete = async (groupId) => {
    if (!confirm('Are you sure you want to delete this focus group?')) {
      return;
    }

    try {
      await deleteFocusGroup(groupId);
      loadFocusGroups();
    } catch (err) {
      console.error('Error deleting focus group:', err);
    }
  };

  const startEdit = (group) => {
    setEditingGroup(group.id);
    setFormData({
      name: group.name,
      description: group.description || '',
      isActive: group.isActive
    });
    setShowCreateForm(false);
  };

  const cancelEdit = () => {
    setEditingGroup(null);
    setShowCreateForm(false);
    setFormData({ name: '', description: '', isActive: true });
  };

  return (
    <div className="admin-section">
      <div className="admin-page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="admin-page-title" style={{ fontSize: '24px', margin: 0 }}>Focus Groups Management</h1>
          <p className="admin-page-subtitle" style={{ marginTop: '4px' }}>
            Organize screen sets into groups for better management
          </p>
        </div>
        <button
          onClick={() => {
            setShowCreateForm(true);
            setEditingGroup(null);
            setFormData({ name: '', description: '', isActive: true });
          }}
          className="admin-btn admin-btn-accent"
          style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '500' }}
        >
          + Create Group
        </button>
      </div>

        {error && (
          <div className="admin-error" style={{ marginBottom: '20px' }}>
            {error}
          </div>
        )}

        {(showCreateForm || editingGroup) && (
          <div className="admin-form-card">
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>
              {editingGroup ? 'Edit Focus Group' : 'Create Focus Group'}
            </h3>
            <div className="admin-form-row">
              <div>
                <label className="admin-label">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="admin-input"
                  placeholder="Enter group name"
                />
              </div>
              <div>
                <label className="admin-label">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="admin-textarea"
                  placeholder="Enter group description"
                />
              </div>
              <div>
                <label className="admin-checkbox-row">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  <span>Active</span>
                </label>
              </div>
              <div className="admin-actions">
                <button
                  onClick={editingGroup ? () => handleUpdate(editingGroup) : handleCreate}
                  className="admin-btn admin-btn-accent"
                  style={{ fontSize: '14px' }}
                >
                  {editingGroup ? 'Update' : 'Create'}
                </button>
                <button
                  onClick={cancelEdit}
                  className="admin-btn admin-btn-muted"
                  style={{ fontSize: '14px' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="admin-loading">Loading focus groups...</div>
        ) : focusGroups.length === 0 ? (
          <div className="admin-empty">No focus groups found. Create your first group to get started.</div>
        ) : (
          <div className="admin-grid">
            {focusGroups.map((group) => (
              <div
                key={group.id}
                className="admin-card-row"
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <h3 className="admin-card-title">{group.name}</h3>
                    {group.isActive ? (
                      <span className="admin-badge admin-btn-success" style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '12px' }}>
                        Active
                      </span>
                    ) : (
                      <span className="admin-badge admin-btn-muted" style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '12px' }}>
                        Inactive
                      </span>
                    )}
                  </div>
                  {group.description && (
                    <p className="admin-card-subtitle">
                      {group.description}
                    </p>
                  )}
                  <div className="admin-card-meta">
                    Created: {new Date(group.createdAt).toLocaleDateString()}
                    {group.updatedAt !== group.createdAt && (
                      <span> • Updated: {new Date(group.updatedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="admin-actions">
                  <button
                    onClick={() => startEdit(group)}
                    className="admin-btn admin-btn-light"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(group.id)}
                    className="admin-btn admin-btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
};

export default FocusGroupsManager;
