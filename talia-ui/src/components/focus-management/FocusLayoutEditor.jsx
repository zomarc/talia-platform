/**
 * Focus Layout Editor Component
 * Interface for editing focus component layouts
 */

import React, { useState, useEffect } from 'react';
import { useFocusManagement } from '../../hooks/useFocusManagement';

const FocusLayoutEditor = ({ focusId, onSave, onCancel }) => {
  const {
    currentFocus,
    loadFocus,
    updateFocusComponents,
    loading,
    error
  } = useFocusManagement();

  const [components, setComponents] = useState([]);
  const [draggedComponent, setDraggedComponent] = useState(null);
  const [gridSize, setGridSize] = useState({ columns: 12, rows: 12 });

  // Available component types
  const availableComponentTypes = [
    { id: 'table', name: 'Data Table', icon: '📊' },
    { id: 'chart', name: 'Chart', icon: '📈' },
    { id: 'panel', name: 'Panel', icon: '📋' },
    { id: 'kpi-cards', name: 'KPI Cards', icon: '📊' },
    { id: 'occupancy-chart', name: 'Occupancy Chart', icon: '🚢' },
    { id: 'revenue-breakdown', name: 'Revenue Breakdown', icon: '💰' },
    { id: 'exception-list', name: 'Exception List', icon: '⚠️' },
    { id: 'itinerary-list', name: 'Itinerary List', icon: '🗺️' }
  ];

  // Load focus when component mounts or focusId changes
  useEffect(() => {
    if (focusId) {
      loadFocus(focusId);
    }
  }, [focusId, loadFocus]);

  // Update components when currentFocus changes
  useEffect(() => {
    if (currentFocus && currentFocus.components) {
      setComponents(currentFocus.components);
    }
  }, [currentFocus]);

  const addComponent = (componentType) => {
    const newComponent = {
      id: `comp_${Date.now()}`,
      componentType: componentType.id,
      title: componentType.name,
      dataSource: '',
      settings: {},
      position: { x: 0, y: 0, width: 4, height: 4 },
      order: components.length,
      isVisible: true
    };

    setComponents(prev => [...prev, newComponent]);
  };

  const removeComponent = (componentId) => {
    setComponents(prev => prev.filter(comp => comp.id !== componentId));
  };

  const updateComponent = (componentId, updates) => {
    setComponents(prev => prev.map(comp => 
      comp.id === componentId ? { ...comp, ...updates } : comp
    ));
  };

  const handleDragStart = (e, componentId) => {
    setDraggedComponent(componentId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetPosition) => {
    e.preventDefault();
    
    if (draggedComponent && targetPosition) {
      updateComponent(draggedComponent, { position: targetPosition });
    }
    
    setDraggedComponent(null);
  };

  const handleSave = async () => {
    if (focusId) {
      const success = await updateFocusComponents(focusId, components);
      if (success && onSave) {
        onSave();
      }
    }
  };

  const renderGrid = () => {
    const gridCells = [];
    for (let row = 0; row < gridSize.rows; row++) {
      for (let col = 0; col < gridSize.columns; col++) {
        gridCells.push(
          <div
            key={`${row}-${col}`}
            className={`grid-cell ${getCellStatus(row, col)}`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, { x: col, y: row, width: 1, height: 1 })}
            style={{
              gridColumn: col + 1,
              gridRow: row + 1
            }}
          />
        );
      }
    }
    return gridCells;
  };

  const getCellStatus = (row, col) => {
    // Check if this cell is occupied by any component
    const occupied = components.some(comp => {
      const { x, y, width, height } = comp.position;
      return col >= x && col < x + width && row >= y && row < y + height;
    });
    
    return occupied ? 'occupied' : 'empty';
  };

  const renderComponent = (component) => {
    const { x, y, width, height } = component.position;
    
    return (
      <div
        key={component.id}
        className={`layout-component ${!component.isVisible ? 'hidden' : ''}`}
        style={{
          gridColumn: `${x + 1} / span ${width}`,
          gridRow: `${y + 1} / span ${height}`,
          backgroundColor: getComponentColor(component.componentType)
        }}
        draggable
        onDragStart={(e) => handleDragStart(e, component.id)}
      >
        <div className="component-header">
          <span className="component-title">{component.title}</span>
          <div className="component-actions">
            <button 
              onClick={() => updateComponent(component.id, { isVisible: !component.isVisible })}
              className="btn-icon"
              title={component.isVisible ? 'Hide' : 'Show'}
            >
              {component.isVisible ? '👁️' : '👁️‍🗨️'}
            </button>
            <button 
              onClick={() => removeComponent(component.id)}
              className="btn-icon"
              title="Remove"
            >
              🗑️
            </button>
          </div>
        </div>
        <div className="component-content">
          <span className="component-type">{component.componentType}</span>
        </div>
      </div>
    );
  };

  const getComponentColor = (componentType) => {
    const colors = {
      'table': '#e3f2fd',
      'chart': '#f3e5f5',
      'panel': '#e8f5e8',
      'kpi-cards': '#fff3e0',
      'occupancy-chart': '#fce4ec',
      'revenue-breakdown': '#e0f2f1',
      'exception-list': '#ffebee',
      'itinerary-list': '#f1f8e9'
    };
    return colors[componentType] || '#f5f5f5';
  };

  if (loading) {
    return (
      <div className="focus-layout-editor">
        <div className="loading">Loading focus layout...</div>
      </div>
    );
  }

  return (
    <div className="focus-layout-editor">
      <div className="layout-editor-header">
        <h3>Edit Focus Layout</h3>
        <div className="layout-editor-actions">
          <button onClick={handleSave} className="btn btn-primary">
            Save Layout
          </button>
          <button onClick={onCancel} className="btn btn-secondary">
            Cancel
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <p>Error: {error}</p>
        </div>
      )}

      <div className="layout-editor-content">
        {/* Component Palette */}
        <div className="component-palette">
          <h4>Add Components</h4>
          <div className="component-types">
            {availableComponentTypes.map(type => (
              <div
                key={type.id}
                className="component-type-item"
                onClick={() => addComponent(type)}
              >
                <span className="component-icon">{type.icon}</span>
                <span className="component-name">{type.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Layout Grid */}
        <div className="layout-grid-container">
          <div className="layout-grid-header">
            <h4>Layout Grid</h4>
            <div className="grid-controls">
              <label>
                Columns: 
                <input
                  type="number"
                  value={gridSize.columns}
                  onChange={(e) => setGridSize(prev => ({ ...prev, columns: parseInt(e.target.value) || 12 }))}
                  min="4"
                  max="24"
                />
              </label>
              <label>
                Rows: 
                <input
                  type="number"
                  value={gridSize.rows}
                  onChange={(e) => setGridSize(prev => ({ ...prev, rows: parseInt(e.target.value) || 12 }))}
                  min="4"
                  max="24"
                />
              </label>
            </div>
          </div>
          
          <div 
            className="layout-grid"
            style={{
              gridTemplateColumns: `repeat(${gridSize.columns}, 1fr)`,
              gridTemplateRows: `repeat(${gridSize.rows}, 1fr)`
            }}
          >
            {renderGrid()}
            {components.map(renderComponent)}
          </div>
        </div>

        {/* Component Properties */}
        <div className="component-properties">
          <h4>Component Properties</h4>
          {components.length === 0 ? (
            <p>No components added yet. Drag components from the palette to the grid.</p>
          ) : (
            <div className="properties-list">
              {components.map(component => (
                <div key={component.id} className="property-item">
                  <div className="property-header">
                    <span className="property-title">{component.title}</span>
                    <span className="property-type">{component.componentType}</span>
                  </div>
                  <div className="property-fields">
                    <div className="property-field">
                      <label>Title:</label>
                      <input
                        type="text"
                        value={component.title}
                        onChange={(e) => updateComponent(component.id, { title: e.target.value })}
                      />
                    </div>
                    <div className="property-field">
                      <label>Data Source:</label>
                      <input
                        type="text"
                        value={component.dataSource}
                        onChange={(e) => updateComponent(component.id, { dataSource: e.target.value })}
                        placeholder="e.g., sailings, revenue, exceptions"
                      />
                    </div>
                    <div className="property-field">
                      <label>Position:</label>
                      <div className="position-inputs">
                        <input
                          type="number"
                          value={component.position.x}
                          onChange={(e) => updateComponent(component.id, { 
                            position: { ...component.position, x: parseInt(e.target.value) || 0 }
                          })}
                          placeholder="X"
                          min="0"
                        />
                        <input
                          type="number"
                          value={component.position.y}
                          onChange={(e) => updateComponent(component.id, { 
                            position: { ...component.position, y: parseInt(e.target.value) || 0 }
                          })}
                          placeholder="Y"
                          min="0"
                        />
                        <input
                          type="number"
                          value={component.position.width}
                          onChange={(e) => updateComponent(component.id, { 
                            position: { ...component.position, width: parseInt(e.target.value) || 1 }
                          })}
                          placeholder="Width"
                          min="1"
                        />
                        <input
                          type="number"
                          value={component.position.height}
                          onChange={(e) => updateComponent(component.id, { 
                            position: { ...component.position, height: parseInt(e.target.value) || 1 }
                          })}
                          placeholder="Height"
                          min="1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FocusLayoutEditor;
