import { buildMasterSailingRows } from '../MasterSailing/masterSailingTransform.js';

const asArray = (value) => (Array.isArray(value) ? value : []);

const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

const enumerateVoyageDates = (fromValue, toValue) => {
  const from = toDateKey(fromValue);
  const to = toDateKey(toValue) || from;
  if (!from) return [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${(to || from)}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [from];
  const dates = [];
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
};

const segmentActiveOnDate = (segment, dateKey) => {
  const from = toDateKey(segment?.sail_date_from);
  const to = toDateKey(segment?.sail_date_to) || from;
  if (!from || !dateKey) return false;
  return dateKey >= from && dateKey <= (to || from);
};

// ---------------------------------------------------------------------------
// Selling structure: guest counts attributed to sail_code (reservations)
// ---------------------------------------------------------------------------
export const buildGuestsBySailCode = (reservationRows = []) => {
  const map = new Map();
  asArray(reservationRows).forEach((row) => {
    const sailCode = String(row?.sail_code || '').trim();
    if (!sailCode) return;
    const guests = toNumber(row?.guest_count);
    if (guests <= 0) return;
    map.set(sailCode, (map.get(sailCode) || 0) + guests);
  });
  return map;
};

export const buildGuaranteedCabinsBySailCode = (reservationRows = []) => {
  const map = new Map();
  asArray(reservationRows).forEach((row) => {
    const sailCode = String(row?.sail_code || '').trim();
    if (!sailCode) return;
    const hasResId = row?.res_id !== null && row?.res_id !== undefined && row?.res_id !== '';
    // Guaranteed cabins estimate is only for group rows that are not yet confirmed bookings.
    if (hasResId) return;
    const guests = toNumber(row?.guest_count);
    if (guests <= 0) return;
    const rawProbability = Number.parseFloat(row?.res_probability);
    const normalizedProbability = Number.isFinite(rawProbability)
      ? (rawProbability > 1 ? rawProbability / 100 : rawProbability)
      : 1;
    const probability = Math.max(0, Math.min(1, normalizedProbability));
    const estimatedCabins = (guests / 2) * probability;
    map.set(sailCode, (map.get(sailCode) || 0) + estimatedCabins);
  });
  return map;
};

export const buildSegmentsByMaster = (hierarchyRows = []) => {
  const segmentsByMaster = new Map();

  asArray(hierarchyRows).forEach((row) => {
    const masterCode = String(row?.master_sail_code || '').trim();
    const segmentCode = String(row?.segment_sail_code || '').trim();
    if (!masterCode || !segmentCode) return;
    if (!segmentsByMaster.has(masterCode)) {
      segmentsByMaster.set(masterCode, []);
    }
    segmentsByMaster.get(masterCode).push({
      sail_code: segmentCode,
      sail_date_from: row?.sail_date_from || null,
      sail_date_to: row?.sail_date_to || null,
      ship_code: row?.ship_code || null,
      is_operational: row?.is_operational !== false,
    });
  });

  return segmentsByMaster;
};

// ---------------------------------------------------------------------------
// Physical layer: ship × sail_code × date berth facts (not summed across sail codes)
// ---------------------------------------------------------------------------
export const buildPhysicalBerthsBySailDate = (occupancyRows = []) => {
  const index = new Map();

  asArray(occupancyRows).forEach((row) => {
    const shipCode = String(row?.ship_code || '').trim();
    const sailCode = String(row?.sail_code || '').trim();
    const dateKey = toDateKey(row?.sail_itinerary_date);
    if (!shipCode || !sailCode || !dateKey) return;

    const cabinCapacity = toNumber(row?.cabin_capacity);
    const totalCabins = toNumber(row?.total_cabins);
    const occupiedCabins = toNumber(row?.occupied_cabins);
    const berthCapacity = cabinCapacity > 0 ? cabinCapacity * totalCabins : totalCabins;
    const berthsOccupied = cabinCapacity > 0 ? cabinCapacity * occupiedCabins : occupiedCabins;
    if (berthCapacity <= 0 && berthsOccupied <= 0) return;

    const key = `${shipCode}|${sailCode}|${dateKey}`;
    const existing = index.get(key) || {
      ship_code: shipCode,
      sail_code: sailCode,
      date: dateKey,
      total_cabins: 0,
      occupied_cabins: 0,
      berth_capacity: 0,
      berths_occupied: 0,
    };
    existing.total_cabins += totalCabins;
    existing.occupied_cabins += occupiedCabins;
    existing.berth_capacity += berthCapacity;
    existing.berths_occupied += berthsOccupied;
    index.set(key, existing);
  });

  index.forEach((entry) => {
    entry.available_cabins = Math.max(0, entry.total_cabins - entry.occupied_cabins);
    entry.berths_available = Math.max(0, entry.berth_capacity - entry.berths_occupied);
  });

  return index;
};

export const buildPhysicalBerthsFromShipDayRows = (shipDayRows = []) => {
  const index = new Map();
  asArray(shipDayRows).forEach((row) => {
    const shipCode = String(row?.ship_code || '').trim();
    const sailCode = String(row?.sail_code || '').trim();
    const dateKey = toDateKey(row?.date);
    if (!shipCode || !sailCode || !dateKey) return;
    const key = `${shipCode}|${sailCode}|${dateKey}`;
    const hasCabinAggs = row?.total_cabins != null || row?.occupied_cabins != null;
    const berthCapacity = toNumber(row?.berth_capacity);
    const berthsOccupied = toNumber(row?.berths_occupied);
    const berthsAvailable = row?.berths_available != null
      ? toNumber(row.berths_available)
      : Math.max(0, berthCapacity - berthsOccupied);
    const totalCabins = hasCabinAggs
      ? Math.max(0, toNumber(row?.total_cabins))
      : Math.max(0, Math.round(berthCapacity / 2));
    const occupiedCabins = hasCabinAggs
      ? Math.max(0, toNumber(row?.occupied_cabins))
      : Math.max(0, Math.round(berthsOccupied / 2));
    const availableCabins = hasCabinAggs && row?.available_cabins != null
      ? Math.max(0, toNumber(row.available_cabins))
      : Math.max(0, totalCabins - occupiedCabins);
    index.set(key, {
      ship_code: shipCode,
      sail_code: sailCode,
      date: dateKey,
      total_cabins: totalCabins,
      occupied_cabins: occupiedCabins,
      available_cabins: availableCabins,
      berth_capacity: berthCapacity,
      berths_occupied: berthsOccupied,
      berths_available: berthsAvailable,
      cabin_source: hasCabinAggs ? 'ship_day_berth_status' : 'berth_estimate',
    });
  });
  return index;
};

/**
 * Keep berth facts from ship_day_berth_status; overlay true cabin counts from
 * sail_by_cabin_occupancy when present (avoids berth÷2 as Bk C / Tot C).
 */
export const mergeCabinOccupancyOntoBerths = (berthIndex, cabinIndex) => {
  const merged = new Map();
  (berthIndex || new Map()).forEach((entry, key) => {
    merged.set(key, { ...entry });
  });
  (cabinIndex || new Map()).forEach((cabin, key) => {
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...cabin, cabin_source: 'sail_by_cabin_occupancy' });
      return;
    }
    merged.set(key, {
      ...existing,
      total_cabins: cabin.total_cabins,
      occupied_cabins: cabin.occupied_cabins,
      available_cabins: cabin.available_cabins,
      cabin_source: 'sail_by_cabin_occupancy',
    });
  });
  return merged;
};

/**
 * Physical berth snapshot for a voyage day.
 * Uses the master sail_code occupancy (same ship/cabins) — never sums across segments.
 */
export const resolvePhysicalDay = ({
  shipCode,
  masterSailCode,
  dateKey,
  physicalBerthsIndex,
}) => {
  const key = `${shipCode}|${masterSailCode}|${dateKey}`;
  const direct = physicalBerthsIndex.get(key);
  if (direct && direct.berth_capacity > 0) {
    return direct;
  }
  if (direct && direct.berths_occupied > 0) {
    return direct;
  }
  return direct || {
    ship_code: shipCode,
    sail_code: masterSailCode,
    date: dateKey,
    total_cabins: 0,
    occupied_cabins: 0,
    available_cabins: 0,
    berth_capacity: 0,
    berths_occupied: 0,
    berths_available: 0,
  };
};

// ---------------------------------------------------------------------------
// Selling structure: segment guest attribution (informational, not physical totals)
// ---------------------------------------------------------------------------
export const buildSellingSegmentSummaries = ({
  masterRow,
  segments = [],
  guestsBySailCode,
  guaranteedCabinsBySailCode,
}) => {
  const masterCode = String(masterRow?.sail_code || '').trim();
  const summaries = [];

  segments.forEach((segment) => {
    const guests = guestsBySailCode.get(segment.sail_code) || 0;
    const guaranteedCabins = guaranteedCabinsBySailCode?.get(segment.sail_code) || 0;
    summaries.push({
      sail_code: segment.sail_code,
      guests,
      guaranteed_cabins: guaranteedCabins,
      is_booking: guests > 0,
      is_active: true,
      sail_date_from: segment.sail_date_from,
      sail_date_to: segment.sail_date_to,
      layer: 'selling',
    });
  });

  const masterGuests = guestsBySailCode.get(masterCode) || 0;
  const masterGuaranteedCabins = guaranteedCabinsBySailCode?.get(masterCode) || 0;
  if (masterGuests > 0 || summaries.length === 0) {
    summaries.unshift({
      sail_code: masterCode,
      guests: masterGuests,
      guaranteed_cabins: masterGuaranteedCabins,
      is_booking: masterGuests > 0,
      is_active: true,
      sail_date_from: masterRow?.sail_date_from,
      sail_date_to: masterRow?.sail_date_to,
      layer: 'selling',
      is_master: true,
    });
  }

  return summaries;
};

export const buildDayDetailsForMaster = ({
  masterRow,
  segments = [],
  segmentSummaries = [],
  physicalBerthsIndex,
}) => {
  const masterCode = String(masterRow?.sail_code || '').trim();
  const shipCode = String(masterRow?.ship_code || '').trim();
  const voyageDates = enumerateVoyageDates(masterRow?.sail_date_from, masterRow?.sail_date_to);

  return voyageDates.map((dateKey, index) => {
    const physical = resolvePhysicalDay({
      shipCode,
      masterSailCode: masterCode,
      dateKey,
      physicalBerthsIndex,
    });

    const activeSellingSegments = segmentSummaries.filter((summary) => {
      if (summary.sail_code === masterCode && summary.is_master) return false;
      const segmentMeta = segments.find((s) => s.sail_code === summary.sail_code);
      return segmentMeta && segmentActiveOnDate(segmentMeta, dateKey);
    });

    return {
      row_type: 'day',
      row_key: `${masterCode}|${dateKey}`,
      parent_sail_code: masterCode,
      voyage_day_index: index + 1,
      voyage_day_date: dateKey,
      day_label: dateKey,
      booked: Math.round(physical.berths_occupied),
      capacity: Math.round(physical.berth_capacity),
      available: Math.round(physical.berths_available),
      booked_cabins: Math.round(physical.occupied_cabins || 0),
      total_cabins: Math.round(physical.total_cabins || 0),
      available_cabins: Math.round(physical.available_cabins || 0),
      guaranteed_cabins: Math.round(
        activeSellingSegments.reduce((sum, summary) => sum + (summary.guaranteed_cabins || 0), 0)
      ),
      physical_sail_code: physical.sail_code,
      layer: 'physical',
      contributing_segments: activeSellingSegments.map((summary) => ({
        sail_code: summary.sail_code,
        guests: summary.guests,
        guaranteed_cabins: summary.guaranteed_cabins || 0,
        is_booking: summary.guests > 0,
        is_active: true,
        layer: 'selling',
      })),
      segment_sail_codes: activeSellingSegments.map((entry) => entry.sail_code),
      departure_month_label: masterRow?.departure_month_label,
      ship_group_label: masterRow?.ship_group_label,
    };
  });
};

const resolveMasterPhysicalTotals = ({
  masterRow,
  physicalBerthsIndex,
  dayDetails,
}) => {
  const shipCode = String(masterRow?.ship_code || '').trim();
  const masterCode = String(masterRow?.sail_code || '').trim();
  const departureDate = toDateKey(masterRow?.sail_date_from);

  const departurePhysical = departureDate
    ? resolvePhysicalDay({
      shipCode,
      masterSailCode: masterCode,
      dateKey: departureDate,
      physicalBerthsIndex,
    })
    : null;

  let peakCapacity = departurePhysical?.berth_capacity || 0;
  let peakOccupied = departurePhysical?.berths_occupied || 0;
  let peakCabinCapacity = departurePhysical?.total_cabins || 0;
  let peakCabinBooked = departurePhysical?.occupied_cabins || 0;

  asArray(dayDetails).forEach((day) => {
    peakCapacity = Math.max(peakCapacity, day.capacity || 0);
    peakOccupied = Math.max(peakOccupied, day.booked || 0);
    peakCabinCapacity = Math.max(peakCabinCapacity, day.total_cabins || 0);
    peakCabinBooked = Math.max(peakCabinBooked, day.booked_cabins || 0);
  });

  return {
    total_capacity: Math.round(peakCapacity),
    total_booked: Math.round(peakOccupied),
    total_available: Math.max(0, Math.round(peakCapacity - peakOccupied)),
    total_cabins: Math.round(peakCabinCapacity),
    booked_cabins: Math.round(peakCabinBooked),
    available_cabins: Math.max(0, Math.round(peakCabinCapacity - peakCabinBooked)),
    physical_source: (
      departurePhysical?.cabin_source === 'sail_by_cabin_occupancy'
      || departurePhysical?.cabin_source === 'ship_day_berth_status'
    )
      ? 'cabin_occupancy+ship_day_berths'
      : 'ship_day_berths',
    physical_sail_code: masterCode,
  };
};

export const guestsAndGuaranteedFromBookingSummary = (summaryRows = []) => {
  const guestsBySailCode = new Map();
  const guaranteedCabinsBySailCode = new Map();
  asArray(summaryRows).forEach((row) => {
    const sailCode = String(row?.sail_code || '').trim();
    if (!sailCode) return;
    guestsBySailCode.set(sailCode, toNumber(row?.guest_count));
    guaranteedCabinsBySailCode.set(sailCode, toNumber(row?.guaranteed_cabins));
  });
  return { guestsBySailCode, guaranteedCabinsBySailCode };
};

export const buildMasterSailingExplorerBundle = ({
  masterSailRows,
  inventoryItems,
  reservationRows,
  bookingSummaryRows,
  hierarchyRows,
  occupancyRows,
  shipDayBerthRows,
}) => {
  const summaryMaps = bookingSummaryRows?.length
    ? guestsAndGuaranteedFromBookingSummary(bookingSummaryRows)
    : null;
  const reservationRowsForMasters = summaryMaps
    ? asArray(bookingSummaryRows).map((row) => ({
      sail_code: row?.sail_code,
      guest_count: row?.guest_count,
    }))
    : reservationRows;
  const masters = buildMasterSailingRows(masterSailRows, inventoryItems, reservationRowsForMasters);
  const segmentsByMaster = buildSegmentsByMaster(hierarchyRows);
  const guestsBySailCode = summaryMaps
    ? summaryMaps.guestsBySailCode
    : buildGuestsBySailCode(reservationRows);
  const guaranteedCabinsBySailCode = summaryMaps
    ? summaryMaps.guaranteedCabinsBySailCode
    : buildGuaranteedCabinsBySailCode(reservationRows);
  const berthIndex = shipDayBerthRows?.length
    ? buildPhysicalBerthsFromShipDayRows(shipDayBerthRows)
    : new Map();
  const berthHasCabinAggs = berthIndex.size > 0 && Array.from(berthIndex.values()).some(
    (entry) => entry?.cabin_source === 'ship_day_berth_status'
  );
  const cabinIndex = (!berthHasCabinAggs && occupancyRows?.length)
    ? buildPhysicalBerthsBySailDate(occupancyRows)
    : new Map();
  const physicalBerthsIndex = berthIndex.size > 0
    ? (cabinIndex.size > 0 ? mergeCabinOccupancyOntoBerths(berthIndex, cabinIndex) : berthIndex)
    : cabinIndex;
  const dayDetailsByMaster = new Map();

  const enrichedMasters = masters.map((masterRow) => {
    const masterCode = String(masterRow?.sail_code || '').trim();
    const segments = (segmentsByMaster.get(masterCode) || []).filter((segment) => segment.is_operational);
    const segmentSummaries = buildSellingSegmentSummaries({
      masterRow,
      segments,
      guestsBySailCode,
      guaranteedCabinsBySailCode,
    });
    const dayDetails = buildDayDetailsForMaster({
      masterRow,
      segments,
      segmentSummaries,
      physicalBerthsIndex,
    });
    const physicalTotals = resolveMasterPhysicalTotals({
      masterRow,
      physicalBerthsIndex,
      dayDetails,
    });

    dayDetailsByMaster.set(masterCode, dayDetails);

    const selling_guests_total = segmentSummaries.reduce((sum, s) => sum + (s.guests || 0), 0);
    const guaranteed_cabins = segmentSummaries.reduce((sum, s) => sum + (s.guaranteed_cabins || 0), 0);
    const actual_booked_pct = physicalTotals.total_cabins > 0
      ? (physicalTotals.booked_cabins / physicalTotals.total_cabins) * 100
      : null;
    const potential_booked_pct = physicalTotals.total_cabins > 0
      ? ((physicalTotals.booked_cabins + guaranteed_cabins) / physicalTotals.total_cabins) * 100
      : null;
    const booking_upside_pct = (
      actual_booked_pct != null && potential_booked_pct != null
        ? potential_booked_pct - actual_booked_pct
        : null
    );

    return {
      ...masterRow,
      row_type: 'master',
      row_key: masterCode,
      total_booked: physicalTotals.total_booked,
      total_capacity: physicalTotals.total_capacity,
      total_available: physicalTotals.total_available,
      total_cabins: physicalTotals.total_cabins,
      booked_cabins: physicalTotals.booked_cabins,
      available_cabins: physicalTotals.available_cabins,
      guaranteed_cabins: Math.round(guaranteed_cabins),
      actual_booked_pct,
      potential_booked_pct,
      booking_upside_pct,
      occupancy_pct: physicalTotals.total_capacity > 0
        ? (physicalTotals.total_booked / physicalTotals.total_capacity) * 100
        : null,
      selling_guests_total,
      physical_sail_code: physicalTotals.physical_sail_code,
      segment_codes: segments.map((segment) => segment.sail_code),
      segment_summaries: segmentSummaries,
      day_count: dayDetails.length,
      is_expandable: dayDetails.length > 0,
    };
  });

  return {
    masters: enrichedMasters,
    dayDetailsByMaster,
  };
};

/** Resolve the canonical reference sail code from a selection event detail. */
export const resolveSelectionReferenceCode = (detail) => {
  if (!detail) return null;
  const code = detail.reference_sail_code
    || detail.canonical_scope?.reference_sail_code
    || detail.sail_code
    || detail.row_data?.reference_sail_code
    || detail.row_data?.sail_code
    || null;
  if (code == null) return null;
  const normalized = String(code).trim();
  return normalized || null;
};

/** True when a master explorer row matches the active reference selection. */
export const masterRowMatchesReference = (row, referenceCode) => {
  if (!referenceCode || row?.row_type !== 'master') return false;
  const ref = String(referenceCode).trim();
  const masterCode = String(row?.sail_code || '').trim();
  const rowReference = String(row?.reference_sail_code || masterCode).trim();
  return masterCode === ref || rowReference === ref;
};

export const buildExplorerDisplayRows = (masters, dayDetailsByMaster, expandedMasters = new Set()) => {
  const rows = [];
  asArray(masters).forEach((masterRow) => {
    const masterCode = String(masterRow?.sail_code || '').trim();
    const isExpanded = expandedMasters.has(masterCode);
    rows.push({
      ...masterRow,
      is_expanded: isExpanded,
    });
    if (isExpanded) {
      const dayRows = dayDetailsByMaster.get(masterCode) || [];
      dayRows.forEach((dayRow) => {
        rows.push(dayRow);
      });
    }
  });
  return rows;
};

// Legacy exports for tests
export const buildCapacityBySailCode = (occupancyRows = []) => {
  const index = buildPhysicalBerthsBySailDate(occupancyRows);
  const capacityBySail = new Map();
  index.forEach((entry) => {
    const existing = capacityBySail.get(entry.sail_code) || 0;
    if (entry.berth_capacity > existing) {
      capacityBySail.set(entry.sail_code, entry.berth_capacity);
    }
  });
  return capacityBySail;
};

export const buildSegmentSummariesForMaster = buildSellingSegmentSummaries;
