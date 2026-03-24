/**
 * User-facing report “details” (header ≣): extra tables / data blocks.
 * Does not control technical ReportEventMeta (tab ⓘ) — see panelTechnicalMetaState.js.
 */

export const GLOBAL_REPORT_DETAILS_STORAGE_KEY = 'taliaGlobalReportDetailsVisible';

export function getGlobalReportDetailsVisible() {
  if (typeof window === 'undefined') return true;
  if (window.__taliaGlobalReportDetailsVisible !== undefined) {
    return window.__taliaGlobalReportDetailsVisible !== false;
  }
  try {
    const s = window.localStorage?.getItem?.(GLOBAL_REPORT_DETAILS_STORAGE_KEY);
    if (s === '0' || s === 'false') return false;
    if (s === '1' || s === 'true') return true;
  } catch {
    // ignore
  }
  return true;
}

export function setGlobalReportDetailsVisible(visible) {
  if (typeof window === 'undefined') return;
  const v = visible !== false;
  window.__taliaGlobalReportDetailsVisible = v;
  try {
    window.localStorage?.setItem?.(GLOBAL_REPORT_DETAILS_STORAGE_KEY, v ? '1' : '0');
  } catch {
    // ignore
  }
}

export function clearPanelReportDetailsOverrides() {
  if (typeof window === 'undefined') return;
  window.__taliaPanelDetailsVisibility = {};
}

/**
 * @param {string} [panelInstanceId]
 * @param {string} [panelComponentId]
 * @param {{ fallback?: boolean, respectGlobal?: boolean }} [options]
 */
export function resolveReportDetailsVisible(panelInstanceId, panelComponentId, options = {}) {
  const { fallback = true, respectGlobal = true } = options;
  const store = typeof window !== 'undefined' ? window.__taliaPanelDetailsVisibility || {} : {};
  if (panelInstanceId && Object.prototype.hasOwnProperty.call(store, panelInstanceId)) {
    return store[panelInstanceId] !== false;
  }
  if (panelComponentId && Object.prototype.hasOwnProperty.call(store, panelComponentId)) {
    return store[panelComponentId] !== false;
  }
  if (respectGlobal) return getGlobalReportDetailsVisible();
  return fallback;
}

export function setPanelReportDetailsOverride(panelInstanceId, panelComponentId, visible) {
  if (typeof window === 'undefined') return;
  const v = visible !== false;
  const next = { ...(window.__taliaPanelDetailsVisibility || {}) };
  if (panelInstanceId) next[panelInstanceId] = v;
  if (panelComponentId) next[panelComponentId] = v;
  window.__taliaPanelDetailsVisibility = next;
}
