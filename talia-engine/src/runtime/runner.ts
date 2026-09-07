import { randomUUID } from 'node:crypto';
import { validateFinding, type Finding } from '../contracts/finding.js';
import { loadWorldState } from '../adapters/worldStateClient.js';
import { persistRun, replaceOpenFindings } from '../adapters/findingWriter.js';
import { getRmAgent, listRmAgents } from './registry.js';
import { lastRun, listRuns, rememberRun, updateRun, type EngineRun } from './runStore.js';

export type RunOptions = {
  sailCodes?: string[];
  agentIds?: string[];
  trigger?: EngineRun['trigger'];
  limit?: number;
};

export async function runRmAgents(options: RunOptions = {}) {
  const agents = (options.agentIds?.length
    ? options.agentIds.map((id) => getRmAgent(id)).filter(Boolean)
    : listRmAgents()) as ReturnType<typeof listRmAgents>;

  const run: EngineRun = {
    run_id: randomUUID(),
    started_at: new Date().toISOString(),
    finished_at: null,
    status: 'running',
    agent_ids: agents.map((agent) => agent.id),
    finding_count: 0,
    error: null,
    trigger: options.trigger || 'on_demand',
  };
  rememberRun(run);
  try {
    await persistRun(run);
  } catch {
    // Persistence is best-effort so a missing table does not block dry evaluation.
  }

  try {
    if (!agents.length) throw new Error('No RM Agents registered');
    const asOf = new Date();
    const world = await loadWorldState({
      sailCodes: options.sailCodes,
      asOf,
      limit: options.limit,
    });
    const subjects = options.sailCodes?.length
      ? options.sailCodes.map((id) => ({ type: 'sailing', id }))
      : 'all-configured' as const;

    const findings: Finding[] = [];
    for (const agent of agents) {
      const produced = await agent.evaluate({ as_of: asOf, subjects, world });
      for (const finding of produced) {
        const errors = validateFinding(finding);
        if (errors.length) {
          throw new Error(`${agent.id} invalid Finding: ${errors.join('; ')}`);
        }
        findings.push(finding);
      }
      await replaceOpenFindings(agent.id, produced, run.run_id);
    }

    const finished = updateRun(run.run_id, {
      finished_at: new Date().toISOString(),
      status: 'ok',
      finding_count: findings.length,
    }) || run;
    try {
      await persistRun(finished);
    } catch {
      // same best-effort
    }
    return { run: finished, findings, worldCounts: {
      sails: world.sails.length,
      occupancy: Object.keys(world.occupancyBySail).length,
      targets: Object.keys(world.targetsBySail).length,
    } };
  } catch (error: any) {
    const finished = updateRun(run.run_id, {
      finished_at: new Date().toISOString(),
      status: 'error',
      error: error?.message || String(error),
    }) || run;
    try {
      await persistRun(finished);
    } catch {
      // ignore
    }
    throw error;
  }
}

export function engineSnapshot() {
  return {
    agents: listRmAgents().map((agent) => ({ id: agent.id, name: agent.name })),
    runs: listRuns(),
    last_run: lastRun(),
  };
}
