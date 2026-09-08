/**
 * Immediate MSE selection helpers. Keep the emit payload small so listeners
 * can react in the same gesture without cloning the full explorer row.
 */

export const MSE_SELECT_DEBOUNCE_MS = 800;
export const MSE_SELECT_ORIGIN = 'master-sailing-explorer';

export const isMseExpandToggleEvent = (event) => (
  Boolean(event?.target?.closest?.('.tabulator-cell[tabulator-field="expand_toggle"]'))
);

export const resolveMseMasterCode = (rowData) => {
  if (!rowData || rowData.row_type !== 'master') return null;
  const code = rowData.reference_sail_code || rowData.sail_code;
  if (code == null) return null;
  const normalized = String(code).trim();
  return normalized || null;
};

export const shouldEmitMseSelection = (rowData, event) => {
  if (!rowData || rowData.row_type !== 'master') return false;
  if (isMseExpandToggleEvent(event)) return false;
  return Boolean(resolveMseMasterCode(rowData));
};

export const buildMseSailSelectDetail = (rowData) => {
  const code = resolveMseMasterCode(rowData);
  if (!code) return null;
  return {
    sail_code: code,
    reference_sail_code: code,
    segment_sail_codes: Array.isArray(rowData.segment_codes) ? rowData.segment_codes : [],
    sailing_role: rowData.sailing_role || null,
    ship_code: rowData.ship_code || null,
    ship_name: rowData.ship_name || rowData.ship_group_label || null,
    sail_date_from: rowData.sail_date_from || null,
    row_data: {
      sail_code: rowData.sail_code || code,
      reference_sail_code: code,
      ship_code: rowData.ship_code || null,
      ship_name: rowData.ship_name || rowData.ship_group_label || null,
      sail_date_from: rowData.sail_date_from || null,
      segment_codes: Array.isArray(rowData.segment_codes) ? rowData.segment_codes : [],
      sailing_role: rowData.sailing_role || null,
    },
    selection_origin: MSE_SELECT_ORIGIN,
    timestamp: new Date().toISOString(),
  };
};

export const shouldSkipDuplicateMseEmit = (lastEmit, code, now = Date.now()) => {
  if (!lastEmit || !code) return false;
  return lastEmit.code === code && (now - lastEmit.t) < MSE_SELECT_DEBOUNCE_MS;
};
