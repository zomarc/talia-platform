/**
 * Focus Selector Component
 * User interface for selecting and switching between focuses
 */

import React, { useState } from 'react';
import { useFocusManagement } from '../../hooks/useFocusManagement';
import { useSupabaseAuth } from '../../contexts/SupabaseAuthContext';

function reorderUpdates(list, fromId, toId) {
  const ids = list.map((focus) => focus.id);
  const from = ids.indexOf(fromId);
  const to = ids.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return [];
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  const slots = list.map((focus) => Number(focus.sortOrder) || 0).sort((a, b) => a - b);
  const useSlots = slots.every((value) => value > 0) && new Set(slots).size === slots.length;
  return next
    .map((focus, index) => ({
      id: focus.id,
      sortOrder: useSlots ? slots[index] : index + 1,
    }))
    .filter((update) => {
      const current = list.find((focus) => focus.id === update.id);
      return Number(current?.sortOrder) !== update.sortOrder;
    });
}

function FocusOrderRow({
  focus,
  selected,
  list,
  draggingId,
  setDraggingId,
  onSelect,
  onToggleFavorite,
  onReorder,
  onToggleLegacy,
  showStandard,
  starred,
}) {
  const legacy = focus.isLegacy === true;
  return (
    <div
      className={`dashboard-focus-item ${selected ? 'dashboard-focus-item--current' : ''} ${draggingId === focus.id ? 'dashboard-focus-item--dragging' : ''} ${legacy ? 'dashboard-focus-item--legacy' : ''}`}
      onClick={() => onSelect(focus.id)}
      onDragOver={(event) => {
        if (!draggingId || draggingId === focus.id) return;
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const fromId = event.dataTransfer.getData('text/plain') || draggingId;
        const updates = reorderUpdates(list, fromId, focus.id);
        setDraggingId(null);
        if (updates.length) onReorder(updates);
      }}
    >
      <div className="dashboard-focus-item__header">
        <span
          className="dashboard-focus-item__drag"
          draggable
          title="Drag to reorder"
          onClick={(event) => event.stopPropagation()}
          onDragStart={(event) => {
            event.stopPropagation();
            event.dataTransfer.setData('text/plain', focus.id);
            event.dataTransfer.effectAllowed = 'move';
            setDraggingId(focus.id);
          }}
          onDragEnd={() => setDraggingId(null)}
        >
          ⋮⋮
        </span>
        <span className="dashboard-focus-item__name">{focus.name}</span>
        <button
          type="button"
          onClick={(event) => onToggleLegacy(focus.id, !legacy, event)}
          className={`dashboard-focus-item__legacy-btn ${legacy ? 'dashboard-focus-item__legacy-btn--active' : ''}`}
          title={legacy ? 'Retired / legacy — still in the list' : 'Mark as retired / legacy'}
        >
          L
        </button>
        <button
          onClick={(event) => onToggleFavorite(focus.id, event)}
          className={`dashboard-focus-item__favorite-btn ${starred ? 'dashboard-focus-item__favorite-btn--active' : ''}`}
          title={starred ? 'Remove from starred' : 'Star this focus'}
        >
          ★
        </button>
      </div>
      <div className="dashboard-focus-item__meta">
        <span className="dashboard-focus-item__type">{focus.type}</span>
        {focus.isDefault && <span>Default</span>}
        {showStandard && focus.isStandard && <span>Standard</span>}
      </div>
    </div>
  );
}

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
    toggleFocusLegacy,
    reorderFocuses,
    favoriteFocuses,
    canCreateFocus
  } = useFocusManagement();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFocusName, setNewFocusName] = useState('');
  const [starredOpen, setStarredOpen] = useState(true);
  const [restOpen, setRestOpen] = useState(false);
  const [retiredOpen, setRetiredOpen] = useState(false);
  const [draggingId, setDraggingId] = useState(null);

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

  const handleToggleLegacy = async (focusId, isLegacy, event) => {
    event.stopPropagation();
    await toggleFocusLegacy(focusId, isLegacy);
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

  const starredIds = new Set(favoriteFocuses.map((focus) => focus.id || focus.taliaFocusId));
  const retiredFocuses = focuses.filter((focus) => focus.isLegacy === true);
  const primaryFocuses = favoriteFocuses.filter((focus) => focus.isLegacy !== true);
  const additionalFocuses = focuses.filter((focus) => focus.isLegacy !== true && !starredIds.has(focus.id));

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
              className={`dashboard-focus-item dashboard-focus-item--current ${currentFocus.isLegacy ? 'dashboard-focus-item--legacy' : ''}`}
              onClick={() => handleFocusSelect(currentFocus.id)}
            >
              <div className="dashboard-focus-item__header">
                <span className="dashboard-focus-item__name">
                  {currentFocus.name}
                </span>
                <button
                  type="button"
                  onClick={(event) => handleToggleLegacy(currentFocus.id, !currentFocus.isLegacy, event)}
                  className={`dashboard-focus-item__legacy-btn ${currentFocus.isLegacy ? 'dashboard-focus-item__legacy-btn--active' : ''}`}
                  title={currentFocus.isLegacy ? 'Retired / legacy — still in the list' : 'Mark as retired / legacy'}
                >
                  L
                </button>
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

        <div className="dashboard-focus-section">
          <button
            type="button"
            className="dashboard-focus-section__title dashboard-focus-section__title--toggle"
            aria-expanded={starredOpen}
            onClick={() => setStarredOpen((open) => !open)}
          >
            <span>{starredOpen ? '▼' : '▶'} Starred (Primary) ({primaryFocuses.length})</span>
          </button>
          {starredOpen && (
            <div className="dashboard-focus-section__list">
              {primaryFocuses.length === 0 && (
                <div className="dashboard-focus-section__empty">Star a focus to pin it here.</div>
              )}
              {primaryFocuses.map(focus => (
                <FocusOrderRow
                  key={focus.id || focus.taliaFocusId}
                  focus={focus}
                  list={primaryFocuses}
                  selected={currentFocus?.id === (focus.id || focus.taliaFocusId)}
                  draggingId={draggingId}
                  setDraggingId={setDraggingId}
                  onSelect={handleFocusSelect}
                  onToggleFavorite={handleToggleFavorite}
                  onReorder={reorderFocuses}
                  onToggleLegacy={handleToggleLegacy}
                  starred
                />
              ))}
            </div>
          )}
        </div>

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

        <div className={`dashboard-focus-section ${restOpen ? 'dashboard-focus-section--scrollable' : ''}`}>
          <button
            type="button"
            className="dashboard-focus-section__title dashboard-focus-section__title--toggle"
            aria-expanded={restOpen}
            onClick={() => setRestOpen((open) => !open)}
          >
            <span>{restOpen ? '▼' : '▶'} The rest (Additional) ({additionalFocuses.length})</span>
          </button>
          {restOpen && (
          <div className="dashboard-focus-section__list">
            {additionalFocuses.map(focus => (
              <FocusOrderRow
                key={focus.id}
                focus={focus}
                list={additionalFocuses}
                selected={currentFocus?.id === focus.id}
                draggingId={draggingId}
                setDraggingId={setDraggingId}
                onSelect={handleFocusSelect}
                onToggleFavorite={handleToggleFavorite}
                onReorder={reorderFocuses}
                onToggleLegacy={handleToggleLegacy}
                showStandard
              />
            ))}
          </div>
          )}
        </div>

        <div className="dashboard-focus-section">
          <button
            type="button"
            className="dashboard-focus-section__title dashboard-focus-section__title--toggle"
            aria-expanded={retiredOpen}
            onClick={() => setRetiredOpen((open) => !open)}
          >
            <span>{retiredOpen ? '▼' : '▶'} Retired (Legacy) ({retiredFocuses.length})</span>
          </button>
          {retiredOpen && (
            <div className="dashboard-focus-section__list">
              {retiredFocuses.length === 0 && (
                <div className="dashboard-focus-section__empty">Mark a focus with L to retire it.</div>
              )}
              {retiredFocuses.map(focus => (
                <FocusOrderRow
                  key={focus.id}
                  focus={focus}
                  list={retiredFocuses}
                  selected={currentFocus?.id === focus.id}
                  draggingId={draggingId}
                  setDraggingId={setDraggingId}
                  onSelect={handleFocusSelect}
                  onToggleFavorite={handleToggleFavorite}
                  onReorder={reorderFocuses}
                  onToggleLegacy={handleToggleLegacy}
                  starred={starredIds.has(focus.id)}
                  showStandard
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FocusSelector;
