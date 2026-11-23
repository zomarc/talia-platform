import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ScienceEvidence } from '../contracts/evidence.js';

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

const toRow = (evidence: ScienceEvidence, runId: string | null) => ({
  evidence_id: evidence.evidence_id,
  task_id: evidence.task_id,
  method_version: evidence.method_version,
  role: evidence.role,
  as_of: evidence.as_of,
  scope_type: evidence.scope?.type || 'unknown',
  scope: evidence.scope || {},
  subject_type: evidence.subject?.type || 'sailing',
  subject_id: evidence.subject?.id,
  subject: evidence.subject || {},
  peerset: evidence.peerset || {},
  prior: evidence.prior || {},
  decision_moments: evidence.decision_moments || [],
  material_value: evidence.material_value || {},
  revenue_value: evidence.revenue_value || {},
  covariate_ranks: evidence.covariate_ranks || [],
  forward_now: evidence.forward_now,
  reasons: evidence.reasons || [],
  diagnostics: evidence.diagnostics || {},
  payload: evidence,
  tenant_id: evidence.tenant_id || null,
  run_id: runId || evidence.run_id || null,
  updated_at: new Date().toISOString(),
});

export async function persistScienceEvidence(
  artifacts: ScienceEvidence[],
  runId: string | null = null
): Promise<void> {
  if (!artifacts.length) return;
  const rows = artifacts.map((row) => toRow(row, runId));
  const { error } = await getClient().from('rm_science_evidence').upsert(rows);
  if (error) throw new Error(`rm_science_evidence: ${error.message}`);
}

export async function updateEvidenceRole(
  evidenceId: string,
  role: 'advisory' | 'source'
): Promise<ScienceEvidence | null> {
  const { data, error } = await getClient()
    .from('rm_science_evidence')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('evidence_id', evidenceId)
    .select('payload')
    .maybeSingle();
  if (error) throw new Error(`rm_science_evidence role: ${error.message}`);
  if (!data?.payload) return null;
  return { ...(data.payload as ScienceEvidence), role };
}

/** Source-role citations for RM Agents (never invents score/action). */
export async function loadSourceCitationsBySail(
  sailCodes: string[]
): Promise<Record<string, ReturnType<typeof import('../contracts/evidence.js').citeEvidence>>> {
  const codes = [...new Set((sailCodes || []).map((c) => String(c || '').trim()).filter(Boolean))];
  if (!codes.length) return {};
  const { data, error } = await getClient()
    .from('rm_science_evidence')
    .select('evidence_id, task_id, role, subject_id, subject, payload, as_of')
    .in('subject_id', codes)
    .eq('role', 'source')
    .order('as_of', { ascending: false });
  if (error) throw new Error(`rm_science_evidence citations: ${error.message}`);

  const { citeEvidence } = await import('../contracts/evidence.js');
  const out: Record<string, ReturnType<typeof citeEvidence>> = {};
  for (const row of data || []) {
    const sail = String(row.subject_id || '');
    if (!sail || out[sail]) continue;
    const payload = (row.payload || {
      evidence_id: row.evidence_id,
      task_id: row.task_id,
      role: row.role,
      subject: row.subject || { type: 'sailing', id: sail },
    }) as import('../contracts/evidence.js').ScienceEvidence;
    out[sail] = citeEvidence(payload);
  }
  return out;
}
