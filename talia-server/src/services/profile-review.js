/**
 * MSE review highlight: actual LF vs active target LF end-state.
 */

const DEFAULT_BEHIND_PP = 3;
const DEFAULT_AHEAD_PP = 3;
const IN_BATCH = 80;

function clean(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

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

export function pickMasterInventoryItem(items = [], requestedCode) {
  const code = clean(requestedCode);
  const poolFor = (key) => (items || []).filter((item) => {
    const sail = clean(item.sail_code);
    const ref = clean(item.reference_sail_code);
    return sail === key || ref === key;
  });
  const pickFrom = (pool) => (
    pool.find((item) => item.sailing_role === 'master')
    || pool.find((item) => clean(item.sail_code) === clean(item.reference_sail_code))
    || pool.find((item) => clean(item.sail_code) === code)
    || pool[0]
    || null
  );
  const direct = poolFor(code);
  if (!direct.length) return null;
  const master = pickFrom(direct);
  if (master?.sailing_role === 'master') return master;
  const ref = clean(direct[0]?.reference_sail_code) || clean(direct[0]?.sail_code);
  if (ref && ref !== code) {
    const viaRef = pickFrom(poolFor(ref));
    if (viaRef) return viaRef;
  }
  return master;
}

async function fetchInBatches(client, table, column, values, select) {
  const out = [];
  for (let i = 0; i < values.length; i += IN_BATCH) {
    const batch = values.slice(i, i + IN_BATCH);
    const { data, error } = await client.from(table).select(select).in(column, batch);
    if (error) throw error;
    out.push(...(data || []));
  }
  return out;
}

/**
 * Batch review status for master sail codes (canonical reference preferred).
 * actualLfPctBySail: optional map from UI (MSE already has cabin LF).
 */
export async function getProfileTargetReviewStatuses(client, sailCodes, options = {}) {
  const codes = [...new Set((sailCodes || []).map((c) => clean(c)).filter(Boolean))];
  if (!codes.length) return [];

  const behindPp = options.behindPp != null ? Number(options.behindPp) : DEFAULT_BEHIND_PP;
  const aheadPp = options.aheadPp != null ? Number(options.aheadPp) : DEFAULT_AHEAD_PP;
  const actualBySail = options.actualLfPctBySail || {};

  const itemSelect = 'id, sail_code, reference_sail_code, sailing_role';
  const [bySail, byRef] = await Promise.all([
    fetchInBatches(client, 'inventory_item', 'sail_code', codes, itemSelect),
    fetchInBatches(client, 'inventory_item', 'reference_sail_code', codes, itemSelect),
  ]);
  const seenItems = new Set();
  const items = [];
  for (const item of [...bySail, ...byRef]) {
    const key = String(item.id);
    if (seenItems.has(key)) continue;
    seenItems.add(key);
    items.push(item);
  }

  const itemByCode = new Map();
  codes.forEach((code) => {
    const item = pickMasterInventoryItem(items, code);
    if (item) itemByCode.set(code, item);
  });

  const itemIds = [...new Set([...itemByCode.values()].map((item) => item.id).filter(Boolean))];
  const profiles = itemIds.length
    ? await fetchInBatches(
      client,
      'inventory_target_profile',
      'inventory_item_id',
      itemIds,
      'id, name, is_active, inventory_item_id'
    )
    : [];
  const activeByItem = new Map();
  profiles.forEach((profile) => {
    if (!profile.is_active) return;
    const key = String(profile.inventory_item_id);
    if (!activeByItem.has(key)) activeByItem.set(key, profile);
  });

  const profileIds = [...activeByItem.values()].map((profile) => profile.id);
  const nodes = profileIds.length
    ? await fetchInBatches(
      client,
      'inventory_target_profile_node',
      'profile_id',
      profileIds,
      'profile_id, dimension_level, weeks_until_sailing, lf_pct'
    )
    : [];
  const nodesByProfile = new Map();
  nodes.forEach((node) => {
    const list = nodesByProfile.get(node.profile_id) || [];
    list.push(node);
    nodesByProfile.set(node.profile_id, list);
  });

  return codes.map((sailCode) => {
    const item = itemByCode.get(sailCode) || null;
    const profile = item ? activeByItem.get(String(item.id)) : null;
    const activeTarget = profile
      ? {
        id: String(profile.id),
        name: profile.name,
        nodes: (nodesByProfile.get(profile.id) || []).map((node) => ({
          dimensionLevel: node.dimension_level,
          weeksUntilSailing: node.weeks_until_sailing,
          lfPct: Number(node.lf_pct) || 0,
        })),
      }
      : null;
    const ref = clean(item?.reference_sail_code) || clean(item?.sail_code) || sailCode;
    const actualLf = actualBySail[sailCode] ?? actualBySail[ref] ?? null;
    const targetLf = endTargetLf(activeTarget);
    const gapPp = actualLf != null && targetLf != null ? round2(actualLf - targetLf) : null;
    return {
      sailCode,
      referenceSailCode: ref,
      inventoryItemId: item?.id != null ? String(item.id) : null,
      status: classifyGap(actualLf, targetLf, { behindPp, aheadPp }),
      actualLfPct: actualLf != null ? round2(actualLf) : null,
      targetLfPct: targetLf,
      gapPp,
      activeTargetId: activeTarget?.id || null,
      activeTargetName: activeTarget?.name || null,
    };
  });
}

export { classifyGap, endTargetLf };
