/**
 * Capacity Validation — compare capacity figures across sources for one voyage.
 * Ops/data-check only; never sum master + segment physical berths.
 */

const asNumber = (value) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

const maxOf = (values) => {
  const nums = values.filter((v) => v != null && Number.isFinite(v));
  if (!nums.length) return null;
  return Math.max(...nums);
};

const sumOf = (values) => {
  const nums = values.filter((v) => v != null && Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0);
};

const filterBySailCodes = (rows, sailCodes) => {
  const set = new Set((sailCodes || []).map((c) => String(c).trim()).filter(Boolean));
  if (!set.size) return [];
  return (rows || []).filter((row) => set.has(String(row?.sail_code || '').trim()));
};

/**
 * Peak berth capacity for the voyage window — use max across days, not sum of days.
 * Prefer ship_code when provided (physical grain).
 */
export const peakBerthCapacity = (berthRows, { sailCodes, shipCode } = {}) => {
  let rows = filterBySailCodes(berthRows, sailCodes);
  if (shipCode) {
    const ship = String(shipCode).trim();
    rows = rows.filter((row) => String(row?.ship_code || '').trim() === ship);
  }
  return maxOf(rows.map((row) => asNumber(row?.berth_capacity)));
};

export const cabinAvailabilityCapacity = (cabinRows, sailCodes) => {
  const rows = filterBySailCodes(cabinRows, sailCodes);
  // Cabin capacity is category grain — sum total_cabins for the sail codes once
  // (rows may repeat by date/category; take max per sail_code then sum codes carefully).
  // For validation: sum distinct (sail_code, cabin_category) max total_cabins.
  const byKey = new Map();
  rows.forEach((row) => {
    const sail = String(row?.sail_code || '').trim();
    const cat = String(row?.cabin_category || row?.cabin_category_code || 'ALL').trim();
    const key = `${sail}|${cat}`;
    const total = asNumber(row?.total_cabins);
    if (total == null) return;
    const prev = byKey.get(key);
    if (prev == null || total > prev) byKey.set(key, total);
  });
  return sumOf([...byKey.values()]);
};

export const inventoryDayCapacity = (inventoryRows, sailCodes) => {
  const rows = filterBySailCodes(inventoryRows, sailCodes);
  // Max capacity across days for the voyage (do not sum days).
  return maxOf(rows.map((row) => asNumber(row?.capacity)));
};

export const shipNameplateCapacity = (ships, shipCode) => {
  if (!shipCode) return null;
  const ship = (ships || []).find(
    (row) => String(row?.ship_code || '').trim() === String(shipCode).trim()
  );
  return asNumber(ship?.ship_pax_capacity ?? ship?.pax_capacity);
};

export const soldGuestTotal = (reservationRows, sailCodes) => {
  const rows = filterBySailCodes(reservationRows, sailCodes);
  return sumOf(rows.map((row) => asNumber(row?.guest_count) ?? 0)) ?? 0;
};

export const buildCapacityValidationRow = ({
  referenceSailCode,
  sailCodes,
  shipCode,
  shipName,
  masterSailRow,
  berthRows,
  cabinRows,
  inventoryDayRows,
  ships,
  reservationRows,
} = {}) => {
  const physicalBerths = peakBerthCapacity(berthRows, { sailCodes, shipCode });
  const cabinUnits = cabinAvailabilityCapacity(cabinRows, sailCodes);
  const inventoryCap = inventoryDayCapacity(inventoryDayRows, sailCodes);
  const nameplate = shipNameplateCapacity(ships, shipCode);
  const guests = soldGuestTotal(reservationRows, sailCodes);

  const deltas = {
    physical_vs_nameplate: physicalBerths != null && nameplate != null
      ? physicalBerths - nameplate
      : null,
    physical_vs_inventory: physicalBerths != null && inventoryCap != null
      ? physicalBerths - inventoryCap
      : null,
    guests_vs_physical: physicalBerths != null
      ? guests - physicalBerths
      : null,
  };

  return {
    reference_sail_code: referenceSailCode || null,
    sail_codes: (sailCodes || []).join(', '),
    ship_code: shipCode || null,
    ship_name: shipName || masterSailRow?.ship_name || null,
    sail_date_from: masterSailRow?.sail_date_from || null,
    package_name: masterSailRow?.package_name || null,
    physical_berth_capacity: physicalBerths,
    cabin_availability_total_cabins: cabinUnits,
    inventory_status_capacity: inventoryCap,
    ship_pax_capacity: nameplate,
    sold_guests: guests,
    delta_physical_vs_nameplate: deltas.physical_vs_nameplate,
    delta_physical_vs_inventory: deltas.physical_vs_inventory,
    delta_guests_vs_physical: deltas.guests_vs_physical,
    note: 'Physical berths use peak day (not sum). Master+segment berths are the same physical capacity — do not double-count.',
  };
};

export default {
  buildCapacityValidationRow,
  peakBerthCapacity,
  cabinAvailabilityCapacity,
  inventoryDayCapacity,
  shipNameplateCapacity,
  soldGuestTotal,
};
