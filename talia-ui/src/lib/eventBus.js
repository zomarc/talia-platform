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

/**
 * Dispatch a selection event after translating it through the canonical
 * inventory_item layer. Every sail/ship selection carries reference_sail_code,
 * ship_code, ship_name, sail_codes[] and a canonical_scope for listeners.
 * If the index is not primed yet, we dispatch immediately and re-dispatch once
 * the translation becomes available (so no click is ever dropped).
 */
const dispatchCanonicalSelection = (type, rawDetail, lastEventKey) => {
  const detail = enrichSelectionDetail(rawDetail);
  window[lastEventKey] = { type, detail };
  window.dispatchEvent(new CustomEvent(type, { detail }));

  if (!isInventoryIndexReady()) {
    ensureInventoryIndex()
      .then(() => {
        const enriched = enrichSelectionDetail(rawDetail);
        const gainedScope = enriched?.canonical_scope
          && (enriched.ship_code !== detail?.ship_code
            || enriched.reference_sail_code !== detail?.reference_sail_code);
        if (gainedScope) {
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
  detail?.sail_code ||
  detail?.Sail_Code ||
  detail?.row_data?.sail_code ||
  (typeof detail === 'string' ? detail : null)
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
    window.lastReservationSelectEvent = null;
    window.dispatchEvent(new CustomEvent(RESERVATION_CLEAR_EVENT, { detail }));
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

export const emitSailSelect = (detail) => {
  try {
    clearReservationForSailScopeChange();
    // Translate through inventory_item, persist for late listeners, then dispatch.
    dispatchCanonicalSelection(SAIL_SELECT_EVENT, detail, 'lastSailSelectEvent');
  } catch (error) {
    console.warn('[eventBus] emitSailSelect failed', error);
  }
};

export const emitSailClear = (detail = {}) => {
  try {
    clearReservationForSailScopeChange();
    window.lastSailSelectEvent = null;
    window.dispatchEvent(new CustomEvent(SAIL_CLEAR_EVENT, { detail }));
  } catch (error) {
    console.warn('[eventBus] emitSailClear failed', error);
  }
};

export const emitCabinSelect = (detail) => {
  try {
    window.lastCabinSelectEvent = { type: CABIN_SELECT_EVENT, detail };
    window.dispatchEvent(new CustomEvent(CABIN_SELECT_EVENT, { detail }));
  } catch (error) {
    console.warn('[eventBus] emitCabinSelect failed', error);
  }
};

export const emitCabinClear = (detail = {}) => {
  try {
    window.lastCabinSelectEvent = null;
    window.dispatchEvent(new CustomEvent(CABIN_CLEAR_EVENT, { detail }));
  } catch (error) {
    console.warn('[eventBus] emitCabinClear failed', error);
  }
};
