/**
 * Ship inventory allocation helpers.
 * allocation_owner_id is res_id (FIT / OBJ FIT) or group_id (GROUP).
 * inventory_request_type 'GTY ONLY' = group booked, cabin not assigned.
 */

export const OWNER_TYPE = {
  FIT: 'FIT',
  OBJ_FIT: 'OBJ FIT',
  GROUP: 'GROUP',
};

export const REQUEST_TYPE = {
  STANDARD: 'STANDARD',
  GTY_ONLY: 'GTY ONLY',
  WTL_ONLY: 'WTL ONLY',
};

export const normalizeRequestType = (value) => {
  const raw = String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (raw === 'GTYONLY' || raw === 'GTY ONLY') return REQUEST_TYPE.GTY_ONLY;
  if (raw === 'WTLONLY' || raw === 'WTL ONLY') return REQUEST_TYPE.WTL_ONLY;
  if (raw === 'STANDARD') return REQUEST_TYPE.STANDARD;
  return raw || null;
};

export const normalizeOwnerType = (value) => {
  const raw = String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (raw === 'OBJ FIT' || raw === 'OBJFIT') return OWNER_TYPE.OBJ_FIT;
  if (raw === 'FIT') return OWNER_TYPE.FIT;
  if (raw === 'GROUP') return OWNER_TYPE.GROUP;
  return raw || null;
};

export const isGroupOwner = (ownerType) => normalizeOwnerType(ownerType) === OWNER_TYPE.GROUP;

export const isFitOwner = (ownerType) => {
  const type = normalizeOwnerType(ownerType);
  return type === OWNER_TYPE.FIT || type === OWNER_TYPE.OBJ_FIT;
};

export const isGtyOnly = (requestType) => normalizeRequestType(requestType) === REQUEST_TYPE.GTY_ONLY;

export const hasAssignedCabin = (row) => {
  const cabin = String(row?.cabin_number || '').trim();
  return Boolean(cabin);
};

/**
 * Status for UI highlights.
 * - gty: group hold, no cabin
 * - group: group with assigned cabin
 * - fit: FIT reservation with cabin
 * - open: no owner / unknown
 */
export const resolveAllocationStatus = (row) => {
  const gty = isGtyOnly(row?.inventory_request_type);
  const group = isGroupOwner(row?.allocation_owner_type);
  const fit = isFitOwner(row?.allocation_owner_type);
  const assigned = hasAssignedCabin(row);

  if (gty || (group && !assigned)) {
    return {
      key: 'gty',
      label: 'GTY (unassigned)',
      owner_kind: group ? 'group' : (fit ? 'fit' : 'unknown'),
    };
  }
  if (group && assigned) {
    return {
      key: 'group',
      label: 'Group cabin',
      owner_kind: 'group',
    };
  }
  if (fit && assigned) {
    return {
      key: 'fit',
      label: 'FIT cabin',
      owner_kind: 'fit',
    };
  }
  if (assigned) {
    return {
      key: 'assigned',
      label: 'Assigned',
      owner_kind: fit ? 'fit' : (group ? 'group' : 'unknown'),
    };
  }
  return {
    key: 'open',
    label: 'Open / other',
    owner_kind: 'unknown',
  };
};

export const describeOwner = (row) => {
  const id = row?.allocation_owner_id;
  if (id == null || id === '') return '—';
  if (isGroupOwner(row?.allocation_owner_type)) return `Group ${id}`;
  if (isFitOwner(row?.allocation_owner_type)) return `Res ${id}`;
  return String(id);
};

export default {
  OWNER_TYPE,
  REQUEST_TYPE,
  normalizeRequestType,
  normalizeOwnerType,
  isGroupOwner,
  isFitOwner,
  isGtyOnly,
  hasAssignedCabin,
  resolveAllocationStatus,
  describeOwner,
};
