import React, { useCallback, useEffect, useState } from 'react';
import { trackedFetchGraphql } from '../../../services/data/trackedGraphql';
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await trackedFetchGraphql({
        query: STATUS_QUERY,
        component: 'EngineActivity',
        purpose: 'Load talia-engine activity',
        tableName: 'rm_engine_runs',
      });
      setStatus(data?.rmEngineStatus || null);
      setRuns(data?.rmEngineRuns || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runNow = useCallback(async () => {
    setRunMessage(null);
    const data = await trackedFetchGraphql({
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
  }, [load]);

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
