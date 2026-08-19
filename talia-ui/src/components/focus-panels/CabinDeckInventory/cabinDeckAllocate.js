/**
 * Local-only GTY → empty cabin allocate preview (concept).
 * Exact category match; no Synapse write-back.
 *
 * Modes:
 * - priority: place all GTY that fit, highest probability first
 * - expected: per category place only ~sum(probability/100) rooms (rounded),
 *   choosing the highest-probability holds first
 */

export const ALLOCATE_MODE = {
  PRIORITY: 'priority',
  EXPECTED: 'expected',
};

const normalizeCategory = (value) => String(value || '').trim() || 'Uncategorized';

const probabilityOf = (item) => {
  const raw = Number(item?.probability);
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(100, raw));
};

/** Highest probability first; stable secondary keys. */
export const sortGtyByProbability = (items) => [...items].sort((a, b) => {
  const prob = probabilityOf(b) - probabilityOf(a);
  if (prob !== 0) return prob;
  const cat = normalizeCategory(a.cabin_category).localeCompare(normalizeCategory(b.cabin_category));
  if (cat !== 0) return cat;
  const owner = String(a.owner_label || '').localeCompare(String(b.owner_label || ''));
  if (owner !== 0) return owner;
  return Number(a.allocation_id || 0) - Number(b.allocation_id || 0);
});

const sortEmptyCabins = (cabins) => [...cabins].sort((a, b) => {
  const deckA = a.deck_number == null ? 999 : Number(a.deck_number);
  const deckB = b.deck_number == null ? 999 : Number(b.deck_number);
  if (deckA !== deckB) return deckA - deckB;
  return String(a.cabin_number || '').localeCompare(String(b.cabin_number || ''), undefined, { numeric: true });
});

const groupByCategory = (items) => {
  const map = new Map();
  items.forEach((item) => {
    const key = normalizeCategory(item.cabin_category);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return map;
};

/**
 * Select which GTY holds to attempt placing for a category.
 * @returns {{ toPlace: any[], deferred: any[], expectedCount: number }}
 */
export const selectGtyHoldsForMode = (holds, mode) => {
  const ranked = sortGtyByProbability(holds || []);
  if (mode !== ALLOCATE_MODE.EXPECTED) {
    return {
      toPlace: ranked,
      deferred: [],
      expectedCount: ranked.length,
    };
  }
  const expectedRaw = ranked.reduce((sum, item) => sum + (probabilityOf(item) / 100), 0);
  const expectedCount = Math.min(ranked.length, Math.max(0, Math.round(expectedRaw)));
  return {
    toPlace: ranked.slice(0, expectedCount),
    deferred: ranked.slice(expectedCount),
    expectedCount,
  };
};

/**
 * @param {{ decks: any[], gtyHolds: { category: string, items: any[] }[] }} bundle
 * @param {{ mode?: 'priority' | 'expected' }} [options]
 */
export const allocateGtyPreview = (bundle, options = {}) => {
  const mode = options.mode === ALLOCATE_MODE.EXPECTED
    ? ALLOCATE_MODE.EXPECTED
    : ALLOCATE_MODE.PRIORITY;
  const sourceDecks = bundle?.decks || [];
  const sourceGty = bundle?.gtyHolds || [];

  const emptiesByCategory = new Map();
  sourceDecks.forEach((deck) => {
    (deck.categories || []).forEach((cat) => {
      const key = normalizeCategory(cat.category);
      if (!emptiesByCategory.has(key)) emptiesByCategory.set(key, []);
      (cat.cabins || []).forEach((cabin) => {
        if (cabin.is_empty && !cabin.is_offsale) emptiesByCategory.get(key).push(cabin);
      });
    });
  });
  emptiesByCategory.forEach((list, key) => {
    emptiesByCategory.set(key, sortEmptyCabins(list));
  });

  const placements = new Map();
  const unplaced = [];
  const overByCategory = new Map();
  const expectedByCategory = new Map();
  let placementCount = 0;

  const holdsByCategory = groupByCategory(
    sourceGty.flatMap((group) => group.items || [])
  );

  [...holdsByCategory.keys()].sort().forEach((key) => {
    const { toPlace, deferred, expectedCount } = selectGtyHoldsForMode(
      holdsByCategory.get(key) || [],
      mode
    );
    expectedByCategory.set(key, expectedCount);
    deferred.forEach((hold) => unplaced.push(hold));

    const pool = emptiesByCategory.get(key) || [];
    toPlace.forEach((hold) => {
      const empty = pool.shift();
      if (!empty) {
        unplaced.push(hold);
        overByCategory.set(key, (overByCategory.get(key) || 0) + 1);
        return;
      }
      const cabinKey = String(empty.cabin_number || '').trim();
      placements.set(cabinKey, {
        ...empty,
        ...hold,
        cabin_number: empty.cabin_number,
        deck_number: empty.deck_number,
        deck_source: empty.deck_source,
        cabin_category: key,
        link_cabin_category: empty.link_cabin_category || key,
        is_empty: false,
        is_gty: true,
        is_gty_fit: true,
        status_key: 'gty-fit',
        status_label: mode === ALLOCATE_MODE.EXPECTED
          ? 'GTY fit (expected)'
          : 'GTY fit (priority)',
        owner_label: hold.owner_label,
        missing_dlgt: Boolean(hold.missing_dlgt),
        probability: hold.probability,
      });
      placementCount += 1;
    });
  });

  const decks = sourceDecks.map((deck) => {
    const categories = (deck.categories || []).map((cat) => {
      const key = normalizeCategory(cat.category);
      const cabins = (cat.cabins || []).map((cabin) => {
        if (!cabin.is_empty) return { ...cabin };
        const placed = placements.get(String(cabin.cabin_number || '').trim());
        return placed ? { ...placed } : { ...cabin };
      });
      return {
        ...cat,
        cabins,
        over_alloc: overByCategory.get(key) || 0,
        empty_count: cabins.filter((c) => c.is_empty).length,
        booked_count: cabins.filter((c) => !c.is_empty).length,
      };
    });
    const emptyCount = categories.reduce((sum, cat) => sum + cat.empty_count, 0);
    return {
      ...deck,
      categories,
      empty_count: emptyCount,
      booked_count: deck.cabin_count - emptyCount,
    };
  });

  const unplacedByCategory = new Map();
  unplaced.forEach((item) => {
    const key = normalizeCategory(item.cabin_category);
    if (!unplacedByCategory.has(key)) unplacedByCategory.set(key, []);
    unplacedByCategory.get(key).push(item);
  });

  return {
    mode,
    decks,
    gtyHolds: [...unplacedByCategory.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, items]) => ({
        category,
        items: sortGtyByProbability(items),
      })),
    placementCount,
    unplacedCount: unplaced.length,
    overAllocCategories: [...overByCategory.keys()].sort(),
    expectedByCategory: Object.fromEntries(expectedByCategory),
  };
};

export default {
  ALLOCATE_MODE,
  sortGtyByProbability,
  selectGtyHoldsForMode,
  allocateGtyPreview,
};
