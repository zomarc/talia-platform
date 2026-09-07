import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SAIL_CLEAR_EVENT, SAIL_SELECT_EVENT } from '../../../lib/eventBus';
import { trackedFetchGraphql } from '../../../services/data/trackedGraphql';
import PanelDataState from '../../shared/PanelDataState';
import RmChecklistPresenter from './RmChecklistPresenter';

const FINDINGS_QUERY = `
  query RmFindings($filters: RmFindingFilters) {
    rmFindings(filters: $filters) {
      findingId
      agentId
      subjectId
      subject
      asOf
      score
      severity
      recommendedAction
      evidence
      confidence
      status
    }
  }
`;

const STATUS_MUTATION = `
  mutation UpdateRmFindingStatus($findingId: ID!, $status: String!) {
    updateRmFindingStatus(findingId: $findingId, status: $status) {
      findingId
      status
    }
  }
`;

const RUN_MUTATION = `
  mutation RunRmAgents($input: RunRmAgentsInput) {
    runRmAgents(input: $input) {
      success
      runId
      findingCount
      message
      error
    }
  }
`;

const RmChecklistContainer = ({ panelInstanceId, panelComponentId }) => {
  const [sailCode, setSailCode] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [runMessage, setRunMessage] = useState(null);

  const loadFindings = useCallback(async (nextSailCode = sailCode) => {
    setLoading(true);
    setError(null);
    try {
      const data = await trackedFetchGraphql({
        query: FINDINGS_QUERY,
        variables: {
          filters: {
            status: 'open',
            sailCode: nextSailCode || undefined,
            limit: 250,
          },
        },
        component: 'RmChecklist',
        purpose: 'Load open RM Findings',
        tableName: 'rm_findings',
      });
      setRows(data?.rmFindings || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [sailCode]);

  useEffect(() => {
    const onSelect = (event) => {
      const next = event?.detail?.canonical_scope?.sail_codes?.[0]
        || event?.detail?.sail_code
        || event?.detail?.row_data?.sail_code
        || null;
      setSailCode(next);
    };
    const onClear = () => setSailCode(null);
    window.addEventListener(SAIL_SELECT_EVENT, onSelect);
    window.addEventListener(SAIL_CLEAR_EVENT, onClear);
    return () => {
      window.removeEventListener(SAIL_SELECT_EVENT, onSelect);
      window.removeEventListener(SAIL_CLEAR_EVENT, onClear);
    };
  }, []);

  useEffect(() => {
    loadFindings(sailCode);
  }, [loadFindings, sailCode]);

  const updateStatus = useCallback(async (findingId, status) => {
    await trackedFetchGraphql({
      query: STATUS_MUTATION,
      variables: { findingId, status },
      component: 'RmChecklist',
      purpose: 'Update Finding status',
      tableName: 'rm_findings',
    });
    await loadFindings(sailCode);
  }, [loadFindings, sailCode]);

  const runRegulator = useCallback(async () => {
    setRunMessage(null);
    const data = await trackedFetchGraphql({
      query: RUN_MUTATION,
      variables: {
        input: sailCode ? { sailCodes: [sailCode], limit: 1 } : { limit: 24 },
      },
      component: 'RmChecklist',
      purpose: 'Run Regulator RM Agent',
      tableName: 'rm_findings',
    });
    const result = data?.runRmAgents;
    setRunMessage(result?.success
      ? `${result.message} (${result.findingCount} findings)`
      : (result?.error || result?.message || 'Run failed'));
    await loadFindings(sailCode);
  }, [loadFindings, sailCode]);

  const tableRows = useMemo(() => rows.map((row) => ({
    ...row,
    actionType: row.recommendedAction?.action_type || '',
    rationale: row.recommendedAction?.rationale || '',
    loadFactor: row.evidence?.load_factor,
    targetLoadFactor: row.evidence?.target_load_factor,
    gapSigned: row.evidence?.gap_signed,
    daysToSail: row.evidence?.days_to_sail,
  })), [rows]);

  return (
    <PanelDataState
      loading={loading}
      error={error}
      empty={false}
      onRetry={() => loadFindings(sailCode)}
    >
      <RmChecklistPresenter
        rows={tableRows}
        sailCode={sailCode}
        runMessage={runMessage}
        onRun={runRegulator}
        onAcknowledge={(id) => updateStatus(id, 'acknowledged')}
        onDismiss={(id) => updateStatus(id, 'dismissed')}
        onRefresh={() => loadFindings(sailCode)}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId || 'rm-checklist'}
      />
    </PanelDataState>
  );
};

export default RmChecklistContainer;
