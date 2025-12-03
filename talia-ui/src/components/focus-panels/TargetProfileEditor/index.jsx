/**
 * Target Profile Editor Container Component
 * Handles data fetching and state management for target profile editing
 */

import React from 'react';
import { useTargetProfile, useTargetProfileMutation } from '../../../hooks/data/useTargetProfile';
import TargetProfileEditorPresenter from './TargetProfileEditorPresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';

const TargetProfileEditorContainer = ({ targetProfileId = null, sailCode = null, theme, onSave, onCancel }) => {
  // Fetch existing profile if editing
  const { data: existingProfile, loading: loadingProfile, error: profileError, refetch: refetchProfile } = useTargetProfile(targetProfileId);
  
  // Mutation hooks
  const { create, update, loading: mutationLoading, error: mutationError } = useTargetProfileMutation();

  // Handle loading state
  if (targetProfileId && loadingProfile) {
    return <LoadingSpinner message="Loading target profile..." fullScreen={false} />;
  }

  // Handle error state
  if (targetProfileId && profileError) {
    return (
      <ErrorMessage 
        error={profileError} 
        title="Failed to load target profile"
        onRetry={refetchProfile}
      />
    );
  }

  // Handle save
  const handleSave = async (profileData) => {
    try {
      let result;
      if (targetProfileId) {
        result = await update(targetProfileId, profileData);
      } else {
        result = await create(profileData);
      }
      
      if (onSave) {
        onSave(result);
      }
      
      return result;
    } catch (error) {
      console.error('[TargetProfileEditorContainer] Save error:', error);
      throw error;
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  // Render presenter
  return (
    <TargetProfileEditorPresenter 
      initialData={existingProfile}
      sailCode={sailCode}
      theme={theme}
      onSave={handleSave}
      onCancel={handleCancel}
      saving={mutationLoading}
      saveError={mutationError}
    />
  );
};

export default TargetProfileEditorContainer;

