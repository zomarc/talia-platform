/**
 * Focus Selector Component
 * User interface for selecting and switching between focuses
 */

import React, { useState } from 'react';
import { useFocusManagement } from '../../hooks/useFocusManagement';
import { useSupabaseAuth } from '../../contexts/SupabaseAuthContext';

const FocusSelector = ({ onFocusChange, onSaveCurrentLayout }) => {
  const { user } = useSupabaseAuth();
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
      type: 'USER', // Must be uppercase enum: USER, STANDARD, TEMPLATE, SHARED
      role: user.role || 'USER', // Must be uppercase enum: ADMIN, MANAGER, USER, GUEST
      components: [
        {
          type: 'TABLE', // Must be uppercase enum: CHART, TABLE, KPI, GRAPHQL_PANEL
          position: { x: 0, y: 0, width: 6, height: 4 },
          settings: null,
          dataSource: null
        }
      ],
      isPublic: false
    };

    const success = await createFocus(customFocusData);
    if (success) {
      setNewFocusName('');
      setShowCreateForm(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-focus-selector">
        <div className="dashboard-loading">
          <div className="dashboard-loading__text">Loading focuses...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-focus-selector">
      {/* Compact header */}
      <div className="dashboard-focus-selector__header">
        <span className="dashboard-focus-selector__title">
          Focus Management
        </span>
        {canCreateFocus && (
          <button 
            onClick={() => setShowCreateForm(true)}
            className="dashboard-focus-selector__new-btn"
          >
            + New
          </button>
        )}
      </div>

      {error && (
        <div className="dashboard-error">
          <div className="dashboard-error__message">Error: {error}</div>
        </div>
      )}

      {showCreateForm && (
        <div className="dashboard-modal-overlay" onClick={() => {
          setShowCreateForm(false);
          setNewFocusName('');
        }}>
          <div className="dashboard-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dashboard-modal__header">
              <h4 className="dashboard-modal__title">Create Custom Focus</h4>
              <button 
                onClick={() => {
                  setShowCreateForm(false);
                  setNewFocusName('');
                }}
                className="dashboard-modal__close-btn"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateCustomFocus}>
              <div className="dashboard-modal__form-group">
                <label htmlFor="focusName" className="dashboard-modal__label">Focus Name</label>
                <input
                  type="text"
                  id="focusName"
                  className="dashboard-modal__input"
                  value={newFocusName}
                  onChange={(e) => setNewFocusName(e.target.value)}
                  placeholder="Enter focus name..."
                  required
                />
              </div>
              <div className="dashboard-modal__actions">
                <button type="submit" className="dashboard-modal__btn dashboard-modal__btn--primary">
                  Create Focus
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewFocusName('');
                  }}
                  className="dashboard-modal__btn dashboard-modal__btn--secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="dashboard-focus-selector__sections">
        {/* Current Focus - Compact */}
        {currentFocus && (
          <div className="dashboard-focus-section">
            <div 
              className={`dashboard-focus-item dashboard-focus-item--current`}
              onClick={() => handleFocusSelect(currentFocus.id)}
            >
              <div className="dashboard-focus-item__header">
                <span className="dashboard-focus-item__name">
                  {currentFocus.name}
                </span>
                <button 
                  onClick={(e) => handleToggleFavorite(currentFocus.id, e)}
                  className={`dashboard-focus-item__favorite-btn ${favoriteFocuses.find(f => f.id === currentFocus.id) ? 'dashboard-focus-item__favorite-btn--active' : ''}`}
                  title="Toggle favorite"
                >
                  ★
                </button>
              </div>
              <div className="dashboard-focus-item__meta">
                <span className="dashboard-focus-item__type">{currentFocus.type}</span>
                {currentFocus.isDefault && <span>Default</span>}
              </div>
            </div>
            
            {/* Save Current Layout Button - Compact */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSaveCurrentLayout();
              }}
              className="dashboard-focus-item__save-btn"
              title="Save current layout to this focus"
            >
              💾 Save Layout
            </button>
          </div>
        )}

        {/* Favorite Focuses */}
        {favoriteFocuses.length > 0 && (
          <div className="dashboard-focus-section">
            <div className="dashboard-focus-section__title">Favorites</div>
            <div className="dashboard-focus-section__list">
              {favoriteFocuses.map(focus => (
                <div 
                  key={focus.id || focus.taliaFocusId} 
                  className={`dashboard-focus-item ${currentFocus?.id === (focus.id || focus.taliaFocusId) ? 'dashboard-focus-item--current' : ''}`}
                  onClick={() => handleFocusSelect(focus.id || focus.taliaFocusId)}
                >
                  <div className="dashboard-focus-item__header">
                    <span className="dashboard-focus-item__name">{focus.name}</span>
                    <button 
                      onClick={(e) => handleToggleFavorite(focus.id || focus.taliaFocusId, e)}
                      className="dashboard-focus-item__favorite-btn dashboard-focus-item__favorite-btn--active"
                      title="Remove from favorites"
                    >
                      ★
                    </button>
                  </div>
                  <div className="dashboard-focus-item__meta">
                    <span className="dashboard-focus-item__type">{focus.type}</span>
                    {focus.isDefault && <span>Default</span>}
                  </div>
                </div>
              ))}
            </div>
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
        <div className="dashboard-focus-section dashboard-focus-section--scrollable">
          <div className="dashboard-focus-section__title">
            All Focuses ({focuses.length})
          </div>
          <div className="dashboard-focus-section__list">
            {focuses.map(focus => (
              <div 
                key={focus.id} 
                className={`dashboard-focus-item ${currentFocus?.id === focus.id ? 'dashboard-focus-item--current' : ''}`}
                onClick={() => handleFocusSelect(focus.id)}
              >
                <div className="dashboard-focus-item__header">
                  <span className="dashboard-focus-item__name">
                    {focus.name}
                  </span>
                  <button 
                    onClick={(e) => handleToggleFavorite(focus.id, e)}
                    className={`dashboard-focus-item__favorite-btn ${favoriteFocuses.find(f => f.id === focus.id) ? 'dashboard-focus-item__favorite-btn--active' : ''}`}
                    title="Toggle favorite"
                  >
                    ★
                  </button>
                </div>
                <div className="dashboard-focus-item__meta">
                  <span className="dashboard-focus-item__type">{focus.type}</span>
                  {focus.isDefault && <span>Default</span>}
                  {focus.isStandard && <span>Standard</span>}
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
