import React, { useEffect, useState } from "react";
import ReportEventMeta from "../shared/ReportEventMeta";
import { REPORT_TOGGLE_DETAILS_EVENT } from "./eventConstants";
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

  return (
    <div className="talia-report-shell">
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
    </div>
  );
};

export default ReportShell;
