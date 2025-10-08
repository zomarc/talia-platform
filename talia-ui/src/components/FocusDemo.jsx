/**
 * Focus Management Demo Component
 * Demonstrates the complete focus management system
 */

import React, { useState } from 'react';
import { useFocusManagement } from '../hooks/useFocusManagement';
import { useAuth } from '../contexts/AuthContext';
import { FocusManager, FocusSelector, FocusLayoutEditor } from './focus-management';
import './focus-management/focus-management.css';

const FocusDemo = () => {
  const { user } = useAuth();
  const {
    currentFocus,
    loading,
    error
  } = useFocusManagement();

  const [activeTab, setActiveTab] = useState('selector');
  const [editingFocus, setEditingFocus] = useState(null);

  const handleFocusChange = (focusId) => {
    console.log('Focus changed to:', focusId);
  };

  const handleEditFocus = (focusId) => {
    setEditingFocus(focusId);
    setActiveTab('editor');
  };

  const handleSaveFocus = () => {
    setEditingFocus(null);
    setActiveTab('selector');
  };

  const handleCancelEdit = () => {
    setEditingFocus(null);
    setActiveTab('selector');
  };

  if (loading) {
    return (
      <div className="focus-demo">
        <div className="loading">Loading focus management system...</div>
      </div>
    );
  }

  return (
    <div className="focus-demo">
      <div className="focus-demo-header">
        <h1>Talia Focus Management System</h1>
        <div className="demo-tabs">
          <button 
            className={`tab ${activeTab === 'selector' ? 'active' : ''}`}
            onClick={() => setActiveTab('selector')}
          >
            Focus Selector
          </button>
          {user?.role === 'admin' && (
            <button 
              className={`tab ${activeTab === 'manager' ? 'active' : ''}`}
              onClick={() => setActiveTab('manager')}
            >
              Focus Manager
            </button>
          )}
          {editingFocus && (
            <button 
              className={`tab ${activeTab === 'editor' ? 'active' : ''}`}
              onClick={() => setActiveTab('editor')}
            >
              Layout Editor
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          <p>Error: {error}</p>
        </div>
      )}

      <div className="focus-demo-content">
        {activeTab === 'selector' && (
          <div className="demo-panel">
            <h2>Focus Selector</h2>
            <p>Select and switch between different focuses. Users can create custom focuses and mark favorites.</p>
            <FocusSelector onFocusChange={handleFocusChange} />
          </div>
        )}

        {activeTab === 'manager' && user?.role === 'admin' && (
          <div className="demo-panel">
            <h2>Focus Manager (Admin Only)</h2>
            <p>Administrative interface for managing standard focuses and system configuration.</p>
            <FocusManager />
          </div>
        )}

        {activeTab === 'editor' && editingFocus && (
          <div className="demo-panel">
            <h2>Focus Layout Editor</h2>
            <p>Edit the layout and components of a focus. Drag and drop components to customize the layout.</p>
            <FocusLayoutEditor 
              focusId={editingFocus}
              onSave={handleSaveFocus}
              onCancel={handleCancelEdit}
            />
          </div>
        )}
      </div>

      {/* Current Focus Display */}
      {currentFocus && (
        <div className="current-focus-display">
          <h3>Current Focus: {currentFocus.name}</h3>
          <div className="focus-info">
            <p><strong>Description:</strong> {currentFocus.description}</p>
            <p><strong>Type:</strong> {currentFocus.type}</p>
            <p><strong>Role:</strong> {currentFocus.role}</p>
            <p><strong>Components:</strong> {currentFocus.components?.length || 0}</p>
          </div>
          
          {currentFocus.components && currentFocus.components.length > 0 && (
            <div className="components-preview">
              <h4>Components:</h4>
              <div className="components-grid">
                {currentFocus.components.map(component => (
                  <div key={component.id} className="component-preview">
                    <span className="component-title">{component.title}</span>
                    <span className="component-type">{component.componentType}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {user?.role === 'admin' && (
            <div className="admin-actions">
              <button 
                onClick={() => handleEditFocus(currentFocus.id)}
                className="btn btn-primary"
              >
                Edit Layout
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FocusDemo;
