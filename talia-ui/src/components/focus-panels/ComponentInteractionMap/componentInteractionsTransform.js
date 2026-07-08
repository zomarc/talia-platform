/**
 * Component Interaction Map — pure transform.
 *
 * Derives a summary-level view of how panels talk to each other from the
 * component registry's declared event contracts (events.emits / events.respondsTo).
 * We collapse each event's select/clear pair into a single interaction "channel"
 * and keep only channels that are actually wired end-to-end (>=1 emitter AND
 * >=1 listener) — those are the "main interactions".
 *
 * Registry-agnostic on purpose: callers pass the registry object so this stays
 * unit-testable without importing React panel components.
 */

const asArray = (value) => (Array.isArray(value) ? value : []);

/** Canonical selection channels route through inventory_item.reference_sail_code. */
const CANONICAL_KEYS = new Set(['talia:sail', 'talia:ship']);

const CHANNEL_LABELS = {
  'talia:sail': 'Sailing selection',
  'talia:ship': 'Ship selection',
  'talia:reservation': 'Reservation selection',
  'talia:publishedRates': 'Published rates selection',
  'talia:cabin': 'Cabin selection',
  'talia:agency': 'Agency selection',
  'talia:directsource': 'Direct source request',
  'talia:mastervoyage': 'Master voyage selection',
  'talia:voyagereport': 'Voyage report selection',
};

/** Normalize event-name variants (e.g. the legacy dotted `talia.sail.*` alias). */
export const normalizeEventName = (event) => {
  if (!event) return null;
  const text = String(event).trim();
  if (!text) return null;
  return text.replace(/^talia\.sail\./, 'talia:sail.');
};

/** Collapse an event to its channel key by stripping the .select/.clear suffix. */
export const eventChannelKey = (event) => {
  const normalized = normalizeEventName(event);
  if (!normalized) return null;
  return normalized.replace(/\.(select|clear)$/i, '');
};

const humanizeKey = (key) => {
  const tail = String(key).split(':').pop() || key;
  const spaced = tail
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .trim();
  const label = spaced.charAt(0).toUpperCase() + spaced.slice(1);
  return `${label} selection`;
};

const channelLabel = (key) => CHANNEL_LABELS[key] || humanizeKey(key);

/** Human label for a single event name (e.g. 'talia:sail.select' -> 'Sailing selection'). */
export const eventLabel = (event) => channelLabel(eventChannelKey(event));

/**
 * Build the interaction model from a component registry.
 *
 * @param {object} registry - map of name -> metadata ({ title, category, events }).
 * @param {object} [options]
 * @param {boolean} [options.includeUnlinked=false] - keep channels missing an
 *   emitter or a listener (dangling contracts) for diagnostics.
 * @returns {{ channels: Array, summary: object, unlinked: Array }}
 */
export const buildInteractionModel = (registry = {}, options = {}) => {
  const { includeUnlinked = false } = options;
  const entries = Object.entries(registry || {});

  const channels = new Map();

  const ensureChannel = (key) => {
    if (!channels.has(key)) {
      channels.set(key, {
        key,
        label: channelLabel(key),
        canonical: CANONICAL_KEYS.has(key),
        events: new Set(),
        emitters: new Map(),
        listeners: new Map(),
      });
    }
    return channels.get(key);
  };

  const participant = (name, meta) => ({
    name,
    title: meta?.title || name,
    category: meta?.category || 'Other',
  });

  entries.forEach(([name, meta]) => {
    const events = meta?.events || {};
    asArray(events.emits).forEach((event) => {
      const key = eventChannelKey(event);
      if (!key) return;
      const channel = ensureChannel(key);
      channel.events.add(normalizeEventName(event));
      channel.emitters.set(name, participant(name, meta));
    });
    asArray(events.respondsTo).forEach((event) => {
      const key = eventChannelKey(event);
      if (!key) return;
      const channel = ensureChannel(key);
      channel.events.add(normalizeEventName(event));
      channel.listeners.set(name, participant(name, meta));
    });
  });

  const byTitle = (a, b) => a.title.localeCompare(b.title);

  const materialize = (channel) => ({
    key: channel.key,
    label: channel.label,
    canonical: channel.canonical,
    events: Array.from(channel.events).sort(),
    emitters: Array.from(channel.emitters.values()).sort(byTitle),
    listeners: Array.from(channel.listeners.values()).sort(byTitle),
  });

  const all = Array.from(channels.values()).map(materialize);

  const isLinked = (c) => c.emitters.length > 0 && c.listeners.length > 0;
  // Canonical channels (Sailing / Ship) are architecturally central, so we always
  // surface them as long as at least one panel participates — a missing emitter or
  // listener is itself a useful signal (rendered as a gap), not a reason to hide.
  const isMain = (c) => isLinked(c)
    || (c.canonical && (c.emitters.length > 0 || c.listeners.length > 0));

  const linked = all.filter(isMain).map((c) => ({
    ...c,
    incomplete: !isLinked(c),
  })).sort((a, b) => {
    if (a.canonical !== b.canonical) return a.canonical ? -1 : 1;
    const sizeA = a.emitters.length + a.listeners.length;
    const sizeB = b.emitters.length + b.listeners.length;
    if (sizeA !== sizeB) return sizeB - sizeA;
    return a.label.localeCompare(b.label);
  });

  const unlinked = all.filter((c) => !isMain(c)).sort((a, b) => a.label.localeCompare(b.label));

  const participatingNames = new Set();
  linked.forEach((c) => {
    c.emitters.forEach((p) => participatingNames.add(p.name));
    c.listeners.forEach((p) => participatingNames.add(p.name));
  });

  const summary = {
    totalPanels: entries.length,
    mainChannels: linked.length,
    canonicalChannels: linked.filter((c) => c.canonical).length,
    participatingPanels: participatingNames.size,
  };

  return {
    channels: includeUnlinked ? [...linked, ...unlinked] : linked,
    summary,
    unlinked,
  };
};

/**
 * Build a big-picture, presentation-ready model: the canonical story of
 * Physical ↔ inventory_item ↔ Selling, using only the two canonical channels.
 *
 * - Physical side = participants of the Ship channel (berths / ship × day).
 * - Selling side = participants of the Sailing channel that are not physical.
 * On each side we separate "drivers" (panels that emit the selection) from
 * "responders" (panels that react), and summarize responders by category so the
 * slide stays readable when many panels react.
 */
export const buildPresentationModel = (registry = {}) => {
  const { channels } = buildInteractionModel(registry);
  const sail = channels.find((c) => c.key === 'talia:sail')
    || { emitters: [], listeners: [] };
  const ship = channels.find((c) => c.key === 'talia:ship')
    || { emitters: [], listeners: [] };

  const physicalNames = new Set();
  [...(ship.emitters || []), ...(ship.listeners || [])]
    .forEach((p) => physicalNames.add(p.name));

  const byTitle = (a, b) => a.title.localeCompare(b.title);
  const uniqueByName = (list) => {
    const map = new Map();
    (list || []).forEach((p) => { if (!map.has(p.name)) map.set(p.name, p); });
    return Array.from(map.values());
  };

  const categorize = (responders) => {
    const counts = new Map();
    responders.forEach((p) => counts.set(p.category, (counts.get(p.category) || 0) + 1));
    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
  };

  const buildSide = (emitters, listeners, restrict) => {
    const inScope = (p) => (restrict ? restrict(p.name) : true);
    const drivers = uniqueByName((emitters || []).filter(inScope)).sort(byTitle);
    const driverNames = new Set(drivers.map((d) => d.name));
    const responders = uniqueByName((listeners || []).filter(inScope))
      .filter((p) => !driverNames.has(p.name))
      .sort(byTitle);
    return {
      drivers,
      responders,
      responderCount: responders.length,
      responderCategories: categorize(responders),
    };
  };

  // Physical: everything tied to the ship channel (+ any sail participant marked physical).
  const physical = buildSide(
    [...(ship.emitters || [])],
    [...(ship.listeners || []), ...(sail.listeners || []).filter((p) => physicalNames.has(p.name))],
    (name) => physicalNames.has(name),
  );

  // Selling: sail-channel participants that are not physical.
  const selling = buildSide(
    sail.emitters,
    sail.listeners,
    (name) => !physicalNames.has(name),
  );

  return {
    hub: {
      table: 'inventory_item',
      key: 'reference_sail_code',
      note: 'Selections are translated to a canonical scope at emit time',
    },
    physical: {
      title: 'Physical',
      subtitle: 'ships · berths · days',
      filterBy: 'ship_code',
      ...physical,
    },
    selling: {
      title: 'Selling',
      subtitle: 'master sailings · segments · bookings',
      filterBy: 'reference_sail_code / sail_codes',
      ...selling,
    },
  };
};

const CANONICAL_CHANNEL_KEYS = CANONICAL_KEYS;

const uniqueChannels = (events) => {
  const map = new Map();
  asArray(events).forEach((event) => {
    const key = eventChannelKey(event);
    if (!key || map.has(key)) return;
    map.set(key, {
      key,
      label: channelLabel(key),
      canonical: CANONICAL_CHANNEL_KEYS.has(key),
    });
  });
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
};

/**
 * Build a global catalog of every registered component, grouped by category.
 * A birds-eye inventory: each entry carries its event contract (emits / responds)
 * and a few useful flags, so the whole surface area is visible at a glance.
 *
 * @param {object} registry - map of name -> metadata.
 * @returns {{ groups: Array, summary: object }}
 */
export const buildComponentCatalog = (registry = {}) => {
  const entries = Object.entries(registry || {});

  const items = entries.map(([name, meta]) => {
    const events = meta?.events || {};
    const emits = uniqueChannels(events.emits);
    const responds = uniqueChannels(events.responds || events.respondsTo);
    return {
      name,
      title: meta?.title || name,
      category: meta?.category || 'Other',
      description: meta?.description || '',
      panelId: meta?.panelId || null,
      emits,
      responds,
      wired: emits.length > 0 || responds.length > 0,
      canonical: [...emits, ...responds].some((c) => c.canonical),
      flags: {
        mock: Boolean(meta?.usesMockData),
        legacy: Boolean(meta?.legacy),
        refresh: Boolean(meta?.supportsRefresh),
        restricted: Array.isArray(meta?.allowedRoles) && meta.allowedRoles.length > 0,
        roles: Array.isArray(meta?.allowedRoles) ? meta.allowedRoles : [],
      },
    };
  });

  const groupsMap = new Map();
  items.forEach((item) => {
    if (!groupsMap.has(item.category)) groupsMap.set(item.category, []);
    groupsMap.get(item.category).push(item);
  });

  const groups = Array.from(groupsMap.entries())
    .map(([category, list]) => ({
      category,
      count: list.length,
      items: list.slice().sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

  const summary = {
    total: items.length,
    categories: groups.length,
    emitting: items.filter((i) => i.emits.length > 0).length,
    responding: items.filter((i) => i.responds.length > 0).length,
    canonical: items.filter((i) => i.canonical).length,
    isolated: items.filter((i) => !i.wired).length,
    mock: items.filter((i) => i.flags.mock).length,
    legacy: items.filter((i) => i.flags.legacy).length,
  };

  return { groups, summary };
};

export default buildInteractionModel;
