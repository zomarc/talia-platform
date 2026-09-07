import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Finding } from '../contracts/finding.js';
import type { EngineRun } from '../runtime/runStore.js';

const supabaseConfig = {
  url: process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
    || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz',
};

let client: SupabaseClient | null = null;

const getClient = () => {
  if (!client) {
    client = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
};

const toRow = (finding: Finding, runId: string) => ({
  finding_id: finding.finding_id,
  agent_id: finding.agent_id,
  subject_type: finding.subject.type,
  subject_id: finding.subject.id,
  subject: finding.subject,
  as_of: finding.as_of,
  score: finding.score,
  severity: finding.severity,
  recommended_action: finding.recommended_action,
  evidence: finding.evidence,
  confidence: finding.confidence ?? null,
  status: finding.status,
  tenant_id: finding.tenant_id || null,
  run_id: runId,
});

export async function persistRun(run: EngineRun): Promise<void> {
  const { error } = await getClient().from('rm_engine_runs').upsert({
    run_id: run.run_id,
    started_at: run.started_at,
    finished_at: run.finished_at,
    status: run.status,
    agent_ids: run.agent_ids,
    finding_count: run.finding_count,
    error: run.error,
    trigger: run.trigger,
  });
  if (error) throw new Error(`rm_engine_runs: ${error.message}`);
}

export async function replaceOpenFindings(agentId: string, findings: Finding[], runId: string): Promise<void> {
  const subjectIds = [...new Set(findings.map((row) => row.subject.id))];
  if (subjectIds.length) {
    const { error: expireError } = await getClient()
      .from('rm_findings')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('agent_id', agentId)
      .eq('status', 'open')
      .in('subject_id', subjectIds);
    if (expireError) throw new Error(`expire findings: ${expireError.message}`);
  }
  if (!findings.length) return;
  const { error } = await getClient().from('rm_findings').insert(findings.map((row) => toRow(row, runId)));
  if (error) throw new Error(`rm_findings: ${error.message}`);
}
