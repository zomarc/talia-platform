/**
 * Sailing Profile container — REAL vs model prior (lazy/manual map).
 */

import React, { useEffect, useState } from 'react';
import {
  SAIL_SELECT_EVENT,
  SAIL_CLEAR_EVENT,
  extractSailCodeFromEvent,
} from '../../../lib/eventBus';
import { resolveSelectionScope } from '../../../lib/inventoryReference';
import { useProfileCompare } from '../../../hooks/data/useProfileCompare';
import ProfileComparePresenter from './ProfileComparePresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';

const resolveSailFromDetail = (detail) => {
  const scope = detail?.canonical_scope;
  if (scope?.reference_sail_code) return scope.reference_sail_code;
  if (Array.isArray(scope?.sail_codes) && scope.sail_codes.length) {
    return scope.sail_codes[0];
  }
  try {
    const resolved = resolveSelectionScope(detail);
    if (resolved?.reference_sail_code) return resolved.reference_sail_code;
  } catch {
    // ignore
  }
  return extractSailCodeFromEvent(detail);
};

const ProfileCompareContainer = ({
  panelInstanceId,
  panelComponentId,
  ...props
}) => {
  const { sailCode: sailProp, params = {} } = props;
  const sailFromParams = params.sailCode ?? sailProp ?? null;
  const [sailCode, setSailCode] = useState(sailFromParams);

  useEffect(() => {
    if (sailFromParams) setSailCode(sailFromParams);
  }, [sailFromParams]);

  useEffect(() => {
    const handleSelect = (e) => {
      const code = resolveSailFromDetail(e?.detail);
      if (code) setSailCode(code);
    };
    const handleClear = () => setSailCode(null);
    window.addEventListener(SAIL_SELECT_EVENT, handleSelect);
    window.addEventListener(SAIL_CLEAR_EVENT, handleClear);
    return () => {
      window.removeEventListener(SAIL_SELECT_EVENT, handleSelect);
      window.removeEventListener(SAIL_CLEAR_EVENT, handleClear);
    };
  }, []);

  useEffect(() => {
    if (sailFromParams || sailCode) return;
    const keys = ['talia:persisted:lastEvent', 'talia:test:lastEvent'];
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const code = resolveSailFromDetail(parsed?.detail);
        if (code) {
          setSailCode(code);
          return;
        }
      } catch {
        // ignore
      }
    }
    const fromWindow = resolveSailFromDetail(window?.lastSailSelectEvent?.detail);
    if (fromWindow) setSailCode(fromWindow);
  }, [sailFromParams, sailCode]);

  const {
    data,
    loading,
    error,
    busy,
    picking,
    overlays,
    refetch,
    beginPick,
    cancelPick,
    setManualModel,
    resetToLazy,
  } = useProfileCompare(sailCode, {
    panelInstanceId,
    panelComponentId: panelComponentId || 'profile-compare',
  });

  if (loading && !data) {
    return <LoadingSpinner message="Loading sailing profile..." fullScreen={false} />;
  }

  if (error && !data) {
    return (
      <ErrorMessage
        title="Failed to load sailing profile"
        message={error.message || String(error)}
        onRetry={refetch}
      />
    );
  }

  return (
    <ProfileComparePresenter
      data={data}
      sailCode={sailCode}
      error={error}
      busy={busy}
      picking={picking}
      overlays={overlays}
      onBeginPick={beginPick}
      onCancelPick={cancelPick}
      onSelectModel={setManualModel}
      onResetLazy={resetToLazy}
      panelInstanceId={panelInstanceId}
      panelComponentId={panelComponentId || 'profile-compare'}
    />
  );
};

export default ProfileCompareContainer;
