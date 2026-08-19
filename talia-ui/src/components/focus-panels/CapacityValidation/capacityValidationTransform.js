/**
 * Capacity Validation — vertical source ledger for one selected voyage.
 * Each metric states table, derivation, grain, and scope. Never sum master+segment berths.
 */

import {
  indexCabinReservesForSail,
  summarizeCabinReserves,
} from '../../../lib/shipCabinReserve.js';

const asNumber = (value) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

const toDateKey = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const formatNumber = (value) => {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value);
};

const filterRows = (rows, { sailCodes = null, sailCode = null, shipCode = null } = {}) => {
  let next = Array.isArray(rows) ? rows : [];
  if (sailCode) {
    const code = String(sailCode).trim();
    next = next.filter((row) => String(row?.sail_code || '').trim() === code);
  } else if (sailCodes?.length) {
    const set = new Set(sailCodes.map((c) => String(c).trim()).filter(Boolean));
    next = next.filter((row) => set.has(String(row?.sail_code || '').trim()));
  }
  if (shipCode) {
    const ship = String(shipCode).trim();
    next = next.filter((row) => {
      const rowShip = String(row?.ship_code || '').trim();
      // Keep rows that omit ship_code (common on cabin_availability).
      if (!rowShip) return true;
      return rowShip === ship;
    });
  }
  return next;
};

const peakByField = (rows, field, dateFieldCandidates = ['date', 'sail_itinerary_date', 'sail_date']) => {
  let peak = null;
  let peakDate = null;
  let contributing = 0;
  rows.forEach((row) => {
    const value = asNumber(row?.[field]);
    if (value == null) return;
    contributing += 1;
    if (peak == null || value > peak) {
      peak = value;
      peakDate = null;
      for (const key of dateFieldCandidates) {
        const d = toDateKey(row?.[key]);
        if (d) {
          peakDate = d;
          break;
        }
      }
    }
  });
  return { value: peak, peakDate, contributing, rowCount: rows.length };
};

const sumField = (rows, field) => {
  let total = 0;
  let contributing = 0;
  rows.forEach((row) => {
    const value = asNumber(row?.[field]);
    if (value == null) return;
    total += value;
    contributing += 1;
  });
  return { value: contributing ? total : null, contributing, rowCount: rows.length };
};

/**
 * Cabin availability: max total_cabins per (sail, category), then sum categories.
 * Optional berth estimate when cabin_capacity is present: sum(capacity × cabins).
 */
export const summarizeCabinAvailability = (cabinRows, { sailCode, sailCodes, shipCode } = {}) => {
  const rows = filterRows(cabinRows, { sailCode, sailCodes, shipCode });
  const cabinByKey = new Map();
  const berthByKey = new Map();
  rows.forEach((row) => {
    const sail = String(row?.sail_code || '').trim();
    const cat = String(row?.cabin_category || row?.cabin_category_code || 'ALL').trim();
    const key = `${sail}|${cat}`;
    const cabins = asNumber(row?.total_cabins);
    const occupied = asNumber(row?.occupied_cabins ?? row?.booked_cabins);
    const available = asNumber(row?.available_cabins);
    const capPerCabin = asNumber(row?.cabin_capacity);
    if (cabins != null) {
      const prev = cabinByKey.get(key);
      if (!prev || cabins > prev.cabins) {
        cabinByKey.set(key, { cabins, occupied, available, capPerCabin });
      }
    }
    if (cabins != null && capPerCabin != null && capPerCabin > 0) {
      const berths = cabins * capPerCabin;
      const prevB = berthByKey.get(key);
      if (prevB == null || berths > prevB) berthByKey.set(key, berths);
    }
  });
  const cabinValues = [...cabinByKey.values()];
  const totalCabins = cabinValues.length
    ? cabinValues.reduce((sum, row) => sum + (row.cabins || 0), 0)
    : null;
  const occupiedCabins = cabinValues.some((row) => row.occupied != null)
    ? cabinValues.reduce((sum, row) => sum + (row.occupied || 0), 0)
    : null;
  const availableCabins = cabinValues.some((row) => row.available != null)
    ? cabinValues.reduce((sum, row) => sum + (row.available || 0), 0)
    : (totalCabins != null && occupiedCabins != null
      ? Math.max(0, totalCabins - occupiedCabins)
      : null);
  const berthCapacity = berthByKey.size
    ? [...berthByKey.values()].reduce((sum, v) => sum + v, 0)
    : null;

  return {
    rowCount: rows.length,
    categoryCount: cabinByKey.size,
    totalCabins: formatNumber(totalCabins),
    occupiedCabins: formatNumber(occupiedCabins),
    availableCabins: formatNumber(availableCabins),
    berthCapacity: formatNumber(berthCapacity),
  };
};

/**
 * sail_by_cabin_occupancy path used as MSE fallback:
 * berths = sum over categories of (cabin_capacity × total_cabins) per day, then peak day.
 * Also tracks cabin units (sum total_cabins / occupied_cabins) on the peak-capacity day.
 */
export const summarizeCabinOccupancyBerths = (occupancyRows, { sailCode, shipCode } = {}) => {
  const rows = filterRows(occupancyRows, { sailCode, shipCode });
  const byDate = new Map();
  rows.forEach((row) => {
    const dateKey = toDateKey(row?.sail_itinerary_date || row?.date);
    if (!dateKey) return;
    const cabinCapacity = asNumber(row?.cabin_capacity) || 0;
    const totalCabins = asNumber(row?.total_cabins) || 0;
    const occupiedCabins = asNumber(row?.occupied_cabins) || 0;
    const berthCapacity = cabinCapacity > 0 ? cabinCapacity * totalCabins : totalCabins;
    const berthsOccupied = cabinCapacity > 0 ? cabinCapacity * occupiedCabins : occupiedCabins;
    const existing = byDate.get(dateKey) || {
      capacity: 0,
      occupied: 0,
      cabins: 0,
      occupiedCabins: 0,
    };
    existing.capacity += berthCapacity;
    existing.occupied += berthsOccupied;
    existing.cabins += totalCabins;
    existing.occupiedCabins += occupiedCabins;
    byDate.set(dateKey, existing);
  });
  let peakCap = null;
  let peakOcc = null;
  let peakCabins = null;
  let peakOccupiedCabins = null;
  let peakDate = null;
  byDate.forEach((entry, dateKey) => {
    if (peakCap == null || entry.capacity > peakCap) {
      peakCap = entry.capacity;
      peakOcc = entry.occupied;
      peakCabins = entry.cabins;
      peakOccupiedCabins = entry.occupiedCabins;
      peakDate = dateKey;
    }
  });
  return {
    rowCount: rows.length,
    dayCount: byDate.size,
    capacity: formatNumber(peakCap),
    occupied: formatNumber(peakOcc),
    available: peakCap != null && peakOcc != null ? formatNumber(Math.max(0, peakCap - peakOcc)) : null,
    cabins: formatNumber(peakCabins),
    occupiedCabins: formatNumber(peakOccupiedCabins),
    availableCabins: peakCabins != null && peakOccupiedCabins != null
      ? formatNumber(Math.max(0, peakCabins - peakOccupiedCabins))
      : null,
    peakDate,
  };
};

const pair = (cabins, berths) => ({
  cabins: cabins == null ? null : cabins,
  berths: berths == null ? null : berths,
});

const berthsToCabins = (berths) => (
  berths == null ? null : formatNumber(berths / 2)
);

const sourceRow = ({
  id,
  name,
  table,
  how,
  capacity,
  booked,
  available,
  detail = null,
  warn = null,
  highlight = false,
  kind = 'physical',
}) => ({
  id,
  name,
  table,
  how,
  capacity,
  booked,
  available,
  detail,
  warn,
  highlight,
  kind,
});

const metric = ({
  id,
  category,
  label,
  value,
  unit,
  sourceTable,
  sourceSystem,
  derivation,
  grain,
  scopeFilter,
  rowCount = 0,
  detail = null,
  warn = null,
}) => ({
  id,
  category,
  label,
  value: value == null ? null : value,
  unit,
  source_table: sourceTable,
  source_system: sourceSystem,
  derivation,
  grain,
  scope_filter: scopeFilter,
  row_count: rowCount,
  detail,
  warn,
  has_value: value != null && Number.isFinite(Number(value)),
});

/**
 * Build compact cabins×berths source matrix for one sailing.
 */
export const buildCapacityValidationLedger = ({
  referenceSailCode,
  sailCodes = [],
  shipCode,
  shipName,
  masterSailRow,
  berthRows = [],
  cabinRows = [],
  occupancyRows = [],
  inventoryDayRows = [],
  ships = [],
  reservationRows = [],
  reserveRows = [],
} = {}) => {
  const reference = referenceSailCode
    || (sailCodes.length ? sailCodes[0] : null)
    || null;
  const scopeCodes = sailCodes?.length ? sailCodes : (reference ? [reference] : []);
  const departure = toDateKey(masterSailRow?.sail_date_from);

  const mseBerthRows = filterRows(berthRows, { sailCode: reference, shipCode });
  const mseCap = peakByField(mseBerthRows, 'nameplate_berths')?.value != null
    ? peakByField(mseBerthRows, 'nameplate_berths')
    : peakByField(mseBerthRows, 'berth_capacity');
  const mseOcc = peakByField(mseBerthRows, 'occupied_berths')?.value != null
    ? peakByField(mseBerthRows, 'occupied_berths')
    : peakByField(mseBerthRows, 'berths_occupied');
  const mseSellable = peakByField(mseBerthRows, 'sellable_berths');
  const mseOffsale = peakByField(mseBerthRows, 'offsale_berths');
  const mseAvailRaw = peakByField(mseBerthRows, 'available_berths')?.value != null
    ? peakByField(mseBerthRows, 'available_berths')
    : peakByField(mseBerthRows, 'berths_available');
  const mseAvail = mseSellable.value != null && mseOcc.value != null
    ? Math.max(0, mseSellable.value - mseOcc.value)
    : (mseCap.value != null && mseOcc.value != null
      ? Math.max(0, mseCap.value - mseOcc.value)
      : mseAvailRaw.value);

  const reserveIndex = indexCabinReservesForSail(reserveRows, {
    shipCode,
    dateKey: departure,
  });
  const reserveSummary = summarizeCabinReserves(reserveIndex);

  const occSummary = summarizeCabinOccupancyBerths(occupancyRows, {
    sailCode: reference,
    shipCode,
  });

  const cabinRef = summarizeCabinAvailability(cabinRows, { sailCode: reference, shipCode });

  const invRows = filterRows(inventoryDayRows, { sailCode: reference, shipCode });
  const invCap = peakByField(invRows, 'capacity', ['date', 'sail_date', 'snapshot_date']);
  const invSold = peakByField(invRows, 'sold', ['date', 'sail_date', 'snapshot_date']);
  const invAvail = peakByField(invRows, 'available', ['date', 'sail_date', 'snapshot_date']);

  const ship = (ships || []).find(
    (row) => String(row?.ship_code || '').trim() === String(shipCode || '').trim()
  );
  const nameplate = asNumber(ship?.ship_pax_capacity ?? ship?.pax_capacity);

  const resRef = filterRows(reservationRows, { sailCode: reference });
  const resAll = filterRows(reservationRows, { sailCodes: scopeCodes });
  const guestsRef = sumField(resRef, 'guest_count');
  const guestsAll = sumField(resAll, 'guest_count');

  const mseCapBerths = formatNumber(mseCap.value);
  const mseOccBerths = formatNumber(mseOcc.value);
  const mseAvailBerths = formatNumber(mseAvail);

  const sources = [
    sourceRow({
      id: 'mse-physical',
      name: 'MSE physical',
      table: 'ship_day_capacity',
      how: 'Peak day nameplate · reference sail only (what MSE Tot C / Cap B show)',
      highlight: true,
      kind: 'physical',
      capacity: pair(berthsToCabins(mseCapBerths), mseCapBerths),
      booked: pair(berthsToCabins(mseOccBerths), mseOccBerths),
      available: pair(berthsToCabins(mseAvailBerths), mseAvailBerths),
      detail: [
        mseCap.peakDate ? `peak ${mseCap.peakDate}` : null,
        `${mseBerthRows.length} rows`,
      ].filter(Boolean).join(' · ') || null,
      warn: mseBerthRows.length === 0
        ? 'No berth rows for reference sail — MSE may fall back to cabin occupancy.'
        : null,
    }),
    sourceRow({
      id: 'sellable-capacity',
      name: 'Sellable capacity',
      table: 'ship_day_capacity',
      how: 'Nameplate minus offsale · peak day · reference sail (LF denominator)',
      kind: 'physical',
      capacity: pair(
        formatNumber(peakByField(mseBerthRows, 'sellable_cabins').value),
        formatNumber(mseSellable.value)
      ),
      booked: pair(berthsToCabins(mseOccBerths), mseOccBerths),
      available: pair(berthsToCabins(mseAvailBerths), mseAvailBerths),
      detail: mseSellable.peakDate ? `peak ${mseSellable.peakDate}` : null,
    }),
    sourceRow({
      id: 'offsale-reserve',
      name: 'Offsale / blocked',
      table: 'ship_cabin_reserve',
      how: 'Distinct cabins overlapping sail date · types RESERVED / BROKEN / OOO / EMERGENCY / WAREHOUSE / CREW / OVER',
      kind: 'physical',
      capacity: pair(
        formatNumber(peakByField(mseBerthRows, 'offsale_cabins').value) ?? reserveSummary.offsale,
        formatNumber(mseOffsale.value)
      ),
      booked: pair(null, null),
      available: pair(null, null),
      detail: [
        `${reserveSummary.offsale} offsale`,
        `${reserveSummary.segment} segment holds`,
        `${reserveSummary.constrained} constrained`,
      ].join(' · '),
      warn: reserveSummary.segment > 0
        ? 'Segment / port-pair holds stay in nameplate and are not subtracted.'
        : null,
    }),
    sourceRow({
      id: 'cabin-occupancy',
      name: 'Cabin occupancy',
      table: 'sail_by_cabin_occupancy',
      how: 'Σ category (cabins × pax/cabin) · peak day · reference sail',
      kind: 'physical',
      capacity: pair(occSummary.cabins, occSummary.capacity),
      booked: pair(occSummary.occupiedCabins, occSummary.occupied),
      available: pair(occSummary.availableCabins, occSummary.available),
      detail: [
        occSummary.peakDate ? `peak ${occSummary.peakDate}` : null,
        `${occSummary.rowCount} rows`,
      ].filter(Boolean).join(' · ') || null,
    }),
    sourceRow({
      id: 'cabin-availability',
      name: 'Cabin availability',
      table: 'cabin_availability',
      how: 'Σ categories on reference sail (cabins; berths if cabin_capacity present)',
      kind: 'physical',
      capacity: pair(cabinRef.totalCabins, cabinRef.berthCapacity),
      booked: pair(cabinRef.occupiedCabins, null),
      available: pair(cabinRef.availableCabins, null),
      detail: cabinRef.categoryCount
        ? `${cabinRef.categoryCount} categories · ${cabinRef.rowCount} rows`
        : `${cabinRef.rowCount} rows`,
      warn: cabinRef.rowCount === 0
        ? 'No cabin_availability rows for this sail.'
        : (cabinRef.berthCapacity == null
          ? 'cabin_capacity missing — berths not derived.'
          : null),
    }),
    sourceRow({
      id: 'inventory-day',
      name: 'Inventory by day',
      table: 'inventory_status_by_day',
      how: 'Peak day capacity/sold/available · unit may be cabins or berths (verify sync)',
      kind: 'derived',
      capacity: pair(null, formatNumber(invCap.value)),
      booked: pair(null, formatNumber(invSold.value)),
      available: pair(null, formatNumber(invAvail.value)),
      detail: [
        invCap.peakDate ? `peak ${invCap.peakDate}` : null,
        `${invRows.length} rows`,
      ].filter(Boolean).join(' · ') || null,
      warn: 'Shown under Berths column until unit is confirmed in sync.',
    }),
    sourceRow({
      id: 'ship-nameplate',
      name: 'Ship nameplate',
      table: 'ship',
      how: 'ship.ship_pax_capacity (not voyage-specific)',
      kind: 'reference',
      capacity: pair(berthsToCabins(formatNumber(nameplate)), formatNumber(nameplate)),
      booked: pair(null, null),
      available: pair(null, null),
      detail: shipCode || null,
    }),
    sourceRow({
      id: 'guests-selling',
      name: 'Sold guests',
      table: 'reservation_current_state',
      how: 'SUM(guest_count) — selling, not physical berths',
      kind: 'selling',
      capacity: pair(null, null),
      booked: pair(null, formatNumber(guestsAll.value)),
      available: pair(null, null),
      detail: `ref ${formatNumber(guestsRef.value) ?? '—'} · all codes ${formatNumber(guestsAll.value) ?? '—'} · ${resAll.length} rows`,
      warn: 'Selling guests ≠ physical occupied berths.',
    }),
  ];

  // Keep a thin metrics list for older callers / tests that keyed by id.
  const metrics = sources.flatMap((src) => {
    const items = [];
    if (src.capacity?.berths != null || src.capacity?.cabins != null) {
      items.push(metric({
        id: `${src.id}-capacity`,
        category: 'capacity',
        label: `${src.name} capacity`,
        value: src.capacity.berths ?? src.capacity.cabins,
        unit: src.capacity.berths != null ? 'berths' : 'cabins',
        sourceTable: src.table,
        sourceSystem: src.name,
        derivation: src.how,
        grain: src.how,
        scopeFilter: `reference=${reference || '—'}`,
        rowCount: 0,
        detail: src.detail,
        warn: src.warn,
      }));
    }
    return items;
  });

  return {
    scope: {
      reference_sail_code: reference,
      sail_codes: scopeCodes,
      ship_code: shipCode || null,
      ship_name: shipName || masterSailRow?.ship_name || null,
      sail_date_from: departure,
      package_name: masterSailRow?.package_name || null,
    },
    sources,
    metrics,
    notes: [
      'Cabins for MSE physical = berths ÷ 2 (same assumption MSE uses).',
      'Compare cabins and berths within a source first; then compare across sources.',
    ],
  };
};

/** @deprecated use buildCapacityValidationLedger */
export const buildCapacityValidationRow = (args) => {
  const ledger = buildCapacityValidationLedger(args);
  const byId = Object.fromEntries((ledger.sources || []).map((s) => [s.id, s]));
  return {
    reference_sail_code: ledger.scope.reference_sail_code,
    sail_codes: (ledger.scope.sail_codes || []).join(', '),
    ship_code: ledger.scope.ship_code,
    ship_name: ledger.scope.ship_name,
    sail_date_from: ledger.scope.sail_date_from,
    package_name: ledger.scope.package_name,
    physical_berth_capacity: byId['mse-physical']?.capacity?.berths ?? null,
    cabin_availability_total_cabins: byId['cabin-availability']?.capacity?.cabins ?? null,
    inventory_status_capacity: byId['inventory-day']?.capacity?.berths ?? null,
    ship_pax_capacity: byId['ship-nameplate']?.capacity?.berths ?? null,
    sold_guests: byId['guests-selling']?.booked?.berths ?? null,
    note: ledger.notes.join(' '),
  };
};

export default {
  buildCapacityValidationLedger,
  buildCapacityValidationRow,
  summarizeCabinAvailability,
  summarizeCabinOccupancyBerths,
};
