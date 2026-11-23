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

const dayKey = (value: unknown) => {
  if (!value) return null;
  const text = String(value);
  return text.length >= 10 ? text.slice(0, 10) : text;
};

const weeksUntil = (sailDate: string | null, asOf: Date) => {
  if (!sailDate) return null;
  const sail = new Date(`${sailDate}T12:00:00Z`);
  const ms = sail.getTime() - asOf.getTime();
  return Math.round(ms / (7 * 24 * 3600 * 1000));
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

export type ScienceSailRow = {
  sail_code: string;
  ship_code: string | null;
  ship_name: string | null;
  sail_date_from: string | null;
  horizon: 'historic' | 'forward_now';
  weeks_until_sailing: number | null;
  occupied_cabins: number;
  total_cabins: number;
  load_factor: number;
  end_lf: number;
  observed_lf: number;
  yield_per_guest: number | null;
  group_share: number | null;
  manual_peer_sail_code: string | null;
  group_requested?: number | null;
  group_reserved?: number | null;
  talia_mr?: number | null;
};

export type ScienceWorldPayload = {
  as_of: string;
  scope: Record<string, unknown>;
  historic: ScienceSailRow[];
  subjects: ScienceSailRow[];
  role: 'advisory';
};

export async function loadScienceWorld(options: {
  sailCodes?: string[];
  shipCode?: string;
  asOf?: Date;
  historicLimit?: number;
  forwardLimit?: number;
} = {}): Promise<ScienceWorldPayload> {
  const asOf = options.asOf || new Date();
  const today = asOf.toISOString().slice(0, 10);
  // Keep defaults modest — occupancy rows explode per sail×night×cabin.
  const historicLimit = Math.min(Math.max(options.historicLimit || 24, 1), 80);
  const forwardLimit = Math.min(Math.max(options.forwardLimit || 8, 1), 24);
  const requested = (options.sailCodes || []).map((c) => String(c || '').trim()).filter(Boolean);

  let historicQuery = getClient()
    .from('master_sail')
    .select('sail_code, ship_code, ship_name, sail_date_from, is_main, is_primary')
    .not('sail_code', 'is', null)
    .lt('sail_date_from', today)
    .order('sail_date_from', { ascending: false })
    .limit(historicLimit);

  let forwardQuery = getClient()
    .from('master_sail')
    .select('sail_code, ship_code, ship_name, sail_date_from, is_main, is_primary')
    .not('sail_code', 'is', null)
    .gte('sail_date_from', today)
    .order('sail_date_from', { ascending: true })
    .limit(forwardLimit);

  if (options.shipCode) {
    historicQuery = historicQuery.eq('ship_code', options.shipCode);
    forwardQuery = forwardQuery.eq('ship_code', options.shipCode);
  }
  if (requested.length) {
    // Still load a peerset pool for the same ships as requested sails
    forwardQuery = forwardQuery.in('sail_code', requested);
  }

  const [{ data: historicRows, error: hErr }, { data: forwardRows, error: fErr }] = await Promise.all([
    historicQuery,
    forwardQuery,
  ]);
  if (hErr) throw new Error(`master_sail historic: ${hErr.message}`);
  if (fErr) throw new Error(`master_sail forward: ${fErr.message}`);

  const allSailRows = [...(historicRows || []), ...(forwardRows || [])];
  const sailCodes = [...new Set(allSailRows.map((r: any) => String(r.sail_code)).filter(Boolean))];

  const occBySail: Record<string, { occupied: number; total: number }> = {};
  if (sailCodes.length) {
    // Cap hard: we only need one representative night per sail for end LF.
    const occRows = await selectAll(
      'sail_by_cabin_occupancy',
      'sail_code, occupied_cabins, total_cabins, sail_itinerary_date, sail_date_from',
      (q) => q.in('sail_code', sailCodes).order('sail_itinerary_date', { ascending: true }),
      8000
    );
    const nightBySail = new Map<string, string>();
    for (const row of occRows) {
      const sailCode = String(row.sail_code || '');
      const date = dayKey(row.sail_itinerary_date) || dayKey(row.sail_date_from);
      if (!sailCode || !date) continue;
      const current = nightBySail.get(sailCode);
      if (!current || date < current) nightBySail.set(sailCode, date);
    }
    for (const row of occRows) {
      const sailCode = String(row.sail_code || '');
      const date = dayKey(row.sail_itinerary_date) || dayKey(row.sail_date_from);
      if (!sailCode || date !== nightBySail.get(sailCode)) continue;
      const cur = occBySail[sailCode] || { occupied: 0, total: 0 };
      cur.occupied += Number(row.occupied_cabins) || 0;
      cur.total += Number(row.total_cabins) || 0;
      occBySail[sailCode] = cur;
    }
  }

  // Optional manual peer from profile_model_map via inventory_item
  const manualPeerBySail = new Map<string, string>();
  if (sailCodes.length) {
    const { data: items } = await getClient()
      .from('inventory_item')
      .select('id, sail_code')
      .in('sail_code', sailCodes);
    const itemIds = (items || []).map((r: any) => r.id).filter(Boolean);
    const itemToSail = new Map((items || []).map((r: any) => [r.id, String(r.sail_code)]));
    if (itemIds.length) {
      const { data: maps } = await getClient()
        .from('profile_model_map')
        .select('inventory_item_id, model_sail_code')
        .in('inventory_item_id', itemIds);
      for (const row of maps || []) {
        const sail = itemToSail.get(row.inventory_item_id);
        const peer = row.model_sail_code;
        if (sail && peer) manualPeerBySail.set(sail, String(peer));
      }
    }
  }

  const toRow = (row: any, horizon: 'historic' | 'forward_now'): ScienceSailRow => {
    const sail_code = String(row.sail_code);
    const sail_date_from = dayKey(row.sail_date_from);
    const occ = occBySail[sail_code] || { occupied: 0, total: 0 };
    const lf = occ.total > 0 ? occ.occupied / occ.total : 0;
    return {
      sail_code,
      ship_code: row.ship_code || null,
      ship_name: row.ship_name || null,
      sail_date_from,
      horizon,
      weeks_until_sailing: weeksUntil(sail_date_from, asOf),
      occupied_cabins: occ.occupied,
      total_cabins: occ.total,
      load_factor: lf,
      end_lf: lf,
      observed_lf: lf,
      yield_per_guest: null,
      group_share: null,
      manual_peer_sail_code: manualPeerBySail.get(sail_code) || null,
    };
  };

  const historic = (historicRows || []).map((r: any) => toRow(r, 'historic'));
  let forward = (forwardRows || []).map((r: any) => toRow(r, 'forward_now'));
  if (requested.length) {
    forward = forward.filter((r) => requested.includes(r.sail_code));
  }

  // Subjects: up to 5 historic proof sails + all requested/forward (capped)
  const historicSubjects = historic.slice(0, 5);
  const forwardSubjects = forward.slice(0, forwardLimit);
  const subjects = [...historicSubjects, ...forwardSubjects];

  const ships = [...new Set(subjects.map((s) => s.ship_code).filter(Boolean))];
  return {
    as_of: asOf.toISOString(),
    scope: {
      type: options.shipCode ? 'ship' : 'fleet_sample',
      ship_code: options.shipCode || (ships.length === 1 ? ships[0] : null),
      label: 'driver_analysis_show',
    },
    historic,
    subjects,
    role: 'advisory',
  };
}
