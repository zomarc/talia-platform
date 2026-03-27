import { useCallback, useMemo } from 'react';
import { resumeArcadePanelFromUserPause } from './arcadePanelPause';

/**
 * Click-to-resume when the user paused the panel (P). Ignores inactive-tab pause and button clicks.
 */
export const useArcadeGameOverlayResume = ({
  panelInstanceId,
  panelComponentId,
  overlayTitle,
  isPanelPaused,
  isPanelActive,
}) => {
  const canClickToResume = useMemo(
    () => overlayTitle === 'Paused' && isPanelPaused === true && isPanelActive === true,
    [overlayTitle, isPanelPaused, isPanelActive]
  );

  const onOverlayPointer = useCallback(
    (event) => {
      if (!canClickToResume) return;
      if (event.target.closest('button')) return;
      resumeArcadePanelFromUserPause(panelInstanceId, panelComponentId);
    },
    [canClickToResume, panelInstanceId, panelComponentId]
  );

  return { onOverlayPointer, arcadeOverlayClickable: canClickToResume };
};
