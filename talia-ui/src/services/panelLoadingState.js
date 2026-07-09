/**
 * Per-panel loading state for Dockview tab indicators.
 * Multiple concurrent sources (e.g. several useTableDataWithContext calls) are merged per panel.
 */

import { REPORT_PANEL_LOADING_EVENT } from '../components/dockview/eventConstants';

const getPanelKey = (panelInstanceId, panelComponentId) => panelInstanceId || panelComponentId || null;

const getSourcesStore = () => {
  if (typeof window === 'undefined') return {};
  if (!window.__taliaPanelLoadingSources) {
    window.__taliaPanelLoadingSources = {};
  }
  return window.__taliaPanelLoadingSources;
};

const getLoadingStateStore = () => {
  if (typeof window === 'undefined') return {};
  if (!window.__taliaPanelLoadingState) {
    window.__taliaPanelLoadingState = {};
  }
  return window.__taliaPanelLoadingState;
};

const emitLoadingChanged = (panelInstanceId, panelComponentId, loading) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REPORT_PANEL_LOADING_EVENT, {
    detail: {
      panelInstanceId: panelInstanceId || null,
      panelComponentId: panelComponentId || null,
      loading: loading === true,
    },
  }));
};

const setPanelLoadingFlag = (panelKey, loading) => {
  const stateStore = getLoadingStateStore();
  const prev = stateStore[panelKey] === true;
  if (loading) {
    stateStore[panelKey] = true;
  } else {
    delete stateStore[panelKey];
  }
  window.__taliaPanelLoadingState = stateStore;
  return prev;
};

/**
 * Mark one loading source active/inactive for a panel instance.
 * @param {string|null} panelInstanceId
 * @param {string|null} panelComponentId
 * @param {string} sourceId - stable id per hook instance (e.g. React useId)
 * @param {boolean} loading
 */
export function syncPanelLoadingSource(panelInstanceId, panelComponentId, sourceId, loading) {
  const panelKey = getPanelKey(panelInstanceId, panelComponentId);
  if (!panelKey || !sourceId) return;

  const sourcesStore = getSourcesStore();
  const panelSources = { ...(sourcesStore[panelKey] || {}) };

  if (loading) {
    panelSources[sourceId] = true;
  } else {
    delete panelSources[sourceId];
  }

  if (Object.keys(panelSources).length > 0) {
    sourcesStore[panelKey] = panelSources;
  } else {
    delete sourcesStore[panelKey];
  }
  window.__taliaPanelLoadingSources = sourcesStore;

  const nextLoading = Object.keys(panelSources).length > 0;
  const prevLoading = setPanelLoadingFlag(panelKey, nextLoading);
  if (prevLoading !== nextLoading) {
    emitLoadingChanged(panelInstanceId, panelComponentId, nextLoading);
  }
}

export function resolvePanelLoading(panelInstanceId, panelComponentId) {
  const stateStore = getLoadingStateStore();
  if (panelInstanceId && stateStore[panelInstanceId] === true) {
    return true;
  }
  if (!panelInstanceId && panelComponentId && stateStore[panelComponentId] === true) {
    return true;
  }
  return false;
}

/** Prefer Dockview instance id when matching loading events to tabs. */
export function panelLoadingEventMatches(panelId, panelComponent, detail = {}) {
  const targetPanelId = detail.panelInstanceId || null;
  const targetPanelComponent = detail.panelComponentId || null;
  if (targetPanelId) {
    return panelId === targetPanelId;
  }
  return !!(targetPanelComponent && panelComponent === targetPanelComponent);
}
