export const SAIL_SELECT_EVENT = 'talia:sail.select';
export const SAIL_CLEAR_EVENT = 'talia:sail.clear';

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
