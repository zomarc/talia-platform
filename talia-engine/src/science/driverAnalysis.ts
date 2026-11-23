import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canPromoteToSource,
  citeEvidence,
  SCIENCE_TASK_ID,
  validateScienceEvidence,
  type EvidenceCitation,
  type ScienceEvidence,
} from '../contracts/evidence.js';
import { persistScienceEvidence, updateEvidenceRole } from '../adapters/evidenceWriter.js';
import { loadScienceWorld } from '../adapters/scienceWorldState.js';
import { persistRun } from '../adapters/findingWriter.js';
import { runPythonAnalyze } from '../python/runner.js';
import { rememberRun, updateRun, type EngineRun } from '../runtime/runStore.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const driverScript = path.resolve(here, '../../python/driver_analysis.py');

export type DriverAnalysisOptions = {
  sailCodes?: string[];
  shipCode?: string;
  historicLimit?: number;
  forwardLimit?: number;
  persist?: boolean;
  trigger?: EngineRun['trigger'];
};

export type DriverAnalysisResult = {
  run: EngineRun;
  artifacts: ScienceEvidence[];
  citations: EvidenceCitation[];
  portfolio_revenue_value: number;
  python: { ok: boolean; available: boolean; error?: string };
};

export async function runDriverAnalysis(
  options: DriverAnalysisOptions = {}
): Promise<DriverAnalysisResult> {
  const run: EngineRun = {
    run_id: randomUUID(),
    started_at: new Date().toISOString(),
    finished_at: null,
    status: 'running',
    agent_ids: [SCIENCE_TASK_ID],
    finding_count: 0,
    error: null,
    trigger: options.trigger || 'on_demand',
  };
  rememberRun(run);
  try {
    await persistRun(run);
  } catch {
    // best-effort
  }

  try {
    const world = await loadScienceWorld({
      sailCodes: options.sailCodes,
      shipCode: options.shipCode,
      historicLimit: options.historicLimit,
      forwardLimit: options.forwardLimit,
    });

    const python = await runPythonAnalyze(
      {
        task: SCIENCE_TASK_ID,
        payload: {
          as_of: world.as_of,
          role: world.role,
          scope: world.scope,
          historic: world.historic,
          subjects: world.subjects,
        },
      },
      driverScript
    );

    if (!python.ok) {
      throw new Error(python.error || 'driver_analysis python failed');
    }

    const rawArtifacts = Array.isArray((python.result as any)?.artifacts)
      ? (python.result as any).artifacts
      : [];
    const artifacts: ScienceEvidence[] = [];
    for (const row of rawArtifacts) {
      const evidence = { ...row, run_id: run.run_id } as ScienceEvidence;
      const errors = validateScienceEvidence(evidence);
      if (errors.length) {
        throw new Error(`Invalid ScienceEvidence: ${errors.join('; ')}`);
      }
      artifacts.push(evidence);
    }

    if (options.persist !== false) {
      try {
        await persistScienceEvidence(artifacts, run.run_id);
      } catch {
        // table may not exist yet in some local envs
      }
    }

    const citations = artifacts.map((a) => citeEvidence(a));
    const portfolio = Number((python.result as any)?.portfolio_revenue_value) ||
      artifacts.reduce((sum, a) => sum + Number(a.revenue_value?.amount || 0), 0);

    const finished = updateRun(run.run_id, {
      finished_at: new Date().toISOString(),
      status: 'ok',
      finding_count: 0,
    }) || run;
    try {
      await persistRun(finished);
    } catch {
      // ignore
    }

    return {
      run: finished,
      artifacts,
      citations,
      portfolio_revenue_value: portfolio,
      python: { ok: true, available: python.available },
    };
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

/** Promote advisory Evidence to source when gate checks pass (future consumers). */
export async function promoteEvidenceToSource(evidenceId: string, artifact: ScienceEvidence) {
  const blockers = canPromoteToSource(artifact);
  if (blockers.length) {
    return { success: false, role: artifact.role, blockers, citation: null as EvidenceCitation | null };
  }
  const updated = await updateEvidenceRole(evidenceId, 'source');
  if (!updated) {
    return { success: false, role: artifact.role, blockers: ['not found'], citation: null };
  }
  return {
    success: true,
    role: 'source' as const,
    blockers: [],
    citation: citeEvidence(updated),
  };
}
