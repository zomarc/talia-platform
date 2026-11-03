/**
 * Shared hop/concern matching for Instance networking diagrams.
 */

export const severityRank = { high: 0, medium: 1, info: 2 };

export function hopMatchesTarget(hopId, targetId) {
  if (hopId === 'synapse_sql' || hopId === 'azure_firewall') return targetId === 'azure_synapse';
  if (hopId === 'supabase_kong') return targetId === 'supabase_postgres';
  return false;
}

export function concernTouchesHop(concern, hopId) {
  if (concern.id === 'synapse_ip_firewall' && (hopId === 'azure_firewall' || hopId === 'egress_public' || hopId === 'synapse_sql')) {
    return true;
  }
  if (concern.id === 'egress_mismatch' && hopId === 'egress_public') return true;
  if (concern.id === 'egress_matches_expected' && hopId === 'egress_public') return true;
  if (concern.id === 'egress_unknown' && hopId === 'egress_public') return true;
  if (concern.id === 'synapse_unreachable' && (hopId === 'synapse_sql' || hopId === 'azure_firewall')) return true;
  return false;
}

export function concernForHop(hopId, concerns) {
  const related = (concerns || []).filter((c) => c.relatedTargetId && hopMatchesTarget(hopId, c.relatedTargetId));
  const byHop = (concerns || []).filter((c) => concernTouchesHop(c, hopId));
  const list = [...related, ...byHop];
  if (!list.length) return null;
  return list.sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9))[0];
}

/** Map a networking concern to a diagram node state. */
export function concernToState(concern) {
  if (!concern) return null;
  if (concern.severity === 'info') return 'ok';
  if (concern.severity === 'high') return 'blocked';
  return 'warn';
}

/** Resolve a dataTargets[] entry by id. */
export function findTarget(targets, id) {
  return (targets || []).find((t) => t.id === id) || null;
}

/**
 * Target probe → node state.
 * skipped → unknown; online false → blocked; online true → ok.
 */
export function targetToState(target) {
  if (!target) return 'unknown';
  if (target.skipped) return 'unknown';
  if (target.online === true) return 'ok';
  if (target.online === false) return 'blocked';
  return 'unknown';
}

/** Prefer the worse of two states for overlay. */
export function worseState(a, b) {
  const rank = { blocked: 0, warn: 1, unknown: 2, policy: 3, static: 4, ok: 5 };
  const ra = rank[a] ?? 9;
  const rb = rank[b] ?? 9;
  return ra <= rb ? a : b;
}
