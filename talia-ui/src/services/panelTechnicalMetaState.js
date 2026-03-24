/**
 * Per-panel technical / dev visibility (dock tab ⓘ → ReportEventMeta).
 * Independent from user-facing “details” (data tables) controlled by header ≣.
 */

export function resolveTechnicalMetaVisible(panelInstanceId, panelComponentId) {
  const store = typeof window !== 'undefined' ? window.__taliaPanelTechnicalMetaVisibility || {} : {};
  if (panelInstanceId && Object.prototype.hasOwnProperty.call(store, panelInstanceId)) {
    return store[panelInstanceId] === true;
  }
  if (panelComponentId && Object.prototype.hasOwnProperty.call(store, panelComponentId)) {
    return store[panelComponentId] === true;
  }
  return false;
}

export function setPanelTechnicalMetaVisible(panelInstanceId, panelComponentId, visible) {
  if (typeof window === 'undefined') return;
  const on = visible === true;
  const next = { ...(window.__taliaPanelTechnicalMetaVisibility || {}) };
  if (panelInstanceId) next[panelInstanceId] = on;
  if (panelComponentId) next[panelComponentId] = on;
  window.__taliaPanelTechnicalMetaVisibility = next;
}
