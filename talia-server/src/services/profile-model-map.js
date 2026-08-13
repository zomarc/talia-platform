/**
 * Editable sail ↔ model (history) profile binding.
 * Lazy default uses findPriorYearPeerSail when no row / match_mode=lazy.
 */

import {
  findPriorYearPeerSail,
  resolveVoyageScope,
} from './booking-profile-dimensional.js';

function clean(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    inventoryItemId: String(row.inventory_item_id),
    modelInventoryItemId:
      row.model_inventory_item_id != null ? String(row.model_inventory_item_id) : null,
    modelSailCode: clean(row.model_sail_code),
    matchMode: row.match_mode || 'lazy',
    notes: row.notes || null,
    confidence: row.confidence != null ? Number(row.confidence) : null,
    matchedDow: row.matched_dow != null ? Number(row.matched_dow) : null,
    matchedDuration: row.matched_duration != null ? Number(row.matched_duration) : null,
    metadata: row.metadata || {},
    lastEditedBy: row.last_edited_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findInventoryItemIdBySail(client, sailCode) {
  const scope = await resolveVoyageScope(client, sailCode);
  return {
    inventoryItemId: scope.inventoryItemId,
    sailCode: scope.requestedSailCode || clean(sailCode),
    referenceSailCode: scope.referenceSailCode,
    shipCode: scope.shipCode,
    shipName: scope.shipName,
    sailDate: scope.sailDate,
  };
}

async function resolveModelItemId(client, modelSailCode) {
  const code = clean(modelSailCode);
  if (!code) return null;
  const scope = await resolveVoyageScope(client, code);
  return scope.inventoryItemId || null;
}

export async function getProfileModelMap(client, inventoryItemId) {
  if (!inventoryItemId) return null;
  const { data, error } = await client
    .from('profile_model_map')
    .select('*')
    .eq('inventory_item_id', inventoryItemId)
    .maybeSingle();
  if (error) {
    console.warn('[profile-model-map] read skipped:', error.message);
    return null;
  }
  return mapRow(data);
}

/**
 * Resolve which history sail to use as the model prior for a current sail.
 * Returns { modelSailCode, matchMode, peerSource, map, inventoryItemId, ... }
 */
export async function resolveModelPeer(client, sailCode) {
  let current;
  try {
    current = await findInventoryItemIdBySail(client, sailCode);
  } catch (err) {
    return {
      inventoryItemId: null,
      sailCode: clean(sailCode),
      referenceSailCode: clean(sailCode),
      shipCode: null,
      shipName: null,
      sailDate: null,
      modelSailCode: null,
      modelInventoryItemId: null,
      matchMode: 'lazy',
      peerSource: null,
      map: null,
      resolveError: err.message,
    };
  }
  const map = current.inventoryItemId
    ? await getProfileModelMap(client, current.inventoryItemId)
    : null;

  if (map?.matchMode === 'manual' && map.modelSailCode) {
    return {
      ...current,
      modelSailCode: map.modelSailCode,
      modelInventoryItemId: map.modelInventoryItemId,
      matchMode: 'manual',
      peerSource: 'manual_map',
      map,
    };
  }

  const lazyPeer = await findPriorYearPeerSail(client, sailCode);
  return {
    ...current,
    modelSailCode: lazyPeer,
    modelInventoryItemId: lazyPeer ? await resolveModelItemId(client, lazyPeer) : null,
    matchMode: map?.matchMode || 'lazy',
    peerSource: lazyPeer ? 'lazy_peer' : null,
    map,
  };
}

/**
 * Upsert mapping. matchMode=lazy clears manual model (or stores lazy with null model).
 * matchMode=manual requires modelSailCode.
 */
export async function upsertProfileModelMap(client, input, editorKey = null) {
  const inventoryItemId = Number(input.inventoryItemId);
  if (!inventoryItemId) throw new Error('inventoryItemId is required');

  const matchMode = input.matchMode === 'manual' ? 'manual' : 'lazy';
  let modelSailCode = clean(input.modelSailCode);
  let modelInventoryItemId = null;

  if (matchMode === 'manual') {
    if (!modelSailCode) throw new Error('modelSailCode is required for manual match');
    try {
      modelInventoryItemId = await resolveModelItemId(client, modelSailCode);
    } catch (err) {
      console.warn('[profile-model-map] model inventory item optional:', err.message);
      modelInventoryItemId = null;
    }
  } else {
    modelSailCode = null;
    modelInventoryItemId = null;
  }

  const payload = {
    inventory_item_id: inventoryItemId,
    model_inventory_item_id: modelInventoryItemId,
    model_sail_code: modelSailCode,
    match_mode: matchMode,
    notes: input.notes || null,
    confidence: input.confidence != null ? Number(input.confidence) : null,
    matched_dow: input.matchedDow != null ? Number(input.matchedDow) : null,
    matched_duration: input.matchedDuration != null ? Number(input.matchedDuration) : null,
    metadata: input.metadata || {},
    last_edited_by: editorKey || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from('profile_model_map')
    .upsert(payload, { onConflict: 'inventory_item_id' })
    .select('*')
    .single();
  if (error) {
    if (error.code === 'PGRST205') {
      throw new Error(
        'profile_model_map is missing. Apply migration 20260812010000_create_profile_model_map.sql and reload PostgREST.'
      );
    }
    throw new Error(error.message || 'Failed to save profile model map');
  }
  return mapRow(data);
}

export async function clearProfileModelMap(client, inventoryItemId) {
  if (!inventoryItemId) return true;
  const { error } = await client
    .from('profile_model_map')
    .delete()
    .eq('inventory_item_id', inventoryItemId);
  if (error) {
    if (error.code === 'PGRST205') {
      throw new Error(
        'profile_model_map is missing. Apply migration 20260812010000_create_profile_model_map.sql and reload PostgREST.'
      );
    }
    throw new Error(error.message || 'Failed to clear profile model map');
  }
  return true;
}

/**
 * Candidate history sails on the same ship for Change model UI.
 * Prefer ±45d around year-1; if that window is empty (short horizon),
 * fall back to earlier same-ship mains before the current sail.
 */
export async function listModelCandidates(client, sailCode, options = {}) {
  const currentCode = clean(sailCode);
  let shipCode = clean(options.shipCode);
  let sailDate = options.sailDate || null;
  try {
    const scope = await resolveVoyageScope(client, sailCode);
    shipCode = shipCode || clean(scope.shipCode);
    sailDate = sailDate || scope.sailDate;
  } catch (err) {
    console.warn('[profile-model-map] candidates scope fallback:', err.message);
  }
  if (!shipCode || !sailDate) {
    const { data: row } = await client
      .from('master_sail')
      .select('sail_code, sail_date_from, ship_code, ship_name')
      .eq('sail_code', currentCode)
      .maybeSingle();
    if (row) {
      shipCode = shipCode || clean(row.ship_code);
      sailDate = sailDate || row.sail_date_from;
    }
  }
  if (!shipCode || !sailDate) return [];

  const windowDays = Number(options.windowDays) > 0 ? Number(options.windowDays) : 45;
  const sail = new Date(sailDate);
  const prior = new Date(sail);
  prior.setFullYear(prior.getFullYear() - 1);
  const yearFrom = new Date(prior);
  yearFrom.setDate(yearFrom.getDate() - windowDays);
  const yearTo = new Date(prior);
  yearTo.setDate(yearTo.getDate() + windowDays);

  const mapRows = (rows) =>
    (rows || [])
      .filter((row) => clean(row.sail_code) && clean(row.sail_code) !== currentCode)
      .map((row) => {
        const d = new Date(row.sail_date_from);
        const dayDiff = Math.round(Math.abs((d - prior) / (1000 * 60 * 60 * 24)));
        return {
          sailCode: clean(row.sail_code),
          sailDate: row.sail_date_from,
          shipCode: clean(row.ship_code),
          shipName: clean(row.ship_name),
          sailDays: row.sail_days != null ? Number(row.sail_days) : null,
          isMain: Boolean(row.is_main),
          packageType: clean(row.package_type),
          dayDiff,
        };
      })
      .sort((a, b) => a.dayDiff - b.dayDiff);

  const selectCols = 'sail_code, sail_date_from, ship_code, ship_name, sail_days, is_main, package_type';
  const { data: yearRows, error: yearError } = await client
    .from('master_sail')
    .select(selectCols)
    .eq('ship_code', shipCode)
    .gte('sail_date_from', yearFrom.toISOString().split('T')[0])
    .lte('sail_date_from', yearTo.toISOString().split('T')[0])
    .order('sail_date_from', { ascending: true })
    .limit(40);
  if (yearError) {
    console.warn('[profile-model-map] year-1 candidates skipped:', yearError.message);
  } else {
    const yearHits = mapRows(yearRows);
    if (yearHits.length) return yearHits;
  }

  const lookback = new Date(sail);
  lookback.setFullYear(lookback.getFullYear() - 2);
  const sailDateKey = String(sailDate).slice(0, 10);
  const { data: priorRows, error: priorError } = await client
    .from('master_sail')
    .select(selectCols)
    .eq('ship_code', shipCode)
    .gte('sail_date_from', lookback.toISOString().split('T')[0])
    .lt('sail_date_from', sailDateKey)
    .order('sail_date_from', { ascending: false })
    .limit(40);
  if (priorError) {
    console.warn('[profile-model-map] lookback candidates skipped:', priorError.message);
  } else {
    const priorHits = mapRows(priorRows);
    if (priorHits.length) return priorHits;
  }

  // Last resort: any other same-ship sailing (short history / first departures).
  const { data: anyRows, error: anyError } = await client
    .from('master_sail')
    .select(selectCols)
    .eq('ship_code', shipCode)
    .order('sail_date_from', { ascending: false })
    .limit(40);
  if (anyError) {
    console.warn('[profile-model-map] same-ship candidates skipped:', anyError.message);
    return [];
  }
  return mapRows(anyRows);
}
