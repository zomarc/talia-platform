/**
 * Advisory Talia↔Talia relationships for Data Lineage Diagram (D015 v2).
 *
 * These are NOT Synapse / warehouse FKs and MUST NOT drive runtime joins.
 * Upstream source models are messy and will change; this list exists to
 * surface integration-relevant relationships for remapping discussion
 * without baking fragile source assumptions into Talia.
 *
 * Rules:
 * - Only Talia table names (local mirrors / canonical layer).
 * - status: proposed | provisional | confirmed
 * - Diagram draws a link only when BOTH endpoints are already visible
 *   from source→Talia→component lineage (never expands the graph alone).
 */

/**
 * @typedef {{
 *   id: string,
 *   from: string,
 *   to: string,
 *   joinHint?: string,
 *   reason: string,
 *   status: 'proposed'|'provisional'|'confirmed',
 *   confidence?: 'low'|'medium'|'high',
 * }} LineageLogicalLink
 */

/** @type {LineageLogicalLink[]} */
export const LINEAGE_LOGICAL_LINKS = Object.freeze([
  {
    id: 'master_sail→inventory_item',
    from: 'master_sail',
    to: 'inventory_item',
    joinHint: 'sail_code + ship_code',
    reason: 'Canonical sailing identity feed (inventory_item layer)',
    status: 'provisional',
    confidence: 'high',
  },
  {
    id: 'sail_by_cabin_occupancy→ship_day_berth_status',
    from: 'sail_by_cabin_occupancy',
    to: 'ship_day_berth_status',
    joinHint: 'sail_code + ship_code + date',
    reason: 'Physical berth facts derived for ship-day views',
    status: 'provisional',
    confidence: 'medium',
  },
  {
    id: 'reservation_current_state→inventory_item',
    from: 'reservation_current_state',
    to: 'inventory_item',
    joinHint: 'sail_code → voyage via reference_sail_code',
    reason: 'Selling facts join to canonical voyage/ship scope — do not re-derive master↔segment',
    status: 'provisional',
    confidence: 'high',
  },
  {
    id: 'ship_day_capacity→inventory_item',
    from: 'ship_day_capacity',
    to: 'inventory_item',
    joinHint: 'ship_code (+ sail_code when present)',
    reason: 'Physical capacity scoped by ship / voyage — never sum master+segment',
    status: 'proposed',
    confidence: 'medium',
  },
  {
    id: 'agency→reservation_current_state',
    from: 'agency',
    to: 'reservation_current_state',
    joinHint: 'agency_id / agency_code (confirm after remapping)',
    reason: 'Agency attribution on bookings — join key may shift with source remap',
    status: 'proposed',
    confidence: 'low',
  },
]);

/**
 * Links whose endpoints both appear in the given Talia table name set.
 * @param {Iterable<string>} taliaTableNames
 * @param {LineageLogicalLink[]} [catalog]
 */
export function selectVisibleLogicalLinks(taliaTableNames, catalog = LINEAGE_LOGICAL_LINKS) {
  const present = new Set(
    [...(taliaTableNames || [])].map((name) => String(name || '').trim()).filter(Boolean),
  );
  return (catalog || []).filter(
    (link) => present.has(link.from) && present.has(link.to),
  );
}
