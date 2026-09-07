export type EngineRun = {
  run_id: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'ok' | 'error';
  agent_ids: string[];
  finding_count: number;
  error: string | null;
  trigger: 'schedule' | 'on_demand' | 'startup';
};

const runs: EngineRun[] = [];
const MAX_RUNS = 50;

export function rememberRun(run: EngineRun): EngineRun {
  runs.unshift(run);
  if (runs.length > MAX_RUNS) runs.length = MAX_RUNS;
  return run;
}

export function updateRun(runId: string, patch: Partial<EngineRun>): EngineRun | null {
  const idx = runs.findIndex((row) => row.run_id === runId);
  if (idx < 0) return null;
  runs[idx] = { ...runs[idx], ...patch };
  return runs[idx];
}

export function listRuns(limit = 20): EngineRun[] {
  return runs.slice(0, limit);
}

export function lastRun(): EngineRun | null {
  return runs[0] || null;
}
