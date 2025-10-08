/**
 * Focus Manager Component
 * Administrative interface for managing focuses
 */

import React, { useState } from 'react';
import { useFocusManagement } from '../../hooks/useFocusManagement';
import { useAuth } from '../../contexts/AuthContext';
import './focus-management.css';

const FocusManager = () => {
  const { user } = useAuth();
  const {
    focuses,
    loading,
    error,
    createFocus,
    updateFocus,
    deleteFocus,
    initializeStandardFocuses,
    canModifyFocus
  } = useFocusManagement();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingFocus, setEditingFocus] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'standard',
    role: 'user',
    isDefault: false,
    isPublic: false
  });

  // Check if user has admin access
  if (!user || user.role !== 'admin') {
    return (
      <div className="focus-manager">
        <div className="error-message">
          <h2>Access Denied</h2>
          <p>Administrator access required to manage focuses.</p>
        </div>
      </div>
    );
  }

  const handleCreateFocus = async (e) => {
    e.preventDefault();
    const success = await createFocus(formData);
    if (success) {
      setShowCreateForm(false);
      setFormData({
        name: '',
        description: '',
        type: 'standard',
        role: 'user',
        isDefault: false,
        isPublic: false
      });
    }
  };

  const handleEditFocus = (focus) => {
    setEditingFocus(focus);
    setFormData({
      name: focus.name,
      description: focus.description,
      type: focus.type,
      role: focus.role,
      isDefault: focus.isDefault,
      isPublic: focus.isPublic
    });
    setShowCreateForm(true);
  };

  const handleUpdateFocus = async (e) => {
    e.preventDefault();
    if (editingFocus) {
      const success = await updateFocus(editingFocus.id, formData);
      if (success) {
        setShowCreateForm(false);
        setEditingFocus(null);
        setFormData({
          name: '',
          description: '',
          type: 'standard',
          role: 'user',
          isDefault: false,
          isPublic: false
        });
      }
    }
  };

  const handleDeleteFocus = async (focusId) => {
    if (window.confirm('Are you sure you want to delete this focus? This action cannot be undone.')) {
      await deleteFocus(focusId);
    }
  };

  const handleInitializeStandardFocuses = async () => {
    if (window.confirm('This will create the standard focuses. Continue?')) {
      await initializeStandardFocuses();
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  if (loading) {
    return (
      <div className="focus-manager">
        <div className="loading">Loading focuses...</div>
      </div>
    );
  }

  return (
    <div className="focus-manager">
      <div className="focus-manager-header">
        <h2>Focus Management</h2>
        <div className="focus-manager-actions">
          <button 
            onClick={() => setShowCreateForm(true)}
            className="btn btn-primary"
          >
            Create New Focus
          </button>
          <button 
            onClick={handleInitializeStandardFocuses}
            className="btn btn-secondary"
          >
            Initialize Standard Focuses
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <p>Error: {error}</p>
        </div>
      )}

      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingFocus ? 'Edit Focus' : 'Create New Focus'}</h3>
              <button 
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingFocus(null);
                  setFormData({
                    name: '',
                    description: '',
                    type: 'standard',
                    role: 'user',
                    isDefault: false,
                    isPublic: false
                  });
                }}
                className="btn-close"
              >
                ×
              </button>
            </div>
            <form onSubmit={editingFocus ? handleUpdateFocus : handleCreateFocus}>
              <div className="form-group">
                <label htmlFor="name">Focus Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  rows="3"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="type">Type</label>
                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleFormChange}
                >
                  <option value="standard">Standard</option>
                  <option value="template">Template</option>
                  <option value="shared">Shared</option>
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="role">Required Role</label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleFormChange}
                >
                  <option value="guest">Guest</option>
                  <option value="user">User</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="isDefault"
                    checked={formData.isDefault}
                    onChange={handleFormChange}
                  />
                  Set as default focus for this role
                </label>
              </div>
              
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="isPublic"
                    checked={formData.isPublic}
                    onChange={handleFormChange}
                  />
                  Make publicly available
                </label>
              </div>
              
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  {editingFocus ? 'Update Focus' : 'Create Focus'}
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingFocus(null);
                    setFormData({
                      name: '',
                      description: '',
                      type: 'standard',
                      role: 'user',
                      isDefault: false,
                      isPublic: false
                    });
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="focus-list">
        <h3>Available Focuses</h3>
        {focuses.length === 0 ? (
          <p>No focuses available. Click "Initialize Standard Focuses" to get started.</p>
        ) : (
          <div className="focus-grid">
            {focuses.map(focus => (
              <div key={focus.id} className="focus-card">
                <div className="focus-card-header">
                  <h4>{focus.name}</h4>
                  <div className="focus-type-badge">
                    {focus.type}
                  </div>
                </div>
                <p className="focus-description">{focus.description}</p>
                <div className="focus-meta">
                  <span className="focus-role">Role: {focus.role}</span>
                  {focus.isDefault && <span className="focus-default">Default</span>}
                  {focus.isPublic && <span className="focus-public">Public</span>}
                </div>
                <div className="focus-actions">
                  {canModifyFocus && (
                    <button 
                      onClick={() => handleEditFocus(focus)}
                      className="btn btn-sm btn-secondary"
                    >
                      Edit
                    </button>
                  )}
                  {canModifyFocus && (
                    <button 
                      onClick={() => handleDeleteFocus(focus.id)}
                      className="btn btn-sm btn-danger"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FocusManager;
