/**
 * Project Summary Container — latest executive overview stored in the database.
 *
 * Data fetch/state only (library-first). Renders ProjectSummaryPresenter.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { trackedFetchGraphql } from '../../../services/data/trackedGraphql';
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

const ProjectSummaryContainer = ({ panelInstanceId, panelComponentId }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await trackedFetchGraphql({
        query: PROJECT_SUMMARY_QUERY,
        component: 'ProjectSummary',
        purpose: 'Load latest project summary',
        tableName: 'project_summary'
      });
      setSummary(data?.projectSummaryLatest || null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PanelDataState
      loading={loading}
      loadingMessage="Loading project summary..."
      error={error}
      errorTitle="Failed to load project summary"
      empty={!summary || !summary.content}
      emptyMessage="No project summary published yet. Run ./scripts/validate → 14 (Generate executive overview PDF) to publish the latest."
      onRetry={load}
    >
      <ProjectSummaryPresenter
        summary={summary}
        onRefresh={load}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId}
      />
    </PanelDataState>
  );
};

export default ProjectSummaryContainer;
