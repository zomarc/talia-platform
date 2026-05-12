const asArray = (value) => (Array.isArray(value) ? value : []);

const isValidDateValue = (value) => {
  if (!value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
};

const toMonthKey = (isoDate) => {
  if (!isoDate) return 'Unknown month';
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return 'Unknown month';
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const toMonthLabel = (monthKey) => {
  if (!monthKey || monthKey === 'Unknown month') return 'Unknown month';
  const [yearStr, monthStr] = String(monthKey).split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 'Unknown month';
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
};

export const buildMasterSailingRows = (masterSailRows, inventoryItems, reservationRows = []) => {
  const sails = asArray(masterSailRows);
  const inventory = asArray(inventoryItems);
  const reservations = asArray(reservationRows);

  const referenceBySailCode = new Map(
    inventory
      .filter((row) => row?.sail_code)
      .map((row) => [String(row.sail_code), row?.reference_sail_code || null])
  );

  const guestsBySailCode = reservations.reduce((acc, row) => {
    const sailCode = String(row?.sail_code || '').trim();
    if (!sailCode) return acc;
    const guests = Number.parseFloat(row?.guest_count);
    if (!Number.isFinite(guests)) return acc;
    acc.set(sailCode, (acc.get(sailCode) || 0) + guests);
    return acc;
  }, new Map());

  return sails
    .filter((row) => row?.sail_code && isValidDateValue(row?.sail_date_from) && (row?.ship_name || row?.ship_code))
    .map((row) => {
      const sailCode = String(row.sail_code);
      const resolvedReference = referenceBySailCode.get(sailCode);
      const referenceSailCode = resolvedReference || sailCode;
      const monthKey = toMonthKey(row.sail_date_from);
      const portFrom = String(row.port_from || '').trim();
      const portTo = String(row.port_to || '').trim();
      const route = portFrom || portTo ? `${portFrom || '?'}-${portTo || '?'}` : '';
      return {
        ...row,
        route,
        guests: guestsBySailCode.get(sailCode) || 0,
        reference_sail_code: referenceSailCode,
        reference_source: resolvedReference ? 'inventory_item' : 'derived_from_sail_code',
        departure_month_key: monthKey,
        departure_month_label: toMonthLabel(monthKey),
        ship_group_label: row.ship_name || row.ship_code || 'Unknown ship',
      };
    });
};

