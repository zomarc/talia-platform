export const SAIL_SELECT_EVENT = 'talia:sail.select';
export const SAIL_CLEAR_EVENT = 'talia:sail.clear';
export const CABIN_SELECT_EVENT = 'talia:cabin.select';
export const CABIN_CLEAR_EVENT = 'talia:cabin.clear';

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

export const emitSailSelect = (detail) => {
  try {
    // Persist last sail select for late listeners (app & test)
    window.lastSailSelectEvent = { type: SAIL_SELECT_EVENT, detail };
    window.dispatchEvent(new CustomEvent(SAIL_SELECT_EVENT, { detail }));
  } catch (error) {
    console.warn('[eventBus] emitSailSelect failed', error);
  }
};

export const emitSailClear = (detail = {}) => {
  try {
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
