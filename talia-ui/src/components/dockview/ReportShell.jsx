import React, { useEffect, useRef, useState } from "react";
import ReportEventMeta from "../shared/ReportEventMeta";
import { REPORT_PANEL_PAUSE_EVENT, REPORT_PANEL_LOADING_EVENT } from "./eventConstants";
import usePanelTechnicalMetaVisibility from "../../hooks/usePanelTechnicalMetaVisibility";
import { isArcadeGamePanelComponent } from "../shared/games/arcadeGamePanelIds";
import {
  resolvePanelLoading,
  panelLoadingEventMatches,
} from "../../services/panelLoadingState";
import { activateDockviewPanel, replayClickAfterActivate } from "../../lib/activateDockviewPanel";

const DASHBOARD_GLOBAL_CRITERIA_EVENT = 'talia:dashboard.globalCriteria';

const deriveReportSources = (report) => {
  if (Array.isArray(report?.dataSources) && report.dataSources.length) {
    return report.dataSources;
  }
  if (typeof report?.dataRequirements === 'string' && report.dataRequirements.trim()) {
    return [report.dataRequirements.trim()];
  }
  return [];
};

const ReportShell = ({ report, panelInstanceId, panelApi = null, children }) => {
  const shellRef = useRef(null);
  const emits = report?.events?.emits || [];
  const respondsTo = Array.from(new Set([...(report?.events?.respondsTo || []), DASHBOARD_GLOBAL_CRITERIA_EVENT]));
  const sources = deriveReportSources(report);
  const [showTechnicalMeta] = usePanelTechnicalMetaVisibility({
    panelInstanceId,
    panelComponentId: report?.panelId,
  });
  const [criteriaVersion, setCriteriaVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(() => (
    resolvePanelLoading(panelInstanceId, report?.panelId)
  ));
  const [isPaused, setIsPaused] = useState(() => {
    const state = window.__taliaPanelPauseState || {};
    if (panelInstanceId && Object.prototype.hasOwnProperty.call(state, panelInstanceId)) {
      return state[panelInstanceId] === true;
    }
    if (report?.panelId && Object.prototype.hasOwnProperty.call(state, report.panelId)) {
      return state[report.panelId] === true;
    }
    return false;
  });

  useEffect(() => {
    const handleCriteriaUpdate = () => {
      // Force a lightweight remount so every report "accepts" Global Criteria updates
      // even if it does not implement explicit criteria listeners.
      setCriteriaVersion((prev) => prev + 1);
    };
    window.addEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, handleCriteriaUpdate);
    return () => window.removeEventListener(DASHBOARD_GLOBAL_CRITERIA_EVENT, handleCriteriaUpdate);
  }, []);

  useEffect(() => {
    const handlePauseChange = (event) => {
      const detail = event?.detail || {};
      const requestedPanelId = detail?.panelId || null;
      const requestedComponent = detail?.panelComponent || null;
      if (requestedPanelId && panelInstanceId && requestedPanelId === panelInstanceId) {
        setIsPaused(detail?.paused === true);
        return;
      }
      if (!requestedPanelId && requestedComponent && report?.panelId && requestedComponent === report.panelId) {
        setIsPaused(detail?.paused === true);
      }
    };
    window.addEventListener(REPORT_PANEL_PAUSE_EVENT, handlePauseChange);
    return () => window.removeEventListener(REPORT_PANEL_PAUSE_EVENT, handlePauseChange);
  }, [panelInstanceId, report?.panelId]);

  useEffect(() => {
    setIsLoading(resolvePanelLoading(panelInstanceId, report?.panelId));
    const handleLoadingChanged = (event) => {
      const detail = event?.detail || {};
      if (!panelLoadingEventMatches(panelInstanceId, report?.panelId, detail)) return;
      setIsLoading(detail.loading === true);
    };
    window.addEventListener(REPORT_PANEL_LOADING_EVENT, handleLoadingChanged);
    return () => window.removeEventListener(REPORT_PANEL_LOADING_EVENT, handleLoadingChanged);
  }, [panelInstanceId, report?.panelId]);

  // One gesture = activate this report + interact with its data (row/chart click).
  // Capture-phase pointerdown runs before Tabulator handlers so Dockview chrome
  // is already active when the selection event fires.
  useEffect(() => {
    const node = shellRef.current;
    if (!node) return undefined;
    const onPointerDownCapture = (event) => {
      if (event.button !== 0) return;
      const becameActive = activateDockviewPanel(panelApi || panelInstanceId, {
        panelInstanceId,
        shell: node,
      });
      if (becameActive) replayClickAfterActivate(event);
    };
    node.addEventListener('pointerdown', onPointerDownCapture, true);
    return () => node.removeEventListener('pointerdown', onPointerDownCapture, true);
  }, [panelApi, panelInstanceId]);

  const isArcadePanel = isArcadeGamePanelComponent(report?.panelId);
  const shellPauseChrome = isPaused && !isArcadePanel;
  const shellClassName = [
    'talia-report-shell',
    shellPauseChrome ? 'talia-report-shell--paused' : '',
    isLoading ? 'talia-report-shell--loading' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={shellRef}
      className={shellClassName}
      aria-busy={isLoading || undefined}
      data-panel-loading={isLoading ? 'true' : undefined}
      data-panel-instance-id={panelInstanceId || undefined}
      data-panel-component-id={report?.panelId || undefined}
    >
      {showTechnicalMeta && (
        <div className="talia-report-technical-meta">
          <ReportEventMeta
            emits={emits}
            respondsTo={respondsTo}
            sources={sources}
            panelInstanceId={panelInstanceId}
            panelComponentId={report?.panelId}
          />
        </div>
      )}
      <div className="talia-report-shell__content" key={`criteria-${criteriaVersion}`}>{children}</div>
      {shellPauseChrome && (
        <div className="talia-report-shell__pause-overlay" role="note" aria-live="polite">
          <span className="talia-report-shell__pause-title">Paused</span>
          <span className="talia-report-shell__pause-subtitle">Press P to resume</span>
        </div>
      )}
    </div>
  );
};

export default ReportShell;
