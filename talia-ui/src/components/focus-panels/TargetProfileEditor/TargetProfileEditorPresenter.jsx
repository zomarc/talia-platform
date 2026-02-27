/**
 * Target Profile Editor Presenter Component
 * UI for creating and editing target profiles
 */

import React, { useState, useEffect } from 'react';

const TargetProfileEditorPresenter = ({ 
  initialData = null, 
  sailCode = null, 
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

  return (
    <div className="target-profile-editor">
      <h2 className="target-profile-editor__title">
        {initialData ? 'Edit Target Profile' : 'Create Target Profile'}
      </h2>

      {saveError && (
        <div className="target-profile-editor__error">
          Error saving: {saveError.message || 'Unknown error'}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Basic Information */}
        <div className="target-profile-editor__section">
          <label className="target-profile-editor__label">
            Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="target-profile-editor__input"
          />
        </div>

        <div className="target-profile-editor__section">
          <label className="target-profile-editor__label">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="target-profile-editor__textarea"
          />
        </div>

        {/* Build Curves */}
        <div className="target-profile-editor__section">
          <h3 className="target-profile-editor__section-title">
            Build Curves
          </h3>
          <div className="target-profile-editor__table-wrap">
            <table className="target-profile-editor__table">
              <thead>
                <tr className="target-profile-editor__table-header">
                  <th className="target-profile-editor__th">Week</th>
                  <th className="target-profile-editor__th target-profile-editor__th--right">Target Bookings</th>
                  <th className="target-profile-editor__th target-profile-editor__th--right">Target Guests</th>
                </tr>
              </thead>
              <tbody>
                {buildCurves.map((curve, index) => (
                  <tr key={index} className="target-profile-editor__row">
                    <td className="target-profile-editor__cell">
                      {curve.weekLabel}
                    </td>
                    <td className="target-profile-editor__cell target-profile-editor__cell--right">
                      <input
                        type="number"
                        value={curve.targetBookings || 0}
                        onChange={(e) => handleCurveChange(index, 'targetBookings', e.target.value)}
                        min="0"
                        className="target-profile-editor__number-input"
                      />
                    </td>
                    <td className="target-profile-editor__cell target-profile-editor__cell--right">
                      <input
                        type="number"
                        value={curve.targetGuests || 0}
                        onChange={(e) => handleCurveChange(index, 'targetGuests', e.target.value)}
                        min="0"
                        className="target-profile-editor__number-input"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="target-profile-editor__actions">
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="target-profile-editor__button target-profile-editor__button--secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="target-profile-editor__button target-profile-editor__button--primary"
          >
            {saving ? 'Saving...' : (initialData ? 'Update' : 'Create')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TargetProfileEditorPresenter;

