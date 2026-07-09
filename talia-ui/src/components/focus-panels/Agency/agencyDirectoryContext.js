/**
 * Agency Directory — selection context and client-side filtering.
 *
 * Agency rows come from dwh.Dim_Agency. Sail/reservation links are indirect:
 * reservation_current_state (and reservation) carry sail_code + agency_id, so
 * agencies "for a sailing" are the distinct agency_id values on bookings for
 * that sail scope.
 */

export const AGENCY_SELECTION_MODES = {
  ALL: 'all',
  SAIL: 'sail',
  RESERVATION: 'reservation',
};

/** Prefer enriched canonical_scope.sail_codes; never re-derive master/segment in UI. */
export const resolveSailCodesFromDetail = (detail) => {
  const scope = detail?.canonical_scope;
  if (Array.isArray(scope?.sail_codes) && scope.sail_codes.length > 0) {
    return scope.sail_codes
      .map((code) => String(code).trim())
      .filter(Boolean);
  }
  const candidates = [
    detail?.sail_code,
    detail?.Sail_Code,
    detail?.row_data?.sail_code,
    detail?.row_data?.Sail_Code,
  ];
  for (const candidate of candidates) {
    if (candidate == null || candidate === '') continue;
    const normalized = String(candidate).trim();
    if (normalized) return [normalized];
  }
  return [];
};

export const resolveReferenceSailCodeFromDetail = (detail) => {
  const scope = detail?.canonical_scope;
  if (scope?.reference_sail_code) return String(scope.reference_sail_code);
  if (detail?.reference_sail_code) return String(detail.reference_sail_code);
  return null;
};

export const resolveAgencyIdFromDetail = (detail) => {
  const agencyId = detail?.row_data?.agency_id ?? detail?.agency_id;
  if (agencyId === undefined || agencyId === null || agencyId === '') return null;
  return String(agencyId);
};

export const resolveReservationIdFromDetail = (detail) => {
  const resId = detail?.row_data?.res_id ?? detail?.res_id;
  if (resId === undefined || resId === null || resId === '') return null;
  return String(resId);
};

export const mapSailCodesToReservationFilters = (sailCodes) => {
  const codes = (sailCodes || []).map((code) => String(code).trim()).filter(Boolean);
  if (codes.length === 0) return null;
  if (codes.length === 1) return { sail_code: codes[0] };
  return { sail_codes: codes };
};

/** Stable scope key for matching sail reservation fetches to the active selection. */
export const buildSailScopeKey = (sailCodes) => {
  const codes = (sailCodes || []).map((code) => String(code).trim()).filter(Boolean);
  if (codes.length === 0) return null;
  return [...codes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join('|');
};

export const buildSailScopeKeyFromDetail = (detail) => (
  buildSailScopeKey(resolveSailCodesFromDetail(detail))
);

export const collectAgencyIdsFromReservations = (rows) => {
  const ids = new Set();
  for (const row of rows || []) {
    const agencyId = row?.agency_id;
    if (agencyId === undefined || agencyId === null || agencyId === '') continue;
    ids.add(String(agencyId));
  }
  return ids;
};

export const filterAgenciesByIds = (agencies, agencyIds) => {
  if (!agencyIds || agencyIds.size === 0) return [];
  return (agencies || []).filter((row) => agencyIds.has(String(row?.agency_id)));
};

export const filterAgenciesForReservation = (agencies, agencyId) => {
  if (agencyId == null || agencyId === '') return agencies || [];
  return filterAgenciesByIds(agencies, new Set([String(agencyId)]));
};

export const resolveAgencyDirectoryData = ({
  agencies = [],
  reservationAgencyId = null,
  sailReservationRows = [],
  hasSailSelection = false,
  expectedReservationFiltersKey = null,
  loadedReservationFiltersKey = null,
  sailReservationsLoading = false,
}) => {
  if (reservationAgencyId) {
    return {
      mode: AGENCY_SELECTION_MODES.RESERVATION,
      rows: filterAgenciesForReservation(agencies, reservationAgencyId),
      pendingSailScope: false,
    };
  }

  if (hasSailSelection) {
    const scopeReady = !sailReservationsLoading
      && expectedReservationFiltersKey != null
      && loadedReservationFiltersKey != null
      && expectedReservationFiltersKey === loadedReservationFiltersKey;
    if (!scopeReady) {
      return {
        mode: AGENCY_SELECTION_MODES.SAIL,
        rows: [],
        pendingSailScope: true,
      };
    }
    const agencyIds = collectAgencyIdsFromReservations(sailReservationRows);
    return {
      mode: AGENCY_SELECTION_MODES.SAIL,
      rows: filterAgenciesByIds(agencies, agencyIds),
      pendingSailScope: false,
    };
  }

  return {
    mode: AGENCY_SELECTION_MODES.ALL,
    rows: agencies || [],
    pendingSailScope: false,
  };
};
