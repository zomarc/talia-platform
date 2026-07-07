/**
 * Canonical component-to-component linking via inventory_item.
 *
 * Talia's inventory_item is the source-independent canonical layer. Every panel
 * selection (sail.select, ship.select, etc.) should resolve to a canonical scope
 * through `inventory_item.reference_sail_code` rather than ad-hoc sail_code/ship_code
 * matching. A master voyage and all of its segments share one reference_sail_code
 * and one ship_code, so resolving through the reference gives every consumer the
 * full physical + selling scope of a selection.
 */

const asArray = (value) => (Array.isArray(value) ? value : []);

const clean = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
};

/** Pull the canonical reference_sail_code from a selection event detail. */
export const resolveReferenceSailCode = (detail) => {
  if (!detail) return null;
  if (typeof detail === 'string') return clean(detail);
  const row = detail.row_data || {};
  return clean(
    detail.reference_sail_code
    || detail.referenceSailCode
    || row.reference_sail_code
    || row.referenceSailCode
    || detail.sail_code
    || detail.Sail_Code
    || row.sail_code
    || row.Sail_Code
  );
};

/** Pull a plain sail_code (not the reference) from a selection event detail. */
export const resolveSailCode = (detail) => {
  if (!detail) return null;
  if (typeof detail === 'string') return clean(detail);
  const row = detail.row_data || {};
  return clean(
    detail.sail_code
    || detail.Sail_Code
    || row.sail_code
    || row.Sail_Code
  );
};

/** Pull a ship_code from a selection event detail. */
export const resolveShipCode = (detail) => {
  if (!detail || typeof detail === 'string') return null;
  const row = detail.row_data || {};
  return clean(
    detail.ship_code
    || detail.Ship_Code
    || row.ship_code
    || row.Ship_Code
  );
};

const resolveSegmentSailCodes = (detail) => {
  if (!detail || typeof detail === 'string') return [];
  const row = detail.row_data || {};
  const candidates = detail.segment_sail_codes
    || detail.segmentSailCodes
    || row.segment_sail_codes
    || row.segment_codes
    || [];
  return asArray(candidates).map(clean).filter(Boolean);
};

/**
 * Build a canonical index from inventory_item rows.
 * - byReference: reference_sail_code -> { ship_code, ship_name, sail_codes[], roles[] }
 * - referenceBySailCode: any sail_code -> its reference_sail_code
 */
export const buildInventoryReferenceIndex = (inventoryItems = []) => {
  const byReference = new Map();
  const referenceBySailCode = new Map();

  asArray(inventoryItems).forEach((item) => {
    const sailCode = clean(item?.sail_code);
    const shipCode = clean(item?.ship_code);
    const shipName = clean(item?.ship_name);
    const role = clean(item?.sailing_role);
    const reference = clean(item?.reference_sail_code) || sailCode;
    if (!reference) return;

    if (sailCode) referenceBySailCode.set(sailCode, reference);

    const entry = byReference.get(reference) || {
      reference_sail_code: reference,
      ship_code: shipCode,
      ship_name: shipName,
      sail_codes: new Set(),
      roles: new Set(),
    };
    if (sailCode) entry.sail_codes.add(sailCode);
    if (role) entry.roles.add(role);
    if (!entry.ship_code && shipCode) entry.ship_code = shipCode;
    if (!entry.ship_name && shipName) entry.ship_name = shipName;
    byReference.set(reference, entry);
  });

  return { byReference, referenceBySailCode };
};

const finalizeEntry = (entry, detail) => {
  const sailCodes = new Set(entry.sail_codes ? Array.from(entry.sail_codes) : []);
  resolveSegmentSailCodes(detail).forEach((code) => sailCodes.add(code));
  const selfSail = resolveSailCode(detail);
  if (selfSail) sailCodes.add(selfSail);
  return {
    reference_sail_code: entry.reference_sail_code,
    ship_code: entry.ship_code || resolveShipCode(detail) || null,
    ship_name: entry.ship_name || clean(detail?.ship_name) || null,
    sail_codes: Array.from(sailCodes).sort(),
    roles: entry.roles ? Array.from(entry.roles).sort() : [],
    source: 'inventory_reference',
  };
};

/**
 * Resolve a selection event detail to a canonical scope using the inventory index.
 * Falls back gracefully when the selection is not (yet) mapped in inventory_item.
 */
export const resolveSelectionScope = (detail, index = null) => {
  if (!detail) return null;
  const byReference = index?.byReference || null;
  const referenceBySailCode = index?.referenceBySailCode || null;

  let reference = resolveReferenceSailCode(detail);

  // If the reference we found is actually a segment sail_code, hop to its master reference.
  if (reference && referenceBySailCode?.has(reference) && !byReference?.has(reference)) {
    reference = referenceBySailCode.get(reference);
  }
  // Or if a plain sail_code maps to a known reference, use that.
  if ((!reference || !byReference?.has(reference))) {
    const sailCode = resolveSailCode(detail);
    if (sailCode && referenceBySailCode?.has(sailCode)) {
      reference = referenceBySailCode.get(sailCode);
    }
  }

  if (reference && byReference?.has(reference)) {
    return finalizeEntry(byReference.get(reference), detail);
  }

  // Fallback 1: direct ship selection with no inventory match yet.
  const shipCode = resolveShipCode(detail);
  if (shipCode) {
    return {
      reference_sail_code: reference || null,
      ship_code: shipCode,
      ship_name: clean(detail?.ship_name) || null,
      sail_codes: Array.from(new Set([
        ...resolveSegmentSailCodes(detail),
        ...(resolveSailCode(detail) ? [resolveSailCode(detail)] : []),
      ])).sort(),
      roles: [],
      source: 'ship_code',
    };
  }

  // Fallback 2: a reference/sail we can't map — still scope by its own codes.
  if (reference) {
    return {
      reference_sail_code: reference,
      ship_code: null,
      ship_name: null,
      sail_codes: Array.from(new Set([
        reference,
        ...resolveSegmentSailCodes(detail),
        ...(resolveSailCode(detail) ? [resolveSailCode(detail)] : []),
      ])).sort(),
      roles: [],
      source: 'reference_only',
    };
  }

  return null;
};

export default {
  resolveReferenceSailCode,
  resolveSailCode,
  resolveShipCode,
  buildInventoryReferenceIndex,
  resolveSelectionScope,
};
