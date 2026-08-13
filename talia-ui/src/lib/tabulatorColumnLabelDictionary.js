/**
 * Global Tabulator column label dictionary.
 * Keeps headers compact while preserving full semantic labels via headerTooltip.
 */

const FIELD_LABELS = {
  res_id: { short: 'Res ID', long: 'Reservation ID' },
  res_status: { short: 'St', long: 'Reservation status' },
  sail_code: { short: 'Sail', long: 'Sailing code' },
  sail_from_date: { short: 'Date', long: 'Sailing date / start date' },
  sail_to_date: { short: 'To', long: 'Sailing end date' },
  sail_days: { short: 'Dur', long: 'Duration' },
  ship: { short: 'Ship', long: 'Ship code' },
  ship_code: { short: 'Ship', long: 'Ship code' },
  ship_name: { short: 'Ship', long: 'Ship name' },
  package_name: { short: 'Pkg', long: 'Package name' },
  package_type: { short: 'Pkg T', long: 'Package type' },
  route: { short: 'Route', long: 'Route' },
  cabin_type: { short: 'Cab T', long: 'Cabin type' },
  cabin_category: { short: 'Cab Cat', long: 'Cabin category' },
  guest_count: { short: 'Gst', long: 'Guest count' },
  gross_selling_fare: { short: 'Gross SF', long: 'Gross selling fare' },
  net_selling_fare: { short: 'Net SF', long: 'Net selling fare' },
  net_ticket_revenue_eur: { short: 'Net Rev EUR', long: 'Net ticket revenue (EUR)' },
  gross_ticket_revenue: { short: 'Gross Rev', long: 'Gross ticket revenue' },
  net_ticket_revenue: { short: 'Net Rev', long: 'Net ticket revenue' },
  agency_id: { short: 'Agcy', long: 'Agency ID' },
  currency: { short: 'Cur', long: 'Currency' },
  pax_status: { short: 'PAX St', long: 'Passenger status' },
  booked_cabins: { short: 'Bk C', long: 'Booked cabins' },
  total_cabins: { short: 'Tot C', long: 'Total cabins' },
  available_cabins: { short: 'Avl C', long: 'Available cabins' },
  guaranteed_cabins: { short: 'Res C', long: 'Reserved cabins (group × probability)' },
  booked_guests: { short: 'Booked', long: 'Booked guests (real / materialised)' },
  contracted_guests: { short: 'Contr', long: 'Contracted guests (synthetic group OF face)' },
  estimated_guests: { short: 'Est', long: 'Estimated guests (contracted × probability)' },
  actual_booked_pct: { short: 'Bk%', long: 'Actual booked cabins %' },
  potential_booked_pct: { short: 'Pot%', long: 'Potential booked cabins % (booked + reserved)' },
  booking_upside_pct: { short: 'Up%', long: 'Upside % (potential - actual)' },
  berth_capacity: { short: 'Cap B', long: 'Capacity (berths)' },
  berths_occupied: { short: 'Bk B', long: 'Booked (berths)' },
  berths_available: { short: 'Avl B', long: 'Available (berths)' },
};

/** Map synthetic/formatter-only column fields onto canonical dictionary keys. */
const FIELD_ALIASES = {
  booked_cabins_display: 'booked_cabins',
  total_cabins_display: 'total_cabins',
  available_cabins_display: 'available_cabins',
  reserved_cabins_display: 'guaranteed_cabins',
  actual_booked_pct_display: 'actual_booked_pct',
  potential_booked_pct_display: 'potential_booked_pct',
  booking_upside_pct_display: 'booking_upside_pct',
  booked_display: 'berths_occupied',
  capacity_display: 'berth_capacity',
  available_display: 'berths_available',
};

export const resolveCanonicalTabulatorField = (field) => {
  const key = typeof field === 'string' ? field.trim() : '';
  if (!key) return '';
  return FIELD_ALIASES[key] || key;
};

const observedFieldCounts = new Map();
const overrideFieldLabels = new Map();

export const resolveGlobalTabulatorLabel = ({ field, title }) => {
  const key = resolveCanonicalTabulatorField(field);
  if (!key) return null;
  const base = FIELD_LABELS[key] || {};
  const override = overrideFieldLabels.get(key) || {};
  const mapped = { ...base, ...override };
  if (!mapped.short && !mapped.long && !FIELD_LABELS[key] && !overrideFieldLabels.get(key)) return null;
  const short = String(mapped.short || title || '').trim();
  const long = String(mapped.long || title || short).trim();
  if (!short && !long) return null;
  return { short, long };
};

export const observeTabulatorFieldTerminology = ({ field, title, mapped, componentId }) => {
  const key = resolveCanonicalTabulatorField(field);
  if (!key) return;
  const current = observedFieldCounts.get(key) || {
    field: key,
    mapped: false,
    seenCount: 0,
    latestTitle: '',
    components: new Set(),
  };
  current.seenCount += 1;
  current.mapped = current.mapped || mapped === true;
  if (typeof title === 'string' && title.trim()) {
    current.latestTitle = title.trim();
  }
  if (typeof componentId === 'string' && componentId.trim()) {
    current.components.add(componentId.trim());
  }
  observedFieldCounts.set(key, current);
};

export const setGlobalTabulatorLabelOverrides = (definitions = []) => {
  overrideFieldLabels.clear();
  (Array.isArray(definitions) ? definitions : []).forEach((entry) => {
    const field = String(entry?.field || '').trim();
    if (!field) return;
    const short = String(entry?.shortLabel || entry?.short || '').trim();
    const long = String(entry?.longLabel || entry?.long || '').trim();
    if (!short && !long) return;
    overrideFieldLabels.set(field, { short, long });
  });
};

export const getGlobalTabulatorDictionaryRows = () => (
  Array.from(new Set([
    ...Object.keys(FIELD_LABELS),
    ...Array.from(overrideFieldLabels.keys()),
  ]))
    .map((field) => {
      const labels = FIELD_LABELS[field] || {};
      const override = overrideFieldLabels.get(field) || {};
      return {
      field,
      short: override.short || labels.short || '',
      long: override.long || labels.long || '',
      source: overrideFieldLabels.has(field) ? 'override' : 'base',
      status: 'mapped',
      };
    })
    .sort((a, b) => a.field.localeCompare(b.field))
);

export const getObservedTabulatorFieldRows = () => (
  Array.from(observedFieldCounts.values())
    .map((entry) => {
      const hasBase = Object.prototype.hasOwnProperty.call(FIELD_LABELS, entry.field);
      const hasOverride = overrideFieldLabels.has(entry.field);
      const labels = { ...(hasBase ? FIELD_LABELS[entry.field] : {}), ...(overrideFieldLabels.get(entry.field) || {}) };
      return {
        field: entry.field,
        short: labels?.short || '',
        long: labels?.long || '',
        seenCount: entry.seenCount || 0,
        latestTitle: entry.latestTitle || '',
        components: Array.from(entry.components || []).sort((a, b) => a.localeCompare(b)),
        status: hasBase || hasOverride ? 'mapped' : 'missing',
      };
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'missing' ? -1 : 1;
      return a.field.localeCompare(b.field);
    })
);

export default FIELD_LABELS;
