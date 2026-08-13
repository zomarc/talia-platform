/**
 * Backfill suggested target profiles for master sails from a departure date.
 * Skips items that already have a target. Manager+ mutation.
 */

import { getReservationBookingCurve } from './reservation-booking-curve.js';
import { densifyLfSeriesFromCurve } from './profile-compare.js';
import { resolveModelPeer } from './profile-model-map.js';
import { upsertInventoryTargetProfile } from './inventory-target-profile.js';

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

/**
 * @param {string} fromDate YYYY-MM-DD (default 2026-06-01)
 */
export async function backfillTargetProfiles(client, options = {}, editorKey = null) {
  const fromDate = clean(options.fromDate) || '2026-06-01';
  const toDate = clean(options.toDate);
  const dryRun = options.dryRun === true;
  const limit = Math.min(400, Math.max(1, Number(options.limit) || 250));

  const fetchSails = async (mainOnly) => {
    let query = client
      .from('master_sail')
      .select('sail_code, sail_date_from, ship_code, ship_name, is_main')
      .gte('sail_date_from', fromDate)
      .order('sail_date_from', { ascending: true })
      .limit(limit);
    if (toDate) query = query.lte('sail_date_from', toDate);
    if (mainOnly) query = query.eq('is_main', 1);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };

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

      const peer = await resolveModelPeer(client, code);
      const curveSail = peer.modelSailCode || code;
      const curve = await getReservationBookingCurve(client, curveSail, {
        marketBreakdown: 'market_group',
        seriesMode: 'market',
        includeCompetitor: false,
      }).catch(() => null);
      const series = densifyLfSeriesFromCurve(curve);
      const nodes = sampleWeekWaypoints(series, 4);
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
      await upsertInventoryTargetProfile(
        client,
        {
          inventoryItemId: String(item.id),
          name: peer.modelSailCode
            ? `Suggested · ${peer.modelSailCode}`
            : 'Suggested target',
          perspective: 'commercial',
          description: peer.modelSailCode
            ? `Backfill from model prior ${peer.modelSailCode} · end LF ~${endLf}%`
            : `Backfill from REAL · end LF ~${endLf}%`,
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
      ? `Dry run: would create ${created} of ${considered} sails from ${fromDate}`
      : `Created ${created} target profiles (${skippedExisting} already had one) from ${fromDate}`,
  };
}
