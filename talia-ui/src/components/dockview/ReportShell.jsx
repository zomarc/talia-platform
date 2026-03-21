import React, { useEffect, useState } from "react";
import ReportEventMeta from "../shared/ReportEventMeta";
import { REPORT_PANEL_PAUSE_EVENT, REPORT_TOGGLE_DETAILS_EVENT } from "./eventConstants";
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

const ReportShell = ({ report, panelInstanceId, children }) => {
  const emits = report?.events?.emits || [];
  const respondsTo = Array.from(new Set([...(report?.events?.respondsTo || []), DASHBOARD_GLOBAL_CRITERIA_EVENT]));
  const sources = deriveReportSources(report);
  const [showDetails, setShowDetails] = useState(false);
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
    const handleToggleDetails = (event) => {
      const requestedPanelId = event?.detail?.panelId;
      if (!requestedPanelId) return;
      if (requestedPanelId !== panelInstanceId && requestedPanelId !== report?.panelId) return;
      setShowDetails((prev) => !prev);
    };
    window.addEventListener(REPORT_TOGGLE_DETAILS_EVENT, handleToggleDetails);
    return () => window.removeEventListener(REPORT_TOGGLE_DETAILS_EVENT, handleToggleDetails);
  }, [panelInstanceId, report?.panelId]);

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

  return (
    <div className={`talia-report-shell ${isPaused ? 'talia-report-shell--paused' : ''}`}>
      {showDetails && (
        <ReportEventMeta
          emits={emits}
          respondsTo={respondsTo}
          sources={sources}
          panelInstanceId={panelInstanceId}
          panelComponentId={report?.panelId}
        />
      )}
      <div className="talia-report-shell__content">{children}</div>
      {isPaused && (
        <div className="talia-report-shell__pause-overlay" role="note" aria-live="polite">
          <span className="talia-report-shell__pause-title">Paused</span>
          <span className="talia-report-shell__pause-subtitle">Press P to resume</span>
        </div>
      )}
    </div>
  );
};

export default ReportShell;
