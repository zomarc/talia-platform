export const CHECKLIST_SCOPE_THIS = 'this';
export const CHECKLIST_SCOPE_NEIGHBORS = 'neighbors';
export const CHECKLIST_SCOPE_ALL = 'all';
export const CHECKLIST_SELECT_ORIGIN = 'rm-checklist';

/** Same ship, this many master departures on each side of the focus sailing. */
export const CHECKLIST_NEIGHBOR_RADIUS = 2;

/** @deprecated use CHECKLIST_SCOPE_THIS */
export const CHECKLIST_SCOPE_SAILING = CHECKLIST_SCOPE_THIS;
/** @deprecated use CHECKLIST_SCOPE_ALL */
export const CHECKLIST_SCOPE_HORIZON = CHECKLIST_SCOPE_ALL;

const clean = (value) => {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
};

const dateKey = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length >= 10 ? text.slice(0, 10) : text;
};

export const findingSailDate = (finding) => dateKey(
  finding?.subject?.sail_date_from
  || finding?.sail_date_from
  || finding?.evidence?.sail_date_from
  || null
);

export const findingShipCode = (finding) => {
  const raw = finding?.subject?.ship_code || finding?.ship_code || null;
  return raw ? String(raw).trim().toUpperCase() : null;
};

export const findingSailCode = (finding) => clean(
  finding?.subjectId
  || finding?.subject?.id
  || finding?.subject?.sail_code
  || finding?.sail_code
  || null
);

const isMasterInventoryRow = (row) => {
  const sail = clean(row?.sail_code);
  if (!sail) return false;
  const reference = clean(row?.reference_sail_code) || sail;
  const role = String(row?.sailing_role || '').trim().toLowerCase();
  if (role && role !== 'master' && role !== 'main') return false;
  return sail === reference;
};

/**
 * Masters on one ship, ordered by departure. Used to find calendar neighbors.
 */
export const listShipMasterSailings = (inventoryRows = [], shipCode = null) => {
  const ship = clean(shipCode)?.toUpperCase() || null;
  const byCode = new Map();
  (inventoryRows || []).forEach((row) => {
    if (!isMasterInventoryRow(row)) return;
    const rowShip = clean(row?.ship_code)?.toUpperCase() || null;
    if (ship && rowShip && rowShip !== ship) return;
    const code = clean(row.sail_code);
    const existing = byCode.get(code);
    const next = {
      sail_code: code,
      ship_code: rowShip,
      ship_name: clean(row?.ship_name),
      sail_date_from: dateKey(row?.sail_date_from),
    };
    if (!existing || (next.sail_date_from && (!existing.sail_date_from || next.sail_date_from < existing.sail_date_from))) {
      byCode.set(code, next);
    }
  });
  return [...byCode.values()].sort((a, b) => {
    const da = a.sail_date_from || '';
    const db = b.sail_date_from || '';
    if (da !== db) return da.localeCompare(db);
    return a.sail_code.localeCompare(b.sail_code);
  });
};

export const resolveFocusSailing = (selectedSailCode, inventoryRows = []) => {
  const code = clean(selectedSailCode);
  if (!code) return null;
  const match = (inventoryRows || []).find((row) => {
    const sail = clean(row?.sail_code);
    const reference = clean(row?.reference_sail_code);
    return sail === code || reference === code;
  });
  return {
    sail_code: clean(match?.reference_sail_code) || clean(match?.sail_code) || code,
    ship_code: clean(match?.ship_code)?.toUpperCase() || null,
    ship_name: clean(match?.ship_name),
    sail_date_from: dateKey(match?.sail_date_from),
  };
};

/**
 * Focus sailing plus adjacent master departures on the same ship.
 */
export const sailingsFromFindings = (findings = []) => {
  const byCode = new Map();
  (findings || []).forEach((finding) => {
    const code = findingSailCode(finding);
    if (!code) return;
    const next = {
      sail_code: code,
      ship_code: findingShipCode(finding),
      ship_name: null,
      sail_date_from: findingSailDate(finding),
    };
    const existing = byCode.get(code);
    if (!existing || (next.sail_date_from && !existing.sail_date_from)) {
      byCode.set(code, next);
    }
  });
  return [...byCode.values()];
};

export const resolveNeighborSailCodes = (
  selectedSailCode,
  inventoryRows = [],
  { radius = CHECKLIST_NEIGHBOR_RADIUS, extraSailings = [], shipCode = null } = {}
) => {
  const focus = resolveFocusSailing(selectedSailCode, inventoryRows);
  const focusCode = focus?.sail_code || clean(selectedSailCode);
  if (!focusCode) return [];
  const merged = [
    ...(inventoryRows || []),
    ...extraSailings.map((row) => ({
      ...row,
      reference_sail_code: row.reference_sail_code || row.sail_code,
      sailing_role: row.sailing_role || 'master',
    })),
  ];
  const shipMasters = listShipMasterSailings(
    merged,
    shipCode || focus?.ship_code || extraSailings.find((row) => row.sail_code === focusCode)?.ship_code
  );
  const index = shipMasters.findIndex((row) => row.sail_code === focusCode);
  if (index < 0) return [focusCode];
  const from = Math.max(0, index - radius);
  const to = Math.min(shipMasters.length, index + radius + 1);
  return shipMasters.slice(from, to).map((row) => row.sail_code);
};

export const uniqueSailCodes = (...groups) => {
  const seen = new Set();
  const next = [];
  groups.flat().forEach((value) => {
    const code = clean(value);
    if (!code || seen.has(code)) return;
    seen.add(code);
    next.push(code);
  });
  return next;
};

export const buildFindingSailSelectDetail = (finding) => {
  const code = findingSailCode(finding);
  if (!code) return null;
  const shipCode = findingShipCode(finding);
  const sailDate = findingSailDate(finding);
  return {
    sail_code: code,
    reference_sail_code: clean(finding?.subject?.reference_sail_code) || code,
    ship_code: shipCode,
    ship_name: clean(finding?.subject?.ship_name),
    sail_date_from: sailDate,
    row_data: {
      sail_code: code,
      reference_sail_code: clean(finding?.subject?.reference_sail_code) || code,
      ship_code: shipCode,
      ship_name: clean(finding?.subject?.ship_name),
      sail_date_from: sailDate,
    },
    selection_origin: CHECKLIST_SELECT_ORIGIN,
    timestamp: new Date().toISOString(),
  };
};

export const filterFindingsBySailCodes = (findings, sailCodes = []) => {
  const allowed = new Set((sailCodes || []).map(clean).filter(Boolean));
  if (!allowed.size) return [];
  return (findings || []).filter((row) => {
    const code = findingSailCode(row);
    const reference = clean(row?.subject?.reference_sail_code);
    return (code && allowed.has(code)) || (reference && allowed.has(reference));
  });
};

export const sortFindingsWithFocusFirst = (findings, focusSailCode) => {
  const focus = clean(focusSailCode);
  return [...(findings || [])].sort((a, b) => {
    const aFocus = findingSailCode(a) === focus ? 0 : 1;
    const bFocus = findingSailCode(b) === focus ? 0 : 1;
    if (aFocus !== bFocus) return aFocus - bFocus;
    const scoreDelta = Number(b?.score || 0) - Number(a?.score || 0);
    if (scoreDelta) return scoreDelta;
    return String(findingSailCode(a) || '').localeCompare(String(findingSailCode(b) || ''));
  });
};

export const filterFindingsByHorizon = (findings, {
  dateFrom = null,
  dateTo = null,
  shipCode = null,
} = {}) => {
  const from = dateFrom ? String(dateFrom).slice(0, 10) : null;
  const to = dateTo ? String(dateTo).slice(0, 10) : null;
  const shipRaw = shipCode ? String(shipCode).trim() : '';
  const ship = shipRaw && shipRaw.toLowerCase() !== 'all' && shipRaw !== '*'
    ? shipRaw.toUpperCase()
    : null;
  return (findings || []).filter((row) => {
    const date = findingSailDate(row);
    if (from && date && date < from) return false;
    if (to && date && date > to) return false;
    const rowShip = findingShipCode(row);
    if (ship && rowShip && rowShip !== ship) return false;
    return true;
  });
};
