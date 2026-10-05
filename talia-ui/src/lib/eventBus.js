import {
  enrichSelectionDetail,
  ensureInventoryIndex,
  isInventoryIndexReady,
} from '../services/data/inventoryReferenceService';

export const SAIL_SELECT_EVENT = 'talia:sail.select';
export const SAIL_CLEAR_EVENT = 'talia:sail.clear';
export const SHIP_SELECT_EVENT = 'talia:ship.select';
export const SHIP_CLEAR_EVENT = 'talia:ship.clear';
export const CABIN_SELECT_EVENT = 'talia:cabin.select';
export const CABIN_CLEAR_EVENT = 'talia:cabin.clear';
export const RESERVATION_SELECT_EVENT = 'talia:reservation.select';
export const RESERVATION_CLEAR_EVENT = 'talia:reservation.clear';

const resolveSelectionIdentity = (detail) => {
  if (detail == null) return null;
  if (typeof detail === 'string') {
    const text = detail.trim();
    return text || null;
  }
  if (typeof detail !== 'object') return null;
  const row = detail.row_data && typeof detail.row_data === 'object' ? detail.row_data : {};
  const candidate = detail.reference_sail_code
    || detail.sail_code
    || detail.Sail_Code
    || row.reference_sail_code
    || row.sail_code
    || row.Sail_Code
    || detail.ship_code
    || detail.Ship_Code
    || row.ship_code
    || row.Ship_Code
    || null;
  if (candidate == null || candidate === '') return null;
  return String(candidate).trim() || null;
};

/**
 * Dispatch a selection event after translating it through the canonical
 * inventory_item layer. Every sail/ship selection carries reference_sail_code,
 * ship_code, ship_name, sail_codes[] and a canonical_scope for listeners.
 * If the index is not primed yet, we dispatch immediately and re-dispatch once
 * the translation becomes available (so no click is ever dropped).
 * Late enrichment must not overwrite a newer selection that arrived meanwhile.
 */
const dispatchCanonicalSelection = (type, rawDetail, lastEventKey) => {
  const detail = enrichSelectionDetail(rawDetail);
  const emitIdentity = resolveSelectionIdentity(rawDetail) || resolveSelectionIdentity(detail);
  window[lastEventKey] = { type, detail };
  window.dispatchEvent(new CustomEvent(type, { detail }));

  if (!isInventoryIndexReady()) {
    ensureInventoryIndex()
      .then(() => {
        const current = window[lastEventKey]?.detail;
        const currentIdentity = resolveSelectionIdentity(current);
        // Drop stale enrichment if the user already selected something else.
        if (emitIdentity && currentIdentity && emitIdentity !== currentIdentity) {
          return;
        }
        const enriched = enrichSelectionDetail(rawDetail);
        const gainedScope = enriched?.canonical_scope
          && (enriched.ship_code !== detail?.ship_code
            || enriched.reference_sail_code !== detail?.reference_sail_code);
        if (gainedScope) {
          // Re-check after enrich — another select may have won the race.
          const latestIdentity = resolveSelectionIdentity(window[lastEventKey]?.detail);
          if (emitIdentity && latestIdentity && emitIdentity !== latestIdentity) {
            return;
          }
          window[lastEventKey] = { type, detail: enriched };
          window.dispatchEvent(new CustomEvent(type, { detail: enriched }));
        }
      })
      .catch(() => { /* noop */ });
  }
  return detail;
};

export const AGENCY_SELECT_EVENT = 'talia:agency.select';
export const AGENCY_CLEAR_EVENT = 'talia:agency.clear';

export const emitAgencySelect = (detail) => {
  try {
    window.lastAgencySelectEvent = { type: AGENCY_SELECT_EVENT, detail };
    window.dispatchEvent(new CustomEvent(AGENCY_SELECT_EVENT, { detail }));
  } catch (error) {
    console.warn('[eventBus] emitAgencySelect failed', error);
  }
};

export const emitAgencyClear = (detail = {}) => {
  try {
    window.lastAgencySelectEvent = null;
    window.dispatchEvent(new CustomEvent(AGENCY_CLEAR_EVENT, { detail }));
  } catch (error) {
    console.warn('[eventBus] emitAgencyClear failed', error);
  }
};

export const extractSailCodeFromEvent = (detail) => (
  detail?.sail_code
  || detail?.Sail_Code
  || detail?.reference_sail_code
  || detail?.canonical_scope?.reference_sail_code
  || detail?.row_data?.sail_code
  || detail?.row_data?.reference_sail_code
  || (typeof detail === 'string' ? detail : null)
);

export const extractShipCodeFromEvent = (detail) => {
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

export const emitShipSelect = (detail) => {
  try {
    dispatchCanonicalSelection(SHIP_SELECT_EVENT, detail, 'lastShipSelectEvent');
  } catch (error) {
    console.warn('[eventBus] emitShipSelect failed', error);
  }
};

export const emitShipClear = (detail = {}) => {
  try {
    window.lastShipSelectEvent = null;
    window.dispatchEvent(new CustomEvent(SHIP_CLEAR_EVENT, { detail }));
  } catch (error) {
    console.warn('[eventBus] emitShipClear failed', error);
  }
};

export const emitReservationSelect = (detail) => {
  try {
    const payload = detail && typeof detail === 'object' ? detail : {};
    window.lastReservationSelectEvent = { type: RESERVATION_SELECT_EVENT, detail: payload };
    window.dispatchEvent(new CustomEvent(RESERVATION_SELECT_EVENT, { detail: payload }));
  } catch (error) {
    console.warn('[eventBus] emitReservationSelect failed', error);
  }
};

export const emitReservationClear = (detail = {}) => {
  try {
    const reason = detail?.reason || 'reservation-cleared';
    const timestamp = detail?.timestamp || new Date().toISOString();
    window.lastReservationSelectEvent = null;
    window.dispatchEvent(new CustomEvent(RESERVATION_CLEAR_EVENT, {
      detail: { ...detail, reason, timestamp },
    }));

    // Booking deselect → sail-scoped agency view (and drop explorer focus).
    emitAgencyClear({ reason, timestamp });

    // Primary booking clear also drops cabin focus so CDI / DA revert.
    // Skip when cabin or sail already owns the cascade (avoids loops).
    if (
      reason === 'cabin-cleared'
      || reason === 'cabin-select-no-res'
      || reason === 'sail-scope-changed'
    ) {
      return;
    }
    if (window.lastCabinSelectEvent) {
      emitCabinClear({
        reason: 'reservation-cleared',
        timestamp,
        source: detail?.source || null,
      });
    }
  } catch (error) {
    console.warn('[eventBus] emitReservationClear failed', error);
  }
};

/**
 * A new sailing (or sail clear) invalidates any reservation selected under a
 * previous sail. Clear once per sail emit so listeners fall back to sailing view.
 */
const clearReservationForSailScopeChange = () => {
  if (!window.lastReservationSelectEvent) return;
  emitReservationClear({
    reason: 'sail-scope-changed',
    timestamp: new Date().toISOString(),
  });
};

/** Sail scope change also drops cabin selection (CDI / Direct Availability). */
const clearCabinForSailScopeChange = () => {
  if (!window.lastCabinSelectEvent) return;
  emitCabinClear({
    reason: 'sail-scope-changed',
    timestamp: new Date().toISOString(),
  });
};

export const emitSailSelect = (detail) => {
  try {
    clearReservationForSailScopeChange();
    clearCabinForSailScopeChange();
    // Translate through inventory_item, persist for late listeners, then dispatch.
    dispatchCanonicalSelection(SAIL_SELECT_EVENT, detail, 'lastSailSelectEvent');
  } catch (error) {
    console.warn('[eventBus] emitSailSelect failed', error);
  }
};

export const emitSailClear = (detail = {}) => {
  try {
    clearReservationForSailScopeChange();
    clearCabinForSailScopeChange();
    window.lastSailSelectEvent = null;
    window.dispatchEvent(new CustomEvent(SAIL_CLEAR_EVENT, { detail }));
  } catch (error) {
    console.warn('[eventBus] emitSailClear failed', error);
  }
};

export const emitCabinSelect = (detail) => {
  try {
    const payload = detail && typeof detail === 'object' ? detail : {};
    window.lastCabinSelectEvent = { type: CABIN_SELECT_EVENT, detail: payload };
    window.dispatchEvent(new CustomEvent(CABIN_SELECT_EVENT, { detail: payload }));

    // FIT cabin with a reservation id → narrow reservation (Agency / RCS).
    const resId = payload.res_id ?? payload.dlgt_res_id ?? payload.row_data?.res_id ?? null;
    if (resId != null && String(resId).trim() !== '') {
      emitReservationSelect({
        res_id: resId,
        agency_id: payload.agency_id ?? payload.row_data?.agency_id ?? null,
        cabin_number: payload.cabin_number ?? null,
        row_data: {
          ...(payload.row_data && typeof payload.row_data === 'object' ? payload.row_data : {}),
          res_id: resId,
          agency_id: payload.agency_id ?? payload.row_data?.agency_id ?? null,
        },
        reason: 'cabin-select',
        timestamp: payload.timestamp || new Date().toISOString(),
      });
      return;
    }

    // GTY / empty cabin — drop any reservation narrow so reports return to sail scope.
    if (window.lastReservationSelectEvent) {
      emitReservationClear({
        reason: 'cabin-select-no-res',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.warn('[eventBus] emitCabinSelect failed', error);
  }
};

export const MEMO_CREATE_EVENT = 'talia:memo.create';

/**
 * Ask Inventory Memo to store a note. The payload is a point-in-time snapshot:
 * author, timestamp, and the text the sender composed.
 */
export const emitMemoCreate = (detail = {}) => {
  try {
    const payload = {
      ...(detail && typeof detail === 'object' ? detail : {}),
      createdAt: detail?.createdAt || new Date().toISOString(),
    };
    window.dispatchEvent(new CustomEvent(MEMO_CREATE_EVENT, { detail: payload }));
    return payload;
  } catch (error) {
    console.warn('[eventBus] emitMemoCreate failed', error);
    return null;
  }
};

export const emitCabinClear = (detail = {}) => {
  try {
    const reason = detail?.reason || 'cabin-cleared';
    const timestamp = detail?.timestamp || new Date().toISOString();
    window.lastCabinSelectEvent = null;
    window.dispatchEvent(new CustomEvent(CABIN_CLEAR_EVENT, { detail: { ...detail, reason, timestamp } }));

    // Always clear agency explorer highlight driven by cabin focus.
    emitAgencyClear({ reason, timestamp });

    // Sail / reservation already cleared the booking; avoid a second clear loop.
    if (reason === 'sail-scope-changed' || reason === 'reservation-cleared') return;
    if (window.lastReservationSelectEvent) {
      emitReservationClear({ reason: 'cabin-cleared', timestamp });
    }
  } catch (error) {
    console.warn('[eventBus] emitCabinClear failed', error);
  }
};
