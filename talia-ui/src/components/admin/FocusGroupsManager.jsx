/**
 * Focus Groups Manager Component
 * Admin interface for managing focus groups/screen sets
 */

import React, { useState, useEffect } from 'react';
import { useTaliaFocusManagement } from '../../hooks/useTaliaFocusManagement';

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
      <div style={{ padding: '20px', color: '#c2185b' }}>
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

  const theme = {
    colors: {
      background: '#ffffff',
      foreground: '#2b2b2b',
      accent: '#b08d57',
      border: '#e8dfd0',
      error: '#c2185b',
      success: '#4caf50'
    }
  };

  return (
    <div style={{
      padding: '20px',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: theme.colors.background,
      minHeight: '100vh'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', color: theme.colors.foreground }}>
              Focus Groups Management
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '14px' }}>
              Organize screen sets into groups for better management
            </p>
          </div>
          <button
            onClick={() => {
              setShowCreateForm(true);
              setEditingGroup(null);
              setFormData({ name: '', description: '', isActive: true });
            }}
            style={{
              padding: '10px 20px',
              background: theme.colors.accent,
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            + Create Group
          </button>
        </div>

        {error && (
          <div style={{
            padding: '12px',
            background: '#ffebee',
            color: theme.colors.error,
            borderRadius: '6px',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        {/* Create/Edit Form */}
        {(showCreateForm || editingGroup) && (
          <div style={{
            padding: '20px',
            background: '#f9f9f9',
            borderRadius: '8px',
            marginBottom: '24px',
            border: `1px solid ${theme.colors.border}`
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>
              {editingGroup ? 'Edit Focus Group' : 'Create Focus Group'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                  placeholder="Enter group name"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '4px',
                    fontSize: '14px',
                    minHeight: '80px',
                    resize: 'vertical'
                  }}
                  placeholder="Enter group description"
                />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  <span>Active</span>
                </label>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={editingGroup ? () => handleUpdate(editingGroup) : handleCreate}
                  style={{
                    padding: '8px 16px',
                    background: theme.colors.accent,
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  {editingGroup ? 'Update' : 'Create'}
                </button>
                <button
                  onClick={cancelEdit}
                  style={{
                    padding: '8px 16px',
                    background: '#e0e0e0',
                    color: '#333',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Groups List */}
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div>Loading focus groups...</div>
          </div>
        ) : focusGroups.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#999',
            background: '#f9f9f9',
            borderRadius: '8px'
          }}>
            <p>No focus groups found. Create your first group to get started.</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gap: '16px'
          }}>
            {focusGroups.map((group) => (
              <div
                key={group.id}
                style={{
                  padding: '16px',
                  background: 'white',
                  borderRadius: '8px',
                  border: `1px solid ${theme.colors.border}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px' }}>{group.name}</h3>
                    {group.isActive ? (
                      <span style={{
                        padding: '2px 8px',
                        background: theme.colors.success,
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '12px'
                      }}>
                        Active
                      </span>
                    ) : (
                      <span style={{
                        padding: '2px 8px',
                        background: '#999',
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '12px'
                      }}>
                        Inactive
                      </span>
                    )}
                  </div>
                  {group.description && (
                    <p style={{ margin: '4px 0', color: '#666', fontSize: '14px' }}>
                      {group.description}
                    </p>
                  )}
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
                    Created: {new Date(group.createdAt).toLocaleDateString()}
                    {group.updatedAt !== group.createdAt && (
                      <span> • Updated: {new Date(group.updatedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => startEdit(group)}
                    style={{
                      padding: '6px 12px',
                      background: '#e3f2fd',
                      color: '#1976d2',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(group.id)}
                    style={{
                      padding: '6px 12px',
                      background: '#ffebee',
                      color: theme.colors.error,
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FocusGroupsManager;

