/**
 * Read-only multi-level profile aggregations (ship × month, DOW × duration).
 * Lightweight: inventory_item + master_sail + active targets + model maps — no full curves.
 */

function clean(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function toDateKey(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function dowLabel(dateKey) {
  if (!dateKey) return 'Unknown';
  const d = new Date(`${dateKey}T00:00:00Z`);
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return names[d.getUTCDay()] || 'Unknown';
}

function durationBucket(days) {
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) return 'Unknown';
  if (n <= 3) return '1-3d';
  if (n <= 7) return '4-7d';
  if (n <= 10) return '8-10d';
  if (n <= 14) return '11-14d';
  return '15d+';
}

/**
 * @param {'ship_month'|'dow_duration'} groupBy
 */
export async function getProfileAggregations(client, options = {}) {
  const groupBy = options.groupBy === 'dow_duration' ? 'dow_duration' : 'ship_month';
  const shipCode = clean(options.shipCode);
  const monthFrom = clean(options.monthFrom);
  const monthTo = clean(options.monthTo);

  let query = client
    .from('inventory_item')
    .select('id, sail_code, ship_code, ship_name, reference_sail_code, sailing_role, is_operational')
    .eq('is_operational', true)
    .eq('sailing_role', 'master');

  if (shipCode) query = query.eq('ship_code', shipCode);

  const { data: items, error } = await query.limit(2000);
  if (error) throw error;
  if (!items?.length) {
    return { groupBy, rows: [], message: 'No master inventory items' };
  }

  const sailCodes = items.map((i) => clean(i.sail_code)).filter(Boolean);
  const itemIds = items.map((i) => i.id);

  const sailMeta = new Map();
  for (let i = 0; i < sailCodes.length; i += 80) {
    const batch = sailCodes.slice(i, i + 80);
    const { data: sails } = await client
      .from('master_sail')
      .select('sail_code, sail_date_from, sail_days, ship_code, ship_name')
      .in('sail_code', batch);
    (sails || []).forEach((s) => {
      sailMeta.set(clean(s.sail_code), s);
    });
  }

  const { data: maps, error: mapError } = await client
    .from('profile_model_map')
    .select('inventory_item_id, match_mode, model_sail_code')
    .in('inventory_item_id', itemIds);
  if (mapError) {
    console.warn('[profile-aggregations] model map skipped:', mapError.message);
  }

  const mapByItem = new Map();
  (maps || []).forEach((m) => mapByItem.set(m.inventory_item_id, m));

  const { data: targets } = await client
    .from('inventory_target_profile')
    .select('id, inventory_item_id, name, is_active')
    .in('inventory_item_id', itemIds)
    .eq('is_active', true);

  const targetByItem = new Map();
  (targets || []).forEach((t) => targetByItem.set(t.inventory_item_id, t));

  const buckets = new Map();

  items.forEach((item) => {
    const sailCode = clean(item.sail_code);
    const meta = sailMeta.get(sailCode) || sailMeta.get(clean(item.reference_sail_code));
    const sailDate = toDateKey(meta?.sail_date_from);
    const month = sailDate ? sailDate.slice(0, 7) : null;
    if (monthFrom && month && month < monthFrom) return;
    if (monthTo && month && month > monthTo) return;

    const ship = clean(item.ship_code) || clean(meta?.ship_code) || 'Unknown';
    const shipName = clean(item.ship_name) || clean(meta?.ship_name) || ship;
    const dow = dowLabel(sailDate);
    const dur = durationBucket(meta?.sail_days);

    let key;
    let dimensionKey;
    let dimensionLabel;
    if (groupBy === 'dow_duration') {
      key = `${dow}|${dur}`;
      dimensionKey = key;
      dimensionLabel = `${dow} · ${dur}`;
    } else {
      key = `${ship}|${month || 'Unknown'}`;
      dimensionKey = key;
      dimensionLabel = `${shipName} · ${month || 'Unknown'}`;
    }

    const cur = buckets.get(key) || {
      dimensionKey,
      dimensionLabel,
      shipCode: ship,
      shipName,
      month,
      dow,
      durationBucket: dur,
      sailCount: 0,
      withActiveTarget: 0,
      withManualModel: 0,
      withLazyModel: 0,
      sailCodes: [],
    };
    cur.sailCount += 1;
    if (targetByItem.has(item.id)) cur.withActiveTarget += 1;
    const map = mapByItem.get(item.id);
    if (map?.match_mode === 'manual') cur.withManualModel += 1;
    else cur.withLazyModel += 1;
    if (cur.sailCodes.length < 8) cur.sailCodes.push(sailCode);
    buckets.set(key, cur);
  });

  const rows = [...buckets.values()].sort((a, b) =>
    String(a.dimensionLabel).localeCompare(String(b.dimensionLabel))
  );

  return {
    groupBy,
    rows,
    message: null,
  };
}
