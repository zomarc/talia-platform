import { useEffect, useState } from 'react';

const DASHBOARD_DETAILS_VISIBILITY_EVENT = 'talia:dashboard.detailsVisibility';

const getDetailsStoreValue = ({ panelInstanceId, panelComponentId, fallback = true }) => {
  const store = window.__taliaPanelDetailsVisibility || {};
  if (panelInstanceId && Object.prototype.hasOwnProperty.call(store, panelInstanceId)) {
    return store[panelInstanceId] !== false;
  }
  if (panelComponentId && Object.prototype.hasOwnProperty.call(store, panelComponentId)) {
    return store[panelComponentId] !== false;
  }
  return fallback;
};

export const usePanelDetailsVisibility = ({
  panelInstanceId,
  panelComponentId,
  fallback = true,
}) => {
  const [visible, setVisible] = useState(() => getDetailsStoreValue({
    panelInstanceId,
    panelComponentId,
    fallback,
  }));

  useEffect(() => {
    const handleDetailsVisibility = (event) => {
      const detail = event?.detail || {};
      const targetPanelInstance = detail.panelId;
      const targetPanelComponent = detail.panelComponent;
      const targetsThisPanel = targetPanelInstance
        ? (targetPanelInstance === panelInstanceId || targetPanelComponent === panelComponentId)
        : targetPanelComponent === panelComponentId;
      if (!targetsThisPanel) return;
      setVisible(detail.visible !== false);
    };

    window.addEventListener(DASHBOARD_DETAILS_VISIBILITY_EVENT, handleDetailsVisibility);
    return () => window.removeEventListener(DASHBOARD_DETAILS_VISIBILITY_EVENT, handleDetailsVisibility);
  }, [panelComponentId, panelInstanceId]);

  return [visible, setVisible];
};

export default usePanelDetailsVisibility;
