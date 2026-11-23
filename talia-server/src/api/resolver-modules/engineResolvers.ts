import { supabase } from '../../services/supabase.js';
import {
  fetchEngineHealth,
  requestDriverAnalysis,
  requestEngineRun,
  requestEvidencePromote,
} from '../../lib/engineClient.js';
import { scienceEvidenceCitationFromRow } from '../../lib/scienceEvidenceCitation.js';

const mapFinding = (row: any) => ({
  findingId: row.finding_id,
  agentId: row.agent_id,
  subjectType: row.subject_type,
  subjectId: row.subject_id,
  subject: row.subject || {},
  asOf: row.as_of,
  score: Number(row.score),
  severity: row.severity,
  recommendedAction: row.recommended_action || {},
  evidence: row.evidence || {},
  confidence: row.confidence == null ? null : Number(row.confidence),
  status: row.status,
  tenantId: row.tenant_id || null,
  runId: row.run_id || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapRun = (row: any) => ({
  runId: row.run_id,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  status: row.status,
  agentIds: row.agent_ids || [],
  findingCount: row.finding_count || 0,
  error: row.error || null,
  trigger: row.trigger || null,
});

const mapScienceEvidence = (row: any) => ({
  evidenceId: row.evidence_id,
  taskId: row.task_id,
  methodVersion: row.method_version,
  role: row.role,
  asOf: row.as_of,
  scopeType: row.scope_type,
  scope: row.scope || {},
  subjectType: row.subject_type,
  subjectId: row.subject_id,
  subject: row.subject || {},
  peerset: row.peerset || {},
  prior: row.prior || {},
  decisionMoments: row.decision_moments || [],
  materialValue: row.material_value || {},
  revenueValue: row.revenue_value || {},
  covariateRanks: row.covariate_ranks || [],
  forwardNow: row.forward_now || null,
  reasons: row.reasons || [],
  diagnostics: row.diagnostics || {},
  payload: row.payload || {},
  tenantId: row.tenant_id || null,
  runId: row.run_id || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const engineQueryResolvers = {
  rmFindings: async (_parent: any, args: any) => {
    const filters = args?.filters || {};
    const limit = Math.min(Math.max(Number(filters.limit) || 200, 1), 1000);
    let query = supabase
      .from('rm_findings')
      .select('*')
      .order('score', { ascending: false })
      .limit(limit);
    if (filters.status) query = query.eq('status', filters.status);
    else query = query.neq('status', 'expired');
    if (Array.isArray(filters.sailCodes) && filters.sailCodes.length) {
      query = query.in('subject_id', filters.sailCodes);
    } else if (filters.sailCode) {
      query = query.eq('subject_id', filters.sailCode);
    }
    if (filters.agentId) query = query.eq('agent_id', filters.agentId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map(mapFinding);
  },

  rmEngineRuns: async (_parent: any, args: any) => {
    const limit = Math.min(Math.max(Number(args?.limit) || 20, 1), 100);
    const { data, error } = await supabase
      .from('rm_engine_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data || []).map(mapRun);
  },

  rmEngineStatus: async () => {
    const health = await fetchEngineHealth();
    const { data: last } = await supabase
      .from('rm_engine_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      online: health.online,
      url: health.url,
      version: health.version,
      error: health.error,
      pythonAvailable: Boolean(health.python?.available),
      pythonInterpreter: health.python?.interpreter || null,
      lastRun: last ? mapRun(last) : null,
    };
  },

  scienceEvidence: async (_parent: any, args: any) => {
    const filters = args?.filters || {};
    const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 500);
    let query = supabase
      .from('rm_science_evidence')
      .select('*')
      .order('as_of', { ascending: false })
      .limit(limit);
    if (filters.role) query = query.eq('role', filters.role);
    if (Array.isArray(filters.subjectIds) && filters.subjectIds.length) {
      query = query.in('subject_id', filters.subjectIds);
    } else if (filters.subjectId) {
      query = query.eq('subject_id', filters.subjectId);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    let rows = data || [];
    if (filters.horizon) {
      rows = rows.filter((row: any) => row?.subject?.horizon === filters.horizon);
    }
    return rows.map(mapScienceEvidence);
  },
};

export const engineMutationResolvers = {
  updateRmFindingStatus: async (_parent: any, args: any) => {
    const status = String(args?.status || '');
    const allowed = ['open', 'acknowledged', 'dismissed', 'applied', 'expired'];
    if (!allowed.includes(status)) throw new Error(`Invalid Finding status: ${status}`);
    const { data, error } = await supabase
      .from('rm_findings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('finding_id', args.findingId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapFinding(data);
  },

  runRmAgents: async (_parent: any, args: any) => {
    const input = args?.input || {};
    try {
      const result: any = await requestEngineRun({
        sailCodes: input.sailCodes || undefined,
        agentIds: input.agentIds || undefined,
        limit: input.limit,
      });
      return {
        success: true,
        runId: result?.run?.run_id || null,
        findingCount: result?.finding_count || 0,
        message: 'RM Agents evaluated',
        error: null,
      };
    } catch (error: any) {
      return {
        success: false,
        runId: null,
        findingCount: 0,
        message: 'talia-engine is not reachable',
        error: error?.message || String(error),
      };
    }
  },

  runDriverAnalysis: async (_parent: any, args: any) => {
    const input = args?.input || {};
    try {
      const result: any = await requestDriverAnalysis({
        sailCodes: input.sailCodes || undefined,
        shipCode: input.shipCode || undefined,
        historicLimit: input.historicLimit,
        forwardLimit: input.forwardLimit,
      });
      const artifacts = Array.isArray(result?.artifacts)
        ? result.artifacts.map((artifact: any) => mapScienceEvidence({
          evidence_id: artifact.evidence_id,
          task_id: artifact.task_id,
          method_version: artifact.method_version,
          role: artifact.role,
          as_of: artifact.as_of,
          scope_type: artifact.scope?.type,
          scope: artifact.scope,
          subject_type: artifact.subject?.type,
          subject_id: artifact.subject?.id,
          subject: artifact.subject,
          peerset: artifact.peerset,
          prior: artifact.prior,
          decision_moments: artifact.decision_moments,
          material_value: artifact.material_value,
          revenue_value: artifact.revenue_value,
          covariate_ranks: artifact.covariate_ranks,
          forward_now: artifact.forward_now,
          reasons: artifact.reasons,
          diagnostics: artifact.diagnostics,
          payload: artifact,
          tenant_id: artifact.tenant_id,
          run_id: result?.run?.run_id || artifact.run_id,
          created_at: null,
          updated_at: null,
        }))
        : [];
      return {
        success: true,
        runId: result?.run?.run_id || null,
        artifactCount: result?.artifact_count || artifacts.length,
        portfolioRevenueValue: result?.portfolio_revenue_value ?? null,
        message: 'Driver analysis complete (advisory Evidence)',
        error: null,
        artifacts,
        citations: result?.citations || artifacts.map(scienceEvidenceCitationFromRow),
      };
    } catch (error: any) {
      return {
        success: false,
        runId: null,
        artifactCount: 0,
        portfolioRevenueValue: null,
        message: 'talia-engine driver analysis failed or unreachable',
        error: error?.message || String(error),
        artifacts: [],
        citations: [],
      };
    }
  },

  promoteScienceEvidence: async (_parent: any, args: any) => {
    const evidenceId = String(args?.evidenceId || '');
    const { data, error } = await supabase
      .from('rm_science_evidence')
      .select('*')
      .eq('evidence_id', evidenceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return { success: false, role: null, blockers: ['not found'], citation: null, evidence: null };
    }
    try {
      const result: any = await requestEvidencePromote({
        evidenceId,
        artifact: data.payload || mapScienceEvidence(data),
      });
      if (!result?.success) {
        return {
          success: false,
          role: data.role,
          blockers: result?.blockers || ['promotion blocked'],
          citation: null,
          evidence: mapScienceEvidence(data),
        };
      }
      const { data: updated, error: upErr } = await supabase
        .from('rm_science_evidence')
        .update({ role: 'source', updated_at: new Date().toISOString() })
        .eq('evidence_id', evidenceId)
        .select('*')
        .single();
      if (upErr) throw new Error(upErr.message);
      // Keep payload.role in sync for consumers reading payload JSON.
      const payload = { ...(updated.payload || {}), role: 'source' };
      await supabase
        .from('rm_science_evidence')
        .update({ payload })
        .eq('evidence_id', evidenceId);
      const mapped = mapScienceEvidence({ ...updated, role: 'source', payload });
      return {
        success: true,
        role: 'source',
        blockers: [],
        citation: scienceEvidenceCitationFromRow(mapped),
        evidence: mapped,
      };
    } catch (err: any) {
      return {
        success: false,
        role: data.role,
        blockers: [err?.message || String(err)],
        citation: null,
        evidence: mapScienceEvidence(data),
      };
    }
  },
};
