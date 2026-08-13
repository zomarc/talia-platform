/**
 * MSE review highlight: actual LF vs active target LF end-state.
 */

import { resolveVoyageScope } from './booking-profile-dimensional.js';

const DEFAULT_BEHIND_PP = 3;
const DEFAULT_AHEAD_PP = 3;

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function classifyGap(actualLf, targetLf, thresholds = {}) {
  if (actualLf == null || targetLf == null) return 'unknown';
  const behind = thresholds.behindPp ?? DEFAULT_BEHIND_PP;
  const ahead = thresholds.aheadPp ?? DEFAULT_AHEAD_PP;
  const gap = actualLf - targetLf;
  if (gap < -behind) return 'behind';
  if (gap > ahead) return 'ahead';
  return 'on';
}

/**
 * Voyage-level end LF from active target (prefer weeks=0 / lowest weeks, else any voyage node).
 */
function endTargetLf(profile) {
  if (!profile?.nodes?.length) return null;
  const voyage = profile.nodes.filter((n) => n.dimensionLevel === 'voyage');
  if (!voyage.length) return null;
  const withWeeks = voyage.filter((n) => n.weeksUntilSailing != null);
  if (withWeeks.length) {
    withWeeks.sort((a, b) => Number(a.weeksUntilSailing) - Number(b.weeksUntilSailing));
    return round2(withWeeks[0].lfPct);
  }
  return round2(voyage[0].lfPct);
}

/**
 * Batch review status for master sail codes (canonical reference preferred).
 * actualLfPctBySail: optional map from UI (MSE already has cabin LF).
 */
export async function getProfileTargetReviewStatuses(client, sailCodes, options = {}) {
  const codes = [...new Set((sailCodes || []).map((c) => String(c || '').trim()).filter(Boolean))];
  if (!codes.length) return [];

  const behindPp = options.behindPp != null ? Number(options.behindPp) : DEFAULT_BEHIND_PP;
  const aheadPp = options.aheadPp != null ? Number(options.aheadPp) : DEFAULT_AHEAD_PP;
  const actualBySail = options.actualLfPctBySail || {};

  const results = [];
  for (const sailCode of codes) {
    let scope;
    try {
      scope = await resolveVoyageScope(client, sailCode);
    } catch {
      results.push({
        sailCode,
        referenceSailCode: sailCode,
        inventoryItemId: null,
        status: 'unknown',
        actualLfPct: actualBySail[sailCode] ?? null,
        targetLfPct: null,
        gapPp: null,
        activeTargetId: null,
        activeTargetName: null,
      });
      continue;
    }

    const inventoryItemId = scope.inventoryItemId;
    let activeTarget = null;
    if (inventoryItemId) {
      const { data: profiles } = await client
        .from('inventory_target_profile')
        .select('id, name, is_active')
        .eq('inventory_item_id', inventoryItemId)
        .eq('is_active', true)
        .limit(1);
      if (profiles?.[0]) {
        const { data: nodes } = await client
          .from('inventory_target_profile_node')
          .select('dimension_level, weeks_until_sailing, lf_pct')
          .eq('profile_id', profiles[0].id);
        activeTarget = {
          id: String(profiles[0].id),
          name: profiles[0].name,
          nodes: (nodes || []).map((n) => ({
            dimensionLevel: n.dimension_level,
            weeksUntilSailing: n.weeks_until_sailing,
            lfPct: Number(n.lf_pct) || 0,
          })),
        };
      }
    }

    const ref = scope.referenceSailCode || sailCode;
    const actualLf =
      actualBySail[sailCode] ??
      actualBySail[ref] ??
      null;
    const targetLf = endTargetLf(activeTarget);
    const gapPp =
      actualLf != null && targetLf != null ? round2(actualLf - targetLf) : null;
    const status = classifyGap(actualLf, targetLf, { behindPp, aheadPp });

    results.push({
      sailCode,
      referenceSailCode: ref,
      inventoryItemId: inventoryItemId != null ? String(inventoryItemId) : null,
      status,
      actualLfPct: actualLf != null ? round2(actualLf) : null,
      targetLfPct: targetLf,
      gapPp,
      activeTargetId: activeTarget?.id || null,
      activeTargetName: activeTarget?.name || null,
    });
  }

  return results;
}

export { classifyGap, endTargetLf };
