/**
 * Project Summary container — published overview, plan, and open risks.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import { trackedFetchGraphql } from '../../../services/data/trackedGraphql';
import { VIEW_PROVENANCE } from '../../../lib/componentOptionsCatalog';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import { buildManagementBrief } from '../../../lib/projectSummaryBrief';
import { canAccessPrivilegedPanels, normalizeRole } from '../../../utils/roleUtils';
import ProjectSummaryPresenter from './ProjectSummaryPresenter';
import PanelDataState from '../../shared/PanelDataState';

const PROJECT_SUMMARY_QUERY = `
  query ProjectSummaryLatest {
    projectSummaryLatest {
      id
      title
      version
      format
      content
      generatedAt
    }
  }
`;

const PROJECT_SUMMARY_BRIEF_QUERY = `
  query ProjectSummaryBrief {
    projectPlanCalendar {
      phases { code label targetOn sortOrder }
      milestones { id name phaseCode targetOn }
    }
    functionalityMatrixItems { id referenceCode element shortName phase }
    riskRegisterItems {
      id
      referenceCode
      title
      statement
      category
      likelihood
      impact
      proximity
      status
      response
      treatment
      owner
    }
    requirementItems(filters: { includeDone: true, limit: 200 }) {
      id
      title
      detail
      status
      priority
      area
      targetVersion
      updatedAt
    }
  }
`;

const SUMMARY_OPTIONS = {
  views: [VIEW_PROVENANCE],
  operations: [],
};

const ProjectSummaryContainer = ({ panelInstanceId, panelComponentId }) => {
  const { user } = useSupabaseAuth();
  const allowed = canAccessPrivilegedPanels(normalizeRole(user?.role || 'USER'));
  const {
    showProvenance,
    reportShellClassName,
  } = useReportShellOptions(panelComponentId || 'project-summary', panelInstanceId, SUMMARY_OPTIONS);
  const [summary, setSummary] = useState(null);
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const summaryRequest = trackedFetchGraphql({
      query: PROJECT_SUMMARY_QUERY,
      component: panelComponentId || 'project-summary',
      purpose: 'Load latest project summary',
      tableName: 'project_summary',
    });
    const briefRequest = allowed
      ? trackedFetchGraphql({
        query: PROJECT_SUMMARY_BRIEF_QUERY,
        component: panelComponentId || 'project-summary',
        purpose: 'Load plan and risks for the project summary',
        tableName: 'project_phase',
      })
      : Promise.resolve(null);

    const [summaryResult, briefResult] = await Promise.allSettled([summaryRequest, briefRequest]);
    if (summaryResult.status === 'fulfilled') {
      setSummary(summaryResult.value?.projectSummaryLatest || null);
    } else {
      setSummary(null);
    }
    if (briefResult.status === 'fulfilled' && briefResult.value) {
      try {
        const data = briefResult.value;
        setBrief(buildManagementBrief({
          phases: data.projectPlanCalendar?.phases,
          milestones: data.projectPlanCalendar?.milestones,
          matrixItems: data.functionalityMatrixItems,
          risks: data.riskRegisterItems,
          work: data.requirementItems,
        }));
      } catch {
        setBrief(null);
      }
    } else {
      setBrief(null);
    }
    if (summaryResult.status === 'rejected' && briefResult.status !== 'fulfilled') {
      setError(summaryResult.reason);
    }
    setLoading(false);
  }, [allowed, panelComponentId]);

  useEffect(() => {
    load();
  }, [load]);

  const hasContent = Boolean(summary?.content) || Boolean(brief?.phases?.length) || Boolean(brief?.risks?.length);

  return (
    <PanelDataState
      loading={loading && !hasContent}
      loadingMessage="Loading project summary..."
      error={error && !hasContent ? error : null}
      errorTitle="Failed to load project summary"
      empty={!loading && !hasContent}
      emptyMessage="No project record yet."
      onRetry={load}
    >
      <ProjectSummaryPresenter
        summary={summary}
        brief={brief}
        onRefresh={load}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId}
        showProvenance={showProvenance}
        reportShellClassName={reportShellClassName}
      />
    </PanelDataState>
  );
};

export default ProjectSummaryContainer;
