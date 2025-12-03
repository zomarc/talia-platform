/**
 * Target Profile Editor Presenter Component
 * UI for creating and editing target profiles
 */

import React, { useState, useEffect } from 'react';

const TargetProfileEditorPresenter = ({ 
  initialData = null, 
  sailCode = null, 
  theme, 
  onSave, 
  onCancel,
  saving = false,
  saveError = null
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [buildCurves, setBuildCurves] = useState(initialData?.buildCurves || []);

  // Initialize build curves if empty
  useEffect(() => {
    if (buildCurves.length === 0) {
      // Default build curve structure
      const defaultCurves = [
        { weekLabel: 'W-12', weeksUntilSailing: 12, targetBookings: 0, targetGuests: 0 },
        { weekLabel: 'W-10', weeksUntilSailing: 10, targetBookings: 0, targetGuests: 0 },
        { weekLabel: 'W-8', weeksUntilSailing: 8, targetBookings: 0, targetGuests: 0 },
        { weekLabel: 'W-6', weeksUntilSailing: 6, targetBookings: 0, targetGuests: 0 },
        { weekLabel: 'W-4', weeksUntilSailing: 4, targetBookings: 0, targetGuests: 0 },
        { weekLabel: 'W-2', weeksUntilSailing: 2, targetBookings: 0, targetGuests: 0 },
        { weekLabel: 'Sail', weeksUntilSailing: 0, targetBookings: 0, targetGuests: 0 }
      ];
      setBuildCurves(defaultCurves);
    }
  }, []);

  // Update form when initialData changes
  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setDescription(initialData.description || '');
      setBuildCurves(initialData.buildCurves || []);
    }
  }, [initialData]);

  const handleCurveChange = (index, field, value) => {
    const updated = [...buildCurves];
    updated[index] = {
      ...updated[index],
      [field]: field === 'targetBookings' || field === 'targetGuests' ? parseInt(value) || 0 : value
    };
    setBuildCurves(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const profileData = {
      name,
      description: description || null,
      sailCode: sailCode || null,
      buildCurves,
      basedOnHistoric: []
    };

    try {
      await onSave(profileData);
    } catch (error) {
      console.error('Error saving target profile:', error);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  const defaultTheme = {
    colors: {
      background: '#ffffff',
      foreground: '#2b2b2b',
      border: '#e0e0e0',
      accent: '#b08d57',
      textSecondary: '#666'
    }
  };

  const themeValues = theme || defaultTheme;

  return (
    <div style={{
      padding: '20px',
      background: themeValues.colors.background,
      borderRadius: '8px',
      color: themeValues.colors.foreground
    }}>
      <h2 style={{
        margin: '0 0 20px 0',
        fontSize: '24px',
        fontWeight: 'bold',
        color: themeValues.colors.foreground
      }}>
        {initialData ? 'Edit Target Profile' : 'Create Target Profile'}
      </h2>

      {saveError && (
        <div style={{
          padding: '12px',
          marginBottom: '20px',
          background: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c33'
        }}>
          Error saving: {saveError.message || 'Unknown error'}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Basic Information */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: '600',
            color: themeValues.colors.foreground
          }}>
            Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '8px 12px',
              border: `1px solid ${themeValues.colors.border}`,
              borderRadius: '4px',
              fontSize: '14px',
              background: themeValues.colors.background,
              color: themeValues.colors.foreground
            }}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: '600',
            color: themeValues.colors.foreground
          }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: `1px solid ${themeValues.colors.border}`,
              borderRadius: '4px',
              fontSize: '14px',
              background: themeValues.colors.background,
              color: themeValues.colors.foreground,
              resize: 'vertical'
            }}
          />
        </div>

        {/* Build Curves */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: '18px',
            fontWeight: '600',
            color: themeValues.colors.foreground
          }}>
            Build Curves
          </h3>
          <div style={{
            background: themeValues.colors.background,
            border: `1px solid ${themeValues.colors.border}`,
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{
                  background: themeValues.colors.border,
                  borderBottom: `1px solid ${themeValues.colors.border}`
                }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Week</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Target Bookings</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>Target Guests</th>
                </tr>
              </thead>
              <tbody>
                {buildCurves.map((curve, index) => (
                  <tr key={index} style={{
                    borderBottom: `1px solid ${themeValues.colors.border}`
                  }}>
                    <td style={{ padding: '12px', fontWeight: '500' }}>
                      {curve.weekLabel}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <input
                        type="number"
                        value={curve.targetBookings || 0}
                        onChange={(e) => handleCurveChange(index, 'targetBookings', e.target.value)}
                        min="0"
                        style={{
                          width: '120px',
                          padding: '6px 8px',
                          border: `1px solid ${themeValues.colors.border}`,
                          borderRadius: '4px',
                          textAlign: 'right',
                          background: themeValues.colors.background,
                          color: themeValues.colors.foreground
                        }}
                      />
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <input
                        type="number"
                        value={curve.targetGuests || 0}
                        onChange={(e) => handleCurveChange(index, 'targetGuests', e.target.value)}
                        min="0"
                        style={{
                          width: '120px',
                          padding: '6px 8px',
                          border: `1px solid ${themeValues.colors.border}`,
                          borderRadius: '4px',
                          textAlign: 'right',
                          background: themeValues.colors.background,
                          color: themeValues.colors.foreground
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            style={{
              padding: '10px 20px',
              border: `1px solid ${themeValues.colors.border}`,
              borderRadius: '4px',
              background: themeValues.colors.background,
              color: themeValues.colors.foreground,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              background: saving ? themeValues.colors.border : (themeValues.colors.accent || '#b08d57'),
              color: '#fff',
              cursor: saving || !name.trim() ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {saving ? 'Saving...' : (initialData ? 'Update' : 'Create')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TargetProfileEditorPresenter;

