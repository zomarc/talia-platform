/**
 * Focus Selector Component
 * User interface for selecting and switching between focuses
 */

import React, { useState } from 'react';
import { useFocusManagement } from '../../hooks/useFocusManagement';
import { useAuth } from '../../contexts/AuthContext';

const FocusSelector = ({ onFocusChange, onSaveCurrentLayout }) => {
  const { user } = useAuth();
  const {
    focuses,
    currentFocus,
    loading,
    error,
    loadFocus,
    createFocus,
    toggleFavorite,
    favoriteFocuses,
    canCreateFocus
  } = useFocusManagement();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFocusName, setNewFocusName] = useState('');

  const handleFocusSelect = async (focusId) => {
    await loadFocus(focusId);
    if (onFocusChange) {
      onFocusChange(focusId);
    }
  };

  const handleToggleFavorite = async (focusId, e) => {
    e.stopPropagation();
    await toggleFavorite(focusId);
  };

  const handleSaveCurrentLayout = async () => {
    if (!currentFocus) {
      alert('No focus selected to save layout to');
      return;
    }
    
    if (onSaveCurrentLayout) {
      await onSaveCurrentLayout(currentFocus.id);
    }
  };

  const handleCreateCustomFocus = async (e) => {
    e.preventDefault();
    if (!newFocusName.trim()) return;

    const customFocusData = {
      name: newFocusName.trim(),
      description: `Custom focus created by ${user.name}`,
      type: 'user',
      assignedRoles: [user.role],
      layoutData: {
        components: [
          {
            type: 'panel',
            title: 'Welcome Panel',
            position: { x: 0, y: 0, width: 12, height: 6 }
          }
        ]
      }
    };

    const success = await createFocus(customFocusData);
    if (success) {
      setNewFocusName('');
      setShowCreateForm(false);
    }
  };

  if (loading) {
    return (
      <div className="focus-selector">
        <div className="loading">Loading focuses...</div>
      </div>
    );
  }

  return (
    <div className="focus-selector" style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '0', // Allow flex child to shrink below content size
      overflow: 'hidden' // Prevent overflow
    }}>
      {/* Compact header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '8px',
        paddingBottom: '4px',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#2E86AB' }}>
          Focus Management
        </span>
        {canCreateFocus && (
          <button 
            onClick={() => setShowCreateForm(true)}
            className="btn btn-sm btn-primary"
            style={{ fontSize: '10px', padding: '2px 6px' }}
          >
            + New
          </button>
        )}
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
              <h4>Create Custom Focus</h4>
              <button 
                onClick={() => {
                  setShowCreateForm(false);
                  setNewFocusName('');
                }}
                className="btn-close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateCustomFocus}>
              <div className="form-group">
                <label htmlFor="focusName">Focus Name</label>
                <input
                  type="text"
                  id="focusName"
                  value={newFocusName}
                  onChange={(e) => setNewFocusName(e.target.value)}
                  placeholder="Enter focus name..."
                  required
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  Create Focus
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewFocusName('');
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

      <div className="focus-sections" style={{ 
        flex: '1', 
        overflow: 'hidden', 
        display: 'flex', 
        flexDirection: 'column',
        minHeight: '0', // Allow flex child to shrink below content size
        height: '100%' // Ensure it takes full height
      }}>
        {/* Current Focus - Compact */}
        {currentFocus && (
          <div className="focus-section" style={{ flexShrink: '0', marginBottom: '8px' }}>
            <div 
              className={`focus-item current ${currentFocus.isDefault ? 'default' : ''}`}
              onClick={() => handleFocusSelect(currentFocus.id)}
              style={{ 
                padding: '6px 8px', 
                marginBottom: '6px',
                border: '2px solid #2E86AB',
                borderRadius: '4px',
                background: '#f8f9fa'
              }}
            >
              <div className="focus-item-header" style={{ marginBottom: '2px' }}>
                <span className="focus-name" style={{ fontWeight: 'bold', fontSize: '12px' }}>
                  {currentFocus.name}
                </span>
                <button 
                  onClick={(e) => handleToggleFavorite(currentFocus.id, e)}
                  className={`favorite-btn ${favoriteFocuses.find(f => f.id === currentFocus.id) ? 'favorited' : ''}`}
                  title="Toggle favorite"
                  style={{ fontSize: '10px' }}
                >
                  ★
                </button>
              </div>
              <div className="focus-meta" style={{ fontSize: '9px', color: '#666' }}>
                <span className="focus-type">{currentFocus.type}</span>
                {currentFocus.isDefault && <span className="focus-default">Default</span>}
              </div>
            </div>
            
            {/* Save Current Layout Button - Compact */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSaveCurrentLayout();
              }}
              className="btn btn-primary"
              style={{ 
                width: '100%', 
                fontSize: '10px', 
                padding: '3px 6px',
                marginBottom: '6px'
              }}
              title="Save current layout to this focus"
            >
              💾 Save Layout
            </button>
          </div>
        )}

        {/* Favorite Focuses */}
        {favoriteFocuses.length > 0 && (
          <div className="focus-section">
            <h4>Favorites</h4>
            {favoriteFocuses.map(focus => (
              <div 
                key={focus.taliaFocusId} 
                className={`focus-item ${currentTaliaFocus?.taliaFocusId === focus.taliaFocusId ? 'active' : ''}`}
                onClick={() => handleFocusSelect(focus.taliaFocusId)}
              >
                <div className="focus-item-header">
                  <span className="focus-name">{focus.name}</span>
                  <button 
                    onClick={(e) => handleToggleFavorite(focus.id, e)}
                    className="favorite-btn favorited"
                    title="Remove from favorites"
                  >
                    ★
                  </button>
                </div>
                <p className="focus-description">{focus.description}</p>
                <div className="focus-meta">
                  <span className="focus-type">{focus.type}</span>
                  {focus.isDefault && <span className="focus-default">Default</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recently Used Focuses - TODO: Implement in Talia system */}
        {/* {recentlyUsedFocuses.length > 0 && (
          <div className="focus-section">
            <h4>Recently Used</h4>
            {recentlyUsedFocuses.slice(0, 3).map(focus => (
              <div 
                key={focus.taliaFocusId} 
                className={`focus-item ${currentTaliaFocus?.taliaFocusId === focus.taliaFocusId ? 'active' : ''}`}
                onClick={() => handleFocusSelect(focus.taliaFocusId)}
              >
                <div className="focus-item-header">
                  <span className="focus-name">{focus.name}</span>
                  <button 
                    onClick={(e) => handleToggleFavorite(focus.taliaFocusId, e)}
                    className={`favorite-btn ${favoriteFocuses.find(f => f.taliaFocusId === focus.taliaFocusId) ? 'favorited' : ''}`}
                    title="Toggle favorite"
                  >
                    ★
                  </button>
                </div>
                <p className="focus-description">{focus.description}</p>
                <div className="focus-meta">
                  <span className="focus-type">{focus.type}</span>
                  {focus.isDefault && <span className="focus-default">Default</span>}
                </div>
              </div>
            ))}
          </div>
        )} */}

        {/* All Available Focuses - Fill Available Space */}
        <div className="focus-section" style={{ 
          flex: '1', 
          display: 'flex', 
          flexDirection: 'column',
          minHeight: '0', // Allow flex child to shrink
          overflow: 'hidden' // Prevent this section from overflowing
        }}>
          <div style={{ 
            fontSize: '12px', 
            fontWeight: 'bold', 
            color: '#2E86AB', 
            marginBottom: '6px',
            paddingBottom: '2px',
            borderBottom: '1px solid #e0e0e0',
            flexShrink: '0' // Don't shrink the header
          }}>
            All Focuses ({focuses.length})
          </div>
          <div style={{ 
            flex: '1', 
            overflowY: 'auto', 
            minHeight: '0', // Allow to shrink below content size
            maxHeight: 'none', // Remove any max height constraints
            height: '100%' // Ensure it takes full available height
          }}>
            {focuses.map(focus => (
              <div 
                key={focus.id} 
                className={`focus-item ${currentFocus?.id === focus.id ? 'active' : ''}`}
                onClick={() => handleFocusSelect(focus.id)}
                style={{ 
                  padding: '6px 8px', 
                  marginBottom: '4px',
                  borderRadius: '3px',
                  border: currentFocus?.id === focus.id ? '1px solid #2E86AB' : '1px solid #e0e0e0',
                  background: currentFocus?.id === focus.id ? '#f8f9fa' : 'white',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                <div className="focus-item-header" style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '2px'
                }}>
                  <span className="focus-name" style={{ 
                    fontWeight: currentFocus?.id === focus.id ? 'bold' : 'normal',
                    fontSize: '12px'
                  }}>
                    {focus.name}
                  </span>
                  <button 
                    onClick={(e) => handleToggleFavorite(focus.id, e)}
                    className={`favorite-btn ${favoriteFocuses.find(f => f.id === focus.id) ? 'favorited' : ''}`}
                    title="Toggle favorite"
                    style={{ fontSize: '10px', padding: '2px' }}
                  >
                    ★
                  </button>
                </div>
                <div className="focus-meta" style={{ 
                  fontSize: '9px', 
                  color: '#666',
                  display: 'flex',
                  gap: '4px'
                }}>
                  <span className="focus-type">{focus.type}</span>
                  {focus.isDefault && <span className="focus-default">Default</span>}
                  {focus.isStandard && <span className="focus-public">Standard</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FocusSelector;
