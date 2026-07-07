const asArray = (value) => (Array.isArray(value) ? value : []);

const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveShipCodeFromDetail = (detail) => {
  if (!detail) return null;
  if (typeof detail === 'string') {
    const normalized = detail.trim();
    return normalized || null;
  }
  const candidate = detail.ship_code
    || detail.Ship_Code
    || detail.row_data?.ship_code
    || detail.row_data?.Ship_Code
    || null;
  if (candidate == null) return null;
  const normalized = String(candidate).trim();
  return normalized || null;
};

export const mapShipSelectToFilters = (detail) => {
  const shipCode = resolveShipCodeFromDetail(detail);
  if (!shipCode) return null;
  return { ship_code: shipCode };
};

export const resolveShipSelectionLabel = (detail, shipRows = []) => {
  const shipCode = resolveShipCodeFromDetail(detail);
  if (!shipCode) return null;
  const shipName = detail?.ship_name
    || detail?.row_data?.ship_name
    || detail?.row_data?.ship_group_label
    || null;
  if (shipName) {
    return { ship_code: shipCode, ship_name: String(shipName).trim() };
  }
  const match = asArray(shipRows).find((row) => String(row?.ship_code || '').trim() === shipCode);
  return {
    ship_code: shipCode,
    ship_name: match?.ship_name || shipCode,
  };
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

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const monthLabelFromKey = (dateKey) => {
  if (!dateKey) return 'Unknown month';
  const [year, month] = dateKey.split('-');
  const monthIndex = Number.parseInt(month, 10) - 1;
  if (monthIndex < 0 || monthIndex > 11) return 'Unknown month';
  return `${MONTH_LABELS[monthIndex]} ${year}`;
};

export const buildShipNameMap = (shipRows = []) => {
  const map = new Map();
  asArray(shipRows).forEach((row) => {
    const code = String(row?.ship_code || '').trim();
    if (!code) return;
    map.set(code, String(row?.ship_name || code).trim());
  });
  return map;
};

/**
 * Aggregate the physical berth view to one operational row per ship × calendar day.
 * On turnaround days two sail_codes can cover the same date; the ship still has a
 * single physical berth pool, so we take the MAX per ship × day rather than summing.
 */
export const buildShipDayRows = (shipDayBerthRows = [], shipRows = []) => {
  const shipNames = buildShipNameMap(shipRows);
  const dayIndex = new Map();

  asArray(shipDayBerthRows).forEach((row) => {
    const shipCode = String(row?.ship_code || '').trim();
    const dateKey = toDateKey(row?.date);
    if (!shipCode || !dateKey) return;

    const capacity = toNumber(row?.berth_capacity);
    const occupied = toNumber(row?.berths_occupied);
    const sailCode = String(row?.sail_code || '').trim();

    const key = `${shipCode}|${dateKey}`;
    const existing = dayIndex.get(key) || {
      row_type: 'day',
      row_key: key,
      ship_code: shipCode,
      ship_name: shipNames.get(shipCode) || shipCode,
      date: dateKey,
      month_label: monthLabelFromKey(dateKey),
      ship_group_label: shipNames.get(shipCode) || shipCode,
      capacity: 0,
      occupied: 0,
      sail_codes: new Set(),
    };

    existing.capacity = Math.max(existing.capacity, capacity);
    existing.occupied = Math.max(existing.occupied, occupied);
    if (sailCode) existing.sail_codes.add(sailCode);
    dayIndex.set(key, existing);
  });

  return Array.from(dayIndex.values())
    .map((entry) => {
      const capacity = Math.round(entry.capacity);
      const occupied = Math.round(entry.occupied);
      const available = Math.max(0, capacity - occupied);
      return {
        ...entry,
        capacity,
        occupied,
        available,
        occupancy_pct: capacity > 0 ? (occupied / capacity) * 100 : null,
        sail_codes: Array.from(entry.sail_codes).sort(),
      };
    })
    .sort((a, b) => {
      if (a.ship_code !== b.ship_code) return a.ship_code.localeCompare(b.ship_code);
      return a.date.localeCompare(b.date);
    });
};

export const buildShipDaySummaries = (dayRows = []) => {
  const summaries = new Map();
  asArray(dayRows).forEach((row) => {
    const code = row?.ship_code;
    if (!code) return;
    const summary = summaries.get(code) || {
      ship_code: code,
      ship_name: row.ship_name,
      day_count: 0,
      peak_capacity: 0,
      peak_occupied: 0,
      min_available: null,
      date_from: row.date,
      date_to: row.date,
    };
    summary.day_count += 1;
    summary.peak_capacity = Math.max(summary.peak_capacity, row.capacity || 0);
    summary.peak_occupied = Math.max(summary.peak_occupied, row.occupied || 0);
    summary.min_available = summary.min_available === null
      ? row.available
      : Math.min(summary.min_available, row.available || 0);
    if (row.date < summary.date_from) summary.date_from = row.date;
    if (row.date > summary.date_to) summary.date_to = row.date;
    summaries.set(code, summary);
  });
  return Array.from(summaries.values()).sort((a, b) => a.ship_code.localeCompare(b.ship_code));
};

export const buildShipDayBerthBundle = ({ shipDayBerthRows, shipRows } = {}) => {
  const dayRows = buildShipDayRows(shipDayBerthRows, shipRows);
  const summaries = buildShipDaySummaries(dayRows);
  return { dayRows, summaries };
};
