import React, { useEffect, useRef } from "react";
import ReportEventMeta from "../shared/ReportEventMeta";
import { REPORT_PANEL_LOADING_EVENT } from "./eventConstants";
import usePanelTechnicalMetaVisibility from "../../hooks/usePanelTechnicalMetaVisibility";
import { isArcadeGamePanelComponent } from "../shared/games/arcadeGamePanelIds";
import {
  resolvePanelLoading,
  panelLoadingEventMatches,
} from "../../services/panelLoadingState";
import { activateDockviewPanel, replayClickAfterActivate } from "../../lib/activateDockviewPanel";
import { useReportShellOptions } from "../../hooks/useReportShellOptions";
import { PanelShellProvider, usePanelShell } from "../../contexts/PanelShellContext";

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

const ReportShellChrome = ({ report, panelInstanceId, panelApi = null, children }) => {
  const shellRef = useRef(null);
  const { isPaused } = usePanelShell();
  const emits = report?.events?.emits || [];
  const respondsTo = Array.from(new Set([...(report?.events?.respondsTo || []), DASHBOARD_GLOBAL_CRITERIA_EVENT]));
  const sources = deriveReportSources(report);
  const [showTechnicalMeta] = usePanelTechnicalMetaVisibility({
    panelInstanceId,
    panelComponentId: report?.panelId,
  });
  const [isLoading, setIsLoading] = React.useState(() => (
    resolvePanelLoading(panelInstanceId, report?.panelId)
  ));

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
  useEffect(() => {
    const node = shellRef.current;
    if (!node) return undefined;
    const onPointerDownCapture = (event) => {
      if (event.button !== 0) return;
      const becameActive = activateDockviewPanel(panelApi || panelInstanceId, {
        panelInstanceId,
        shell: node,
      });
      if (!becameActive) return;
      try { window.getSelection?.()?.removeAllRanges?.(); } catch { /* noop */ }
      replayClickAfterActivate(event);
    };
    node.addEventListener('pointerdown', onPointerDownCapture, true);
    return () => node.removeEventListener('pointerdown', onPointerDownCapture, true);
  }, [panelApi, panelInstanceId]);

  const isArcadePanel = isArcadeGamePanelComponent(report?.panelId);
  const {
    hasFiltersView,
    hasControlsView,
    hasColumnFiltersView,
    showFilters,
    showControls,
    showColumnFilters,
  } = useReportShellOptions(report?.panelId, panelInstanceId, report?.options || null);
  const shellPauseChrome = isPaused && !isArcadePanel;
  // Paused panels must not show the loading wash — that looks like a refresh.
  const showLoadingChrome = isLoading && !shellPauseChrome;
  const shellClassName = [
    'talia-report-shell',
    shellPauseChrome ? 'talia-report-shell--paused' : '',
    showLoadingChrome ? 'talia-report-shell--loading' : '',
    hasFiltersView && !showFilters ? 'talia-filters-hidden' : '',
    hasControlsView && !showControls ? 'talia-controls-hidden' : '',
    hasColumnFiltersView && !showColumnFilters ? 'talia-column-filters-hidden' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={shellRef}
      className={shellClassName}
      aria-busy={showLoadingChrome || undefined}
      data-panel-loading={showLoadingChrome ? 'true' : undefined}
      data-panel-paused={shellPauseChrome ? 'true' : undefined}
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
      <div className="talia-report-shell__content">{children}</div>
      {shellPauseChrome && (
        <div className="talia-report-shell__pause-overlay" role="note" aria-live="polite">
          <span className="talia-report-shell__pause-title">Paused</span>
          <span className="talia-report-shell__pause-subtitle">Press Play or P to resume</span>
        </div>
      )}
    </div>
  );
};

/**
 * Framework shell: identity + pause provider, then chrome.
 * Pause/resume is owned here so shared hooks gate refresh without per-panel wiring.
 */
const ReportShell = ({ report, panelInstanceId, panelApi = null, children }) => (
  <PanelShellProvider
    panelInstanceId={panelInstanceId || null}
    panelComponentId={report?.panelId || null}
  >
    <ReportShellChrome
      report={report}
      panelInstanceId={panelInstanceId}
      panelApi={panelApi}
    >
      {children}
    </ReportShellChrome>
  </PanelShellProvider>
);

export default ReportShell;
