import { useCallback, useEffect, useState } from 'react';
import { REPORT_PANEL_TECHNICAL_META_EVENT } from '../components/dockview/eventConstants';
import {
  resolveTechnicalMetaVisible,
  setPanelTechnicalMetaVisible,
} from '../services/panelTechnicalMetaState';

/**
 * Dev/admin technical strip (events, data sources) — tab ⓘ only.
 * Default hidden. Not affected by header ≣ (user data details).
 */
export const usePanelTechnicalMetaVisibility = ({ panelInstanceId, panelComponentId } = {}) => {
  const [visible, setVisible] = useState(() =>
    resolveTechnicalMetaVisible(panelInstanceId, panelComponentId)
  );

  useEffect(() => {
    setVisible(resolveTechnicalMetaVisible(panelInstanceId, panelComponentId));
  }, [panelInstanceId, panelComponentId]);

  useEffect(() => {
    const onMeta = (event) => {
      const detail = event?.detail || {};
      const targetInstance = detail.panelId;
      const targetComponent = detail.panelComponent;
      const matchInstance = targetInstance && targetInstance === panelInstanceId;
      const matchComponent = targetComponent && targetComponent === panelComponentId;
      if (!matchInstance && !matchComponent) return;

      if (detail.visible === true || detail.visible === false) {
        const on = detail.visible === true;
        setPanelTechnicalMetaVisible(panelInstanceId, panelComponentId, on);
        setVisible(on);
        return;
      }
      setVisible((v) => {
        const next = !v;
        setPanelTechnicalMetaVisible(panelInstanceId, panelComponentId, next);
        return next;
      });
    };
    window.addEventListener(REPORT_PANEL_TECHNICAL_META_EVENT, onMeta);
    return () => window.removeEventListener(REPORT_PANEL_TECHNICAL_META_EVENT, onMeta);
  }, [panelComponentId, panelInstanceId]);

  const commitVisible = useCallback(
    (nextVisible) => {
      const on = nextVisible === true;
      setVisible(on);
      setPanelTechnicalMetaVisible(panelInstanceId, panelComponentId, on);
      window.dispatchEvent(
        new CustomEvent(REPORT_PANEL_TECHNICAL_META_EVENT, {
          detail: {
            panelId: panelInstanceId,
            panelComponent: panelComponentId,
            visible: on,
          },
        })
      );
    },
    [panelComponentId, panelInstanceId]
  );

  return [visible, commitVisible];
};

export default usePanelTechnicalMetaVisibility;
