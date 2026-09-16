/**
 * Backfill suggested target profiles for master sails from a departure date.
 * Skips items that already have a target. Manager+ mutation.
 */

import { getReservationBookingCurve } from './reservation-booking-curve.js';
import { densifyLfSeriesFromCurve } from './profile-compare.js';
import { findSameMonthPriorYearPeer } from './booking-profile-dimensional.js';
import { resolveModelPeer } from './profile-model-map.js';
import {
  getInventoryTargetProfile,
  listInventoryTargetProfiles,
  upsertInventoryTargetProfile,
} from './inventory-target-profile.js';

/** Built-in voyage curve when last year has no profile and REAL has no points. */
export const DEFAULT_TARGET_WAYPOINTS = [
  { weeksUntilSailing: 16, lfPct: 15 },
  { weeksUntilSailing: 8, lfPct: 40 },
  { weeksUntilSailing: 4, lfPct: 62 },
  { weeksUntilSailing: 0, lfPct: 85 },
];

function clean(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function round1(n) {
  return Math.round((Number(n) || 0) * 10) / 10;
}

function sampleWeekWaypoints(series = [], step = 4) {
  const usable = (series || []).filter(
    (p) => p?.lfPct != null && Number.isFinite(Number(p.weeksUntilSailing))
  );
  if (!usable.length) return [];
  const byWeek = new Map();
  usable.forEach((p) => byWeek.set(Number(p.weeksUntilSailing), p));
  const maxW = Math.max(...byWeek.keys());
  const want = new Set([0]);
  if (maxW > 0) want.add(maxW);
  const stride = Math.max(1, Number(step) || 4);
  for (let w = stride; w < maxW; w += stride) want.add(w);

  const lfNear = (week) => {
    if (byWeek.has(week)) return round1(byWeek.get(week).lfPct);
    let best = null;
    let bestDist = Infinity;
    byWeek.forEach((point, w) => {
      const dist = Math.abs(w - week);
      if (dist < bestDist) {
        bestDist = dist;
        best = point;
      }
    });
    return best?.lfPct != null ? round1(best.lfPct) : null;
  };

  return [...want]
    .sort((a, b) => b - a)
    .map((week, idx) => ({
      tempKey: `bf-w${week}`,
      dimensionLevel: 'voyage',
      dimensionKey: 'TOTAL',
      weeksUntilSailing: week,
      weekLabel: week === 0 ? 'Sail' : `W-${week}`,
      lfPct: lfNear(week) ?? 0,
      pointOrder: idx,
    }));
}

async function ensureMasterItem(client, sail) {
  const code = clean(sail.sail_code);
  if (!code) return null;
  const { data: existing } = await client
    .from('inventory_item')
    .select('id, sail_code, ship_code')
    .eq('sail_code', code)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing;

  const { data: inserted, error } = await client
    .from('inventory_item')
    .insert({
      sail_code: code,
      reference_sail_code: code,
      ship_code: clean(sail.ship_code),
      ship_name: clean(sail.ship_name),
      sailing_role: 'master',
      is_operational: true,
      source_table: 'target-profile-backfill',
    })
    .select('id, sail_code, ship_code')
    .single();
  if (error) {
    const { data: retry } = await client
      .from('inventory_item')
      .select('id, sail_code, ship_code')
      .eq('sail_code', code)
      .limit(1)
      .maybeSingle();
    return retry || null;
  }
  return inserted;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function builtinDefaultNodes() {
  return DEFAULT_TARGET_WAYPOINTS.map((point, idx) => ({
    tempKey: `bf-default-w${point.weeksUntilSailing}`,
    dimensionLevel: 'voyage',
    dimensionKey: 'TOTAL',
    weeksUntilSailing: point.weeksUntilSailing,
    weekLabel: point.weeksUntilSailing === 0 ? 'Sail' : `W-${point.weeksUntilSailing}`,
    lfPct: point.lfPct,
    pointOrder: idx,
  }));
}

export function mergeHorizonSails(departures = [], inProgress = [], limit = 500) {
  const cap = Math.min(800, Math.max(1, Number(limit) || 500));
  const seen = new Set();
  const merged = [];
  for (const sail of [...inProgress, ...departures]) {
    const code = clean(sail?.sail_code);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    merged.push(sail);
    if (merged.length >= cap) break;
  }
  return merged;
}

function cloneVoyageNodes(profile) {
  return (profile?.nodes || [])
    .filter((node) => String(node.dimensionLevel || '') === 'voyage')
    .map((node, idx) => ({
      tempKey: `clone-w${node.weeksUntilSailing}-${idx}`,
      dimensionLevel: 'voyage',
      dimensionKey: node.dimensionKey || 'TOTAL',
      weeksUntilSailing: node.weeksUntilSailing,
      weekLabel: node.weekLabel || (Number(node.weeksUntilSailing) === 0 ? 'Sail' : `W-${node.weeksUntilSailing}`),
      lfPct: node.lfPct,
      pointOrder: idx,
    }));
}

async function loadActiveTargetForSail(client, sailCode) {
  const code = clean(sailCode);
  if (!code) return null;
  const { data: item } = await client
    .from('inventory_item')
    .select('id')
    .eq('sail_code', code)
    .limit(1)
    .maybeSingle();
  if (!item?.id) return null;
  const profiles = await listInventoryTargetProfiles(client, item.id);
  return profiles.find((profile) => profile.isActive) || null;
}

async function resolveDefaultPeer(client, sail) {
  const code = clean(sail.sail_code);
  const sameMonth = await findSameMonthPriorYearPeer(client, code, {
    shipCode: sail.ship_code,
    sailDate: sail.sail_date_from,
  });
  if (sameMonth) {
    return { peerSail: sameMonth, peerSource: 'same_month' };
  }
  const fallback = await resolveModelPeer(client, code);
  return {
    peerSail: fallback.modelSailCode || null,
    peerSource: fallback.modelSailCode ? 'near_date' : null,
  };
}

async function loadTemplateProfile(client, templateProfileId) {
  const id = clean(templateProfileId);
  if (!id) return null;
  try {
    return await getInventoryTargetProfile(client, id);
  } catch {
    return null;
  }
}

async function fetchHorizonSails(client, { fromDate, toDate, limit, mainOnly }) {
  const select = 'sail_code, sail_date_from, sail_date_to, ship_code, ship_name, is_main';
  let departuresQuery = client
    .from('master_sail')
    .select(select)
    .order('sail_date_from', { ascending: true })
    .limit(limit);
  if (fromDate) departuresQuery = departuresQuery.gte('sail_date_from', fromDate);
  if (toDate) departuresQuery = departuresQuery.lte('sail_date_from', toDate);
  if (mainOnly) departuresQuery = departuresQuery.eq('is_main', 1);

  let inProgress = [];
  if (fromDate) {
    let inProgressQuery = client
      .from('master_sail')
      .select(select)
      .lt('sail_date_from', fromDate)
      .gte('sail_date_to', fromDate)
      .order('sail_date_from', { ascending: true })
      .limit(limit);
    if (mainOnly) inProgressQuery = inProgressQuery.eq('is_main', 1);
    const inProgressResult = await inProgressQuery;
    if (inProgressResult.error) throw inProgressResult.error;
    inProgress = inProgressResult.data || [];
  }

  const departuresResult = await departuresQuery;
  if (departuresResult.error) throw departuresResult.error;
  return mergeHorizonSails(departuresResult.data || [], inProgress, limit);
}

/**
 * Create default targets for master sails that have none.
 * Prefers an explicit template, then last year's same-month active profile,
 * then the peer REAL curve, then a built-in waypoint curve.
 * @param {string} fromDate YYYY-MM-DD (default today — open / in-progress / future)
 */
export async function backfillTargetProfiles(client, options = {}, editorKey = null) {
  const fromDate = clean(options.fromDate) || todayKey();
  const toDate = clean(options.toDate);
  const dryRun = options.dryRun === true;
  const limit = Math.min(800, Math.max(1, Number(options.limit) || 500));
  const templateProfile = await loadTemplateProfile(client, options.templateProfileId);
  const hasTemplate = Boolean(cloneVoyageNodes(templateProfile).length);

  const fetchSails = (mainOnly) => fetchHorizonSails(client, {
    fromDate,
    toDate,
    limit,
    mainOnly,
  });

  let sails = await fetchSails(true);
  if (!sails.length) sails = await fetchSails(false);

  const considered = sails?.length || 0;
  let created = 0;
  let skippedExisting = 0;
  let skippedNoCurve = 0;
  let failed = 0;
  const sampleSailCodes = [];

  for (const sail of sails || []) {
    const code = clean(sail.sail_code);
    if (!code) continue;
    try {
      const item = await ensureMasterItem(client, sail);
      if (!item?.id) {
        failed += 1;
        continue;
      }

      const { data: existingTargets } = await client
        .from('inventory_target_profile')
        .select('id')
        .eq('inventory_item_id', item.id)
        .limit(1);
      if (existingTargets?.length) {
        skippedExisting += 1;
        continue;
      }

      const peer = hasTemplate
        ? { peerSail: null, peerSource: 'template' }
        : await resolveDefaultPeer(client, sail);
      const peerProfile = !hasTemplate && peer.peerSail
        ? await loadActiveTargetForSail(client, peer.peerSail)
        : null;
      let nodes = hasTemplate ? cloneVoyageNodes(templateProfile) : cloneVoyageNodes(peerProfile);
      let source = hasTemplate ? 'template' : (peerProfile ? 'profile' : null);
      if (!nodes.length) {
        const curveSail = peer.peerSail || code;
        const curve = await getReservationBookingCurve(client, curveSail, {
          marketBreakdown: 'market_group',
          seriesMode: 'market',
          includeCompetitor: false,
        }).catch(() => null);
        nodes = sampleWeekWaypoints(densifyLfSeriesFromCurve(curve), 4);
        source = nodes.length ? 'curve' : null;
      }
      if (!nodes.length) {
        nodes = builtinDefaultNodes();
        source = 'builtin';
      }
      if (!nodes.length) {
        skippedNoCurve += 1;
        continue;
      }

      if (dryRun) {
        created += 1;
        if (sampleSailCodes.length < 8) sampleSailCodes.push(code);
        continue;
      }

      const endLf = nodes.find((n) => n.weeksUntilSailing === 0)?.lfPct
        ?? nodes[nodes.length - 1]?.lfPct;
      const monthKey = String(sail.sail_date_from || '').slice(0, 7);
      const usableName = (name) => (name && !/^Suggested/i.test(name) ? name : null);
      const copiedName = usableName(templateProfile?.name)
        || usableName(peerProfile?.name)
        || (monthKey ? `Default · ${monthKey}` : 'Default target');
      const name = source === 'template' || source === 'profile'
        ? copiedName
        : (peer.peerSail ? `Suggested · ${peer.peerSail}` : 'Default target');
      const description = source === 'template'
        ? `Assigned from ${templateProfile?.name || 'open profile'} · end LF ~${endLf}%`
        : source === 'profile'
          ? `Copied from ${peer.peerSail} (${peer.peerSource || 'peer'}) · end LF ~${endLf}%`
          : source === 'curve' && peer.peerSail
            ? `Default from ${peer.peerSail} booking curve · end LF ~${endLf}%`
            : source === 'builtin'
              ? `Built-in default curve · end LF ~${endLf}%`
              : `Default from REAL · end LF ~${endLf}%`;
      await upsertInventoryTargetProfile(
        client,
        {
          inventoryItemId: String(item.id),
          name,
          perspective: templateProfile?.perspective || peerProfile?.perspective || 'commercial',
          description,
          isActive: true,
          nodes,
        },
        editorKey
      );
      created += 1;
      if (sampleSailCodes.length < 8) sampleSailCodes.push(code);
    } catch (err) {
      console.warn('[profile-backfill]', code, err.message);
      failed += 1;
    }
  }

  return {
    fromDate,
    toDate,
    dryRun,
    considered,
    created,
    skippedExisting,
    skippedNoCurve,
    failed,
    sampleSailCodes,
    message: dryRun
      ? `Dry run: would create ${created} of ${considered} sails from ${fromDate}${toDate ? `–${toDate}` : ''}`
      : `Assigned ${created} defaults (${skippedExisting} already had one, ${failed} failed${skippedNoCurve ? `, ${skippedNoCurve} no curve` : ''}) from ${fromDate}${toDate ? `–${toDate}` : ''}`,
  };
}
