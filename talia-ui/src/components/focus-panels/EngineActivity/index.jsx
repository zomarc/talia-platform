import React, { useCallback, useEffect, useRef, useState } from 'react';
import usePanelTrackedFetch from '../../../hooks/usePanelTrackedFetch';
import PanelDataState from '../../shared/PanelDataState';
import EngineActivityPresenter from './EngineActivityPresenter';

const STATUS_QUERY = `
  query RmEngineActivity {
    rmEngineStatus {
      online
      url
      version
      error
      pythonAvailable
      pythonInterpreter
      lastRun {
        runId
        startedAt
        finishedAt
        status
        findingCount
        trigger
        error
      }
    }
    rmEngineRuns(limit: 20) {
      runId
      startedAt
      finishedAt
      status
      agentIds
      findingCount
      trigger
      error
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

const EngineActivityContainer = ({ panelInstanceId, panelComponentId }) => {
  const [status, setStatus] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [runMessage, setRunMessage] = useState(null);
  const { shouldSkipRefresh, fetchGraphql, onResumeFetch } = usePanelTrackedFetch(
    panelInstanceId,
    panelComponentId
  );
  const loadRef = useRef(null);

  const load = useCallback(async () => {
    if (shouldSkipRefresh()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGraphql({
        query: STATUS_QUERY,
        component: 'EngineActivity',
        purpose: 'Load talia-engine activity',
        tableName: 'rm_engine_runs',
      });
      setStatus(data?.rmEngineStatus || null);
      setRuns(data?.rmEngineRuns || []);
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [fetchGraphql, shouldSkipRefresh]);

  loadRef.current = load;

  useEffect(() => {
    onResumeFetch(() => { loadRef.current?.(); });
    return () => onResumeFetch(null);
  }, [onResumeFetch]);

  useEffect(() => { load(); }, [load]);

  const runNow = useCallback(async () => {
    setRunMessage(null);
    try {
      const data = await fetchGraphql({
        query: RUN_MUTATION,
        variables: { input: { limit: 24 } },
        component: 'EngineActivity',
        purpose: 'On-demand engine run',
        tableName: 'rm_engine_runs',
      });
      const result = data?.runRmAgents;
      setRunMessage(result?.success
        ? `${result.message} (${result.findingCount} findings)`
        : (result?.error || result?.message || 'Run failed'));
      await load();
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setRunMessage(err?.message || String(err));
    }
  }, [fetchGraphql, load]);

  return (
    <PanelDataState
      loading={loading}
      error={error}
      empty={false}
      onRetry={load}
    >
      <EngineActivityPresenter
        status={status}
        runs={runs}
        runMessage={runMessage}
        onRun={runNow}
        onRefresh={load}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId || 'engine-activity'}
      />
    </PanelDataState>
  );
};

export default EngineActivityContainer;
