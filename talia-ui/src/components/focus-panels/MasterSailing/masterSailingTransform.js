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

const buildInventoryContext = (inventoryItems) => {
  const bySailCode = new Map();
  const segmentCountByMaster = new Map();

  asArray(inventoryItems).forEach((row) => {
    const sailCode = String(row?.sail_code || '').trim();
    if (!sailCode) return;

    bySailCode.set(sailCode, {
      referenceSailCode: row?.reference_sail_code || sailCode,
      sailingRole: row?.sailing_role || null,
      isOperational: row?.is_operational !== false,
      parentInventoryItemId: row?.parent_inventory_item_id || null,
    });

    if (row?.sailing_role === 'segment' && row?.is_operational !== false) {
      const masterCode = String(row?.reference_sail_code || '').trim();
      if (masterCode) {
        segmentCountByMaster.set(masterCode, (segmentCountByMaster.get(masterCode) || 0) + 1);
      }
    }
  });

  return { bySailCode, segmentCountByMaster };
};

export const buildMasterSailingRows = (
  masterSailRows,
  inventoryItems,
  reservationRows = [],
  options = {}
) => {
  const { showSegments = false } = options;
  const sails = asArray(masterSailRows);
  const reservations = asArray(reservationRows);
  const { bySailCode, segmentCountByMaster } = buildInventoryContext(inventoryItems);

  const guestsBySailCode = reservations.reduce((acc, row) => {
    const sailCode = String(row?.sail_code || '').trim();
    if (!sailCode) return acc;
    const guests = Number.parseFloat(row?.guest_count);
    if (!Number.isFinite(guests)) return acc;
    acc.set(sailCode, (acc.get(sailCode) || 0) + guests);
    return acc;
  }, new Map());

  const guestsByReference = reservations.reduce((acc, row) => {
    const sailCode = String(row?.sail_code || '').trim();
    if (!sailCode) return acc;
    const guests = Number.parseFloat(row?.guest_count);
    if (!Number.isFinite(guests)) return acc;
    const inventory = bySailCode.get(sailCode);
    if (inventory && inventory.isOperational === false) return acc;
    const referenceSailCode = inventory?.referenceSailCode || sailCode;
    acc.set(referenceSailCode, (acc.get(referenceSailCode) || 0) + guests);
    return acc;
  }, new Map());

  return sails
    .filter((row) => row?.sail_code && isValidDateValue(row?.sail_date_from) && (row?.ship_name || row?.ship_code))
    .filter((row) => {
      const sailCode = String(row.sail_code);
      const inventory = bySailCode.get(sailCode);
      if (inventory && inventory.isOperational === false) return false;
      if (showSegments) return true;
      if (Number(row?.is_main) === 1) return true;
      return inventory?.sailingRole === 'master';
    })
    .map((row) => {
      const sailCode = String(row.sail_code);
      const inventory = bySailCode.get(sailCode);
      const referenceSailCode = inventory?.referenceSailCode || sailCode;
      const isMasterRow = Number(row?.is_main) === 1 || inventory?.sailingRole === 'master';
      const monthKey = toMonthKey(row.sail_date_from);
      const portFrom = String(row.port_from || '').trim();
      const portTo = String(row.port_to || '').trim();
      const route = portFrom || portTo ? `${portFrom || '?'}-${portTo || '?'}` : '';
      const segmentCount = isMasterRow ? (segmentCountByMaster.get(referenceSailCode) || 0) : 0;

      return {
        ...row,
        route,
        guests: isMasterRow
          ? (guestsByReference.get(referenceSailCode) || 0)
          : (guestsBySailCode.get(sailCode) || 0),
        reference_sail_code: referenceSailCode,
        sailing_role: inventory?.sailingRole || (Number(row?.is_main) === 1 ? 'master' : 'segment'),
        is_operational: inventory?.isOperational ?? true,
        segment_count: segmentCount,
        reference_source: inventory ? 'inventory_item' : 'derived_from_sail_code',
        departure_month_key: monthKey,
        departure_month_label: toMonthLabel(monthKey),
        ship_group_label: row.ship_name || row.ship_code || 'Unknown ship',
      };
    });
};
