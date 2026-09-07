import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const PAGE = 1000;

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

async function selectAll(table: string, columns: string, apply: (q: any) => any, cap = 20000) {
  const rows: any[] = [];
  let from = 0;
  while (from < cap) {
    const to = Math.min(from + PAGE - 1, cap - 1);
    let query = getClient().from(table).select(columns).range(from, to);
    query = apply(query);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

const dayKey = (value: unknown) => {
  if (!value) return null;
  const text = String(value);
  return text.length >= 10 ? text.slice(0, 10) : text;
};

export type WorldStateView = {
  sails: Array<{
    sail_code: string;
    ship_code: string | null;
    ship_name: string | null;
    sail_date_from: string | null;
  }>;
  occupancyBySail: Record<string, { load_factor: number; occupied_cabins: number; total_cabins: number }>;
  targetsBySail: Record<string, { name: string; points: Array<{ weeks_until_sailing: number; lf_pct: number }> }>;
};

export async function loadWorldState(options: {
  sailCodes?: string[];
  asOf?: Date;
  limit?: number;
} = {}): Promise<WorldStateView> {
  const asOf = options.asOf || new Date();
  const today = asOf.toISOString().slice(0, 10);
  const limit = Math.min(Math.max(options.limit || 40, 1), 200);
  const requested = (options.sailCodes || []).map((code) => String(code || '').trim()).filter(Boolean);

  let sailQuery = getClient()
    .from('master_sail')
    .select('sail_code, ship_code, ship_name, sail_date_from, is_main, is_primary')
    .not('sail_code', 'is', null)
    .order('sail_date_from', { ascending: true })
    .limit(limit);

  if (requested.length) {
    sailQuery = sailQuery.in('sail_code', requested);
  } else {
    sailQuery = sailQuery.gte('sail_date_from', today);
  }

  const { data: sailRows, error: sailError } = await sailQuery;
  if (sailError) throw new Error(`master_sail: ${sailError.message}`);

  const sails = (sailRows || [])
    .filter((row: any) => row.sail_code)
    .map((row: any) => ({
      sail_code: String(row.sail_code),
      ship_code: row.ship_code || null,
      ship_name: row.ship_name || null,
      sail_date_from: dayKey(row.sail_date_from),
    }));

  const sailCodes = [...new Set(sails.map((row) => row.sail_code))];
  if (!sailCodes.length) {
    return { sails: [], occupancyBySail: {}, targetsBySail: {} };
  }

  const occRows = await selectAll(
    'sail_by_cabin_occupancy',
    'sail_code, occupied_cabins, total_cabins, sail_itinerary_date, sail_date_from',
    (q) => q.in('sail_code', sailCodes),
    40000
  );

  const nightBySail = new Map<string, string>();
  for (const row of occRows) {
    const sailCode = String(row.sail_code || '');
    const date = dayKey(row.sail_itinerary_date) || dayKey(row.sail_date_from);
    if (!sailCode || !date) continue;
    const current = nightBySail.get(sailCode);
    if (!current || date < current) nightBySail.set(sailCode, date);
  }

  const occupancyBySail: WorldStateView['occupancyBySail'] = {};
  for (const row of occRows) {
    const sailCode = String(row.sail_code || '');
    const date = dayKey(row.sail_itinerary_date) || dayKey(row.sail_date_from);
    if (!sailCode || date !== nightBySail.get(sailCode)) continue;
    const current = occupancyBySail[sailCode] || { load_factor: 0, occupied_cabins: 0, total_cabins: 0 };
    current.occupied_cabins += Number(row.occupied_cabins) || 0;
    current.total_cabins += Number(row.total_cabins) || 0;
    current.load_factor = current.total_cabins > 0
      ? current.occupied_cabins / current.total_cabins
      : 0;
    occupancyBySail[sailCode] = current;
  }

  const { data: items, error: itemError } = await getClient()
    .from('inventory_item')
    .select('id, sail_code')
    .in('sail_code', sailCodes);
  if (itemError) throw new Error(`inventory_item: ${itemError.message}`);

  const itemIds = (items || []).map((row: any) => row.id).filter(Boolean);
  const itemSail = new Map((items || []).map((row: any) => [row.id, String(row.sail_code)]));
  const targetsBySail: WorldStateView['targetsBySail'] = {};

  if (itemIds.length) {
    const { data: profiles, error: profileError } = await getClient()
      .from('inventory_target_profile')
      .select('id, inventory_item_id, name, perspective')
      .in('inventory_item_id', itemIds);
    if (profileError) throw new Error(`inventory_target_profile: ${profileError.message}`);

    const preferred = new Map<number, any>();
    for (const profile of profiles || []) {
      const current = preferred.get(profile.inventory_item_id);
      if (!current || profile.perspective === 'commercial') {
        preferred.set(profile.inventory_item_id, profile);
      }
    }
    const profileList = [...preferred.values()];
    const profileIds = profileList.map((row) => row.id);
    if (profileIds.length) {
      const { data: nodes, error: nodeError } = await getClient()
        .from('inventory_target_profile_node')
        .select('profile_id, dimension_level, weeks_until_sailing, lf_pct')
        .in('profile_id', profileIds)
        .eq('dimension_level', 'voyage');
      if (nodeError) throw new Error(`inventory_target_profile_node: ${nodeError.message}`);

      const nodesByProfile = new Map<number, Array<{ weeks_until_sailing: number; lf_pct: number }>>();
      for (const node of nodes || []) {
        const list = nodesByProfile.get(node.profile_id) || [];
        list.push({
          weeks_until_sailing: Number(node.weeks_until_sailing) || 0,
          lf_pct: Number(node.lf_pct) || 0,
        });
        nodesByProfile.set(node.profile_id, list);
      }

      for (const profile of profileList) {
        const sailCode = itemSail.get(profile.inventory_item_id);
        const points = nodesByProfile.get(profile.id) || [];
        if (!sailCode || !points.length) continue;
        targetsBySail[sailCode] = { name: profile.name, points };
      }
    }
  }

  return { sails, occupancyBySail, targetsBySail };
}
