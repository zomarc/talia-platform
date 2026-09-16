/**
 * Multi-perspective nested load-factor target profiles per inventory item.
 */

const TALIA_SYSTEM_OWNER_KEY = 'talia';
const TALIA_INTEL_PROFILE_SCOPE = 'system';

function mapNode(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    profileId: String(row.profile_id),
    dimensionLevel: row.dimension_level,
    dimensionKey: row.dimension_key,
    parentNodeId: row.parent_node_id != null ? String(row.parent_node_id) : null,
    weekLabel: row.week_label,
    weeksUntilSailing: row.weeks_until_sailing,
    lfPct: Number(row.lf_pct) || 0,
    pointOrder: row.point_order || 0,
    metadata: row.metadata || {},
  };
}

function mapProfile(row, nodes = []) {
  return {
    id: String(row.id),
    inventoryItemId: row.inventory_item_id != null ? String(row.inventory_item_id) : null,
    name: row.name,
    perspective: row.perspective,
    description: row.description,
    metric: row.metric,
    profileScope: row.profile_scope,
    ownerKey: row.owner_key,
    lastEditedBy: row.last_edited_by,
    isActive: Boolean(row.is_active),
    isLibrary: row.inventory_item_id == null || String(row.profile_scope || '') === 'global',
    nodes: nodes.map(mapNode),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Named templates the editor can assign — not Suggested/Default auto-fills. */
export function isReusableTargetProfileName(name) {
  const text = String(name || '').trim();
  if (!text) return false;
  return !/^(suggested|default)\b/i.test(text);
}

export function isLibraryProfileInput(input = {}) {
  if (input.asLibrary === true || input.profileScope === 'global') return true;
  const itemId = input.inventoryItemId;
  return itemId == null || itemId === '' || itemId === 'null';
}

/** Reuse the sailing's active row when assigning, so we never insert a second active. */
export function resolveSailingUpsertId(existingProfiles = [], requestedId, { isLibrarySource = false } = {}) {
  if (requestedId && !isLibrarySource) return String(requestedId);
  const active = existingProfiles.find((profile) => profile.isActive) || existingProfiles[0];
  return active?.id ? String(active.id) : null;
}

/**
 * True library / standard profiles (not sailing assignments).
 */
export async function listInventoryTargetProfileLibrary(client) {
  const { data: rows, error } = await client
    .from('inventory_target_profile')
    .select('id, name, updated_at')
    .is('inventory_item_id', null)
    .order('name', { ascending: true });
  if (error) throw error;
  if (!rows?.length) return [];
  const profiles = [];
  for (const row of rows) {
    profiles.push(await getInventoryTargetProfile(client, row.id));
  }
  return profiles;
}

export async function listInventoryTargetProfiles(client, inventoryItemId) {
  const { data: profiles, error } = await client
    .from('inventory_target_profile')
    .select('*')
    .eq('inventory_item_id', inventoryItemId)
    .order('perspective', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  if (!profiles?.length) return [];

  const ids = profiles.map((p) => p.id);
  const { data: nodes, error: nodeError } = await client
    .from('inventory_target_profile_node')
    .select('*')
    .in('profile_id', ids)
    .order('point_order', { ascending: true });

  if (nodeError) throw nodeError;

  const byProfile = new Map();
  (nodes || []).forEach((n) => {
    const list = byProfile.get(n.profile_id) || [];
    list.push(n);
    byProfile.set(n.profile_id, list);
  });

  return profiles.map((p) => mapProfile(p, byProfile.get(p.id) || []));
}

export async function getInventoryTargetProfile(client, id) {
  const { data: profile, error } = await client
    .from('inventory_target_profile')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;

  const { data: nodes, error: nodeError } = await client
    .from('inventory_target_profile_node')
    .select('*')
    .eq('profile_id', id)
    .order('point_order', { ascending: true });
  if (nodeError) throw nodeError;

  return mapProfile(profile, nodes || []);
}

/**
 * Upsert profile header + replace nodes.
 * Nodes may reference parents via parentTempKey / tempKey for tree insert order.
 */
export async function upsertInventoryTargetProfile(client, input, editorKey = null) {
  const asLibrary = isLibraryProfileInput(input);
  const inventoryItemId = asLibrary ? null : Number(input.inventoryItemId);
  if (!asLibrary && !inventoryItemId) {
    throw new Error('inventoryItemId is required unless saving a library profile');
  }

  let upsertId = input.id ? String(input.id) : null;
  if (!asLibrary) {
    const existing = await listInventoryTargetProfiles(client, inventoryItemId);
    const sourceIsLibrary = Boolean(input.sourceIsLibrary);
    upsertId = resolveSailingUpsertId(existing, upsertId, { isLibrarySource: sourceIsLibrary || !upsertId });
  }

  const wantActive = asLibrary ? false : input.isActive !== false;
  const payload = {
    inventory_item_id: inventoryItemId,
    name: String(input.name || '').trim() || (asLibrary ? 'Standard' : 'Target'),
    perspective: input.perspective || 'commercial',
    description: input.description || null,
    metric: 'load_factor',
    profile_scope: asLibrary ? 'global' : (TALIA_INTEL_PROFILE_SCOPE || 'system'),
    owner_key: TALIA_SYSTEM_OWNER_KEY || 'talia',
    last_edited_by: editorKey || null,
    updated_at: new Date().toISOString(),
    is_active: false,
  };

  if (wantActive && inventoryItemId) {
    await client
      .from('inventory_target_profile')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('inventory_item_id', inventoryItemId);
  }

  let profileRow;
  if (upsertId) {
    const { data, error } = await client
      .from('inventory_target_profile')
      .update(payload)
      .eq('id', upsertId)
      .select('*')
      .single();
    if (error) throw error;
    profileRow = data;

    const { error: delError } = await client
      .from('inventory_target_profile_node')
      .delete()
      .eq('profile_id', profileRow.id);
    if (delError) throw delError;
  } else {
    const { data, error } = await client
      .from('inventory_target_profile')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    profileRow = data;
  }

  if (wantActive && profileRow?.id && inventoryItemId) {
    const { error: activeError } = await client
      .from('inventory_target_profile')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', profileRow.id);
    if (activeError) throw activeError;
  }

  const nodes = Array.isArray(input.nodes) ? input.nodes : [];
  const tempToId = new Map();

  // Insert parents before children by repeating passes
  const remaining = [...nodes];
  let guard = 0;
  while (remaining.length && guard < 20) {
    guard += 1;
    const nextRound = [];
    for (const node of remaining) {
      const parentTemp = node.parentTempKey || null;
      if (parentTemp && !tempToId.has(parentTemp)) {
        nextRound.push(node);
        continue;
      }
      const parentNodeId = parentTemp ? tempToId.get(parentTemp) : null;
      const { data: inserted, error } = await client
        .from('inventory_target_profile_node')
        .insert({
          profile_id: profileRow.id,
          dimension_level: node.dimensionLevel,
          dimension_key: node.dimensionKey,
          parent_node_id: parentNodeId,
          week_label: node.weekLabel || null,
          weeks_until_sailing: node.weeksUntilSailing ?? null,
          lf_pct: node.lfPct ?? 0,
          point_order: node.pointOrder ?? 0,
          metadata: node.metadata || {},
        })
        .select('*')
        .single();
      if (error) throw error;
      if (node.tempKey) tempToId.set(node.tempKey, inserted.id);
    }
    if (nextRound.length === remaining.length) {
      // Cycle / missing parent — insert rest without parent
      for (const node of nextRound) {
        const { data: inserted, error } = await client
          .from('inventory_target_profile_node')
          .insert({
            profile_id: profileRow.id,
            dimension_level: node.dimensionLevel,
            dimension_key: node.dimensionKey,
            parent_node_id: null,
            week_label: node.weekLabel || null,
            weeks_until_sailing: node.weeksUntilSailing ?? null,
            lf_pct: node.lfPct ?? 0,
            point_order: node.pointOrder ?? 0,
            metadata: node.metadata || {},
          })
          .select('*')
          .single();
        if (error) throw error;
        if (node.tempKey) tempToId.set(node.tempKey, inserted.id);
      }
      break;
    }
    remaining.length = 0;
    remaining.push(...nextRound);
  }

  return getInventoryTargetProfile(client, profileRow.id);
}

export async function deleteInventoryTargetProfile(client, id) {
  const { error } = await client.from('inventory_target_profile').delete().eq('id', id);
  if (error) throw error;
  return true;
}

/** Activate one target profile for its inventory item (clears other actives). */
export async function setActiveInventoryTargetProfile(client, id, editorKey = null) {
  const profile = await getInventoryTargetProfile(client, id);
  if (!profile) throw new Error('Target profile not found');
  if (profile.isLibrary || !profile.inventoryItemId) {
    throw new Error('Assign a library profile to a sailing instead of activating it');
  }
  const inventoryItemId = Number(profile.inventoryItemId);

  await client
    .from('inventory_target_profile')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('inventory_item_id', inventoryItemId);

  const { error } = await client
    .from('inventory_target_profile')
    .update({
      is_active: true,
      last_edited_by: editorKey || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;

  return getInventoryTargetProfile(client, id);
}
