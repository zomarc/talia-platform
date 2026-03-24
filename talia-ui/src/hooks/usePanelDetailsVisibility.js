import { useCallback, useEffect, useState } from 'react';
import { DASHBOARD_DETAILS_VISIBILITY_EVENT } from '../components/dockview/eventConstants';
import {
  resolveReportDetailsVisible,
  setPanelReportDetailsOverride,
} from '../services/panelDetailsState';

/**
 * User-facing “details”: extra data tables / expanded sections (header ≣).
 * - Header ≣: `scope: 'all'` — all panels show/hide their data-detail regions.
 * - In-panel collapsible: `commitVisible(next)` → per-panel data override + `scope: 'panel'`.
 * Technical dev meta (tab ⓘ) is separate — use `usePanelTechnicalMetaVisibility` in ReportShell only.
 *
 * @param {object} opts
 * @param {string} [opts.panelInstanceId]
 * @param {string} [opts.panelComponentId]
 * @param {boolean} [opts.fallback=true] when respectGlobal is false and no override
 * @param {boolean} [opts.respectGlobal=true] if false, ignore global (e.g. Data Management admin-only)
 */
export const usePanelDetailsVisibility = ({
  panelInstanceId,
  panelComponentId,
  fallback = true,
  respectGlobal = true,
} = {}) => {
  const [visible, setVisible] = useState(() =>
    resolveReportDetailsVisible(panelInstanceId, panelComponentId, { fallback, respectGlobal })
  );

  useEffect(() => {
    setVisible(
      resolveReportDetailsVisible(panelInstanceId, panelComponentId, { fallback, respectGlobal })
    );
  }, [panelInstanceId, panelComponentId, fallback, respectGlobal]);

  useEffect(() => {
    const handleDetailsVisibility = (event) => {
      const detail = event?.detail || {};
      const scope = detail.scope;

      if (scope === 'all') {
        if (!respectGlobal) return;
        setVisible(detail.visible !== false);
        return;
      }

      const targetInstance = detail.panelId;
      const targetComponent = detail.panelComponent;
      const matchInstance = targetInstance && targetInstance === panelInstanceId;
      const matchComponent = targetComponent && targetComponent === panelComponentId;
      if (!matchInstance && !matchComponent) return;

      if (detail.visible !== undefined && detail.visible !== null) {
        setVisible(detail.visible !== false);
        return;
      }
      setVisible((prev) => !prev);
    };

    window.addEventListener(DASHBOARD_DETAILS_VISIBILITY_EVENT, handleDetailsVisibility);
    return () => window.removeEventListener(DASHBOARD_DETAILS_VISIBILITY_EVENT, handleDetailsVisibility);
  }, [panelComponentId, panelInstanceId, respectGlobal]);

  /** Persist and broadcast this panel’s details visibility (e.g. in-panel collapsible header). */
  const commitVisible = useCallback(
    (nextVisible) => {
      const on = Boolean(nextVisible);
      setVisible(on);
      setPanelReportDetailsOverride(panelInstanceId, panelComponentId, on);
      window.dispatchEvent(
        new CustomEvent(DASHBOARD_DETAILS_VISIBILITY_EVENT, {
          detail: {
            scope: 'panel',
            panelId: panelInstanceId,
            panelComponent: panelComponentId,
            visible: on,
            action: 'set',
          },
        })
      );
    },
    [panelComponentId, panelInstanceId]
  );

  return [visible, commitVisible];
};

export default usePanelDetailsVisibility;
