import { supabase } from '../../services/supabase.js';
import { fetchEngineHealth, requestEngineRun } from '../../lib/engineClient.js';

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
      const result = await requestEngineRun({
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
};
