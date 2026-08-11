/**
 * Dashboard UI config bus — single snapshot for layout fit, chrome toggles,
 * view scope, and global criteria. Components conform via
 * `talia:dashboard.globalConfig` (legacy events re-dispatched as aliases).
 */

import {
  DASHBOARD_DETAILS_VISIBILITY_EVENT,
  DASHBOARD_FILTER_VISIBILITY_EVENT,
  DASHBOARD_GLOBAL_CONFIG_EVENT,
  DASHBOARD_TABULATOR_FILTER_VISIBILITY_EVENT,
  DASHBOARD_TABLE_LAYOUT_EVENT,
} from '../components/dockview/eventConstants';
import { getGlobalReportDetailsVisible } from './panelDetailsState';

const DASHBOARD_GLOBAL_CRITERIA_EVENT = 'talia:dashboard.globalCriteria';
const DASHBOARD_VIEW_SCOPE_EVENT = 'talia:dashboard.viewScope';
const FILTERS_VISIBILITY_STORAGE_KEY = 'taliaHeaderFiltersVisible';
const TABULATOR_FILTERS_VISIBILITY_STORAGE_KEY = 'taliaHeaderTabulatorFiltersVisible';
const TABLE_LAYOUT_STORAGE_KEY = 'taliaTableLayoutMode';
const TABLE_LAYOUT_MODES = ['best', 'width', 'data'];

const getBoolean = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

const readStoredBoolean = (storageKey, inMemory, fallback = true) => {
  let value = getBoolean(inMemory, fallback);
  try {
    const saved = window.localStorage?.getItem?.(storageKey);
    if (saved === '0' || saved === 'false') value = false;
    if (saved === '1' || saved === 'true') value = true;
  } catch {
    // ignore storage failures
  }
  return value;
};

const normalizeTableLayoutMode = (mode) => (
  TABLE_LAYOUT_MODES.includes(mode) ? mode : 'best'
);

/**
 * Build the current dashboard global config from window / storage / DOM flags.
 */
export const getDashboardGlobalConfig = () => {
  if (typeof window === 'undefined') {
    return {
      tableLayoutMode: 'best',
      filtersVisible: true,
      tabulatorFiltersVisible: true,
      detailsVisible: true,
      titlesVisible: true,
      calloutsVisible: false,
      chartLegendsVisible: true,
      actionsVisible: true,
      controlsVisible: true,
      viewScope: 'local',
      criteria: null,
      activePanelId: null,
      timestamp: new Date().toISOString(),
    };
  }

  const filtersVisible = readStoredBoolean(
    FILTERS_VISIBILITY_STORAGE_KEY,
    window.__taliaFiltersVisible,
    true
  );
  const tabulatorFiltersVisible = readStoredBoolean(
    TABULATOR_FILTERS_VISIBILITY_STORAGE_KEY,
    window.__taliaTabulatorFiltersVisible,
    true
  );

  let tableLayoutMode = normalizeTableLayoutMode(window.__taliaTableLayoutMode);
  try {
    const saved = window.localStorage?.getItem?.(TABLE_LAYOUT_STORAGE_KEY);
    if (TABLE_LAYOUT_MODES.includes(saved)) tableLayoutMode = saved;
  } catch {
    // ignore
  }

  const criteria = (
    window.__taliaGlobalCriteria && typeof window.__taliaGlobalCriteria === 'object'
      ? { ...window.__taliaGlobalCriteria }
      : null
  );

  return {
    tableLayoutMode,
    filtersVisible,
    tabulatorFiltersVisible,
    detailsVisible: getGlobalReportDetailsVisible(),
    titlesVisible: window.__taliaPanelTitlesVisible !== false,
    calloutsVisible: window.__taliaCalloutsVisible === true,
    chartLegendsVisible: window.__taliaChartLegendsVisible !== false,
    actionsVisible: window.__taliaActionsVisible !== false,
    controlsVisible: window.__taliaControlsVisible === true,
    viewScope: window.__taliaViewScope === 'wide' ? 'wide' : 'local',
    criteria,
    activePanelId: window.__taliaActivePanelId || null,
    timestamp: new Date().toISOString(),
  };
};

const applyChromeClasses = (config) => {
  const root = document.documentElement;
  root.classList.toggle('talia-filters-hidden', config.filtersVisible === false);
  root.classList.toggle('talia-tabulator-filters-hidden', config.tabulatorFiltersVisible === false);
  root.classList.toggle('talia-panel-titles-hidden', config.titlesVisible === false);
  root.classList.toggle('talia-callouts-hidden', config.calloutsVisible === false);
  root.classList.toggle('talia-chart-legends-hidden', config.chartLegendsVisible === false);
  root.classList.toggle('talia-actions-hidden', config.actionsVisible === false);
  root.classList.toggle('talia-controls-hidden', config.controlsVisible !== true);
};

const writeWindowSnapshots = (config) => {
  window.__taliaDashboardGlobalConfig = config;
  window.__taliaFiltersVisible = config.filtersVisible;
  window.__taliaTabulatorFiltersVisible = config.tabulatorFiltersVisible;
  window.__taliaTableLayoutMode = config.tableLayoutMode;
  window.__taliaPanelTitlesVisible = config.titlesVisible;
  window.__taliaCalloutsVisible = config.calloutsVisible;
  window.__taliaChartLegendsVisible = config.chartLegendsVisible;
  window.__taliaActionsVisible = config.actionsVisible;
  window.__taliaControlsVisible = config.controlsVisible;
  window.__taliaViewScope = config.viewScope;
  if (config.criteria && typeof config.criteria === 'object') {
    window.__taliaGlobalCriteria = config.criteria;
  }
  try {
    window.localStorage?.setItem?.(FILTERS_VISIBILITY_STORAGE_KEY, config.filtersVisible ? '1' : '0');
    window.localStorage?.setItem?.(
      TABULATOR_FILTERS_VISIBILITY_STORAGE_KEY,
      config.tabulatorFiltersVisible ? '1' : '0'
    );
    window.localStorage?.setItem?.(TABLE_LAYOUT_STORAGE_KEY, config.tableLayoutMode);
  } catch {
    // ignore
  }
};

const dispatchLegacyAliases = (config, partial = null) => {
  // Only re-fire aliases for fields that actually changed. A full publish
  // (no partial / empty partial) still fans out everything for boot/enforce.
  const keys = partial && typeof partial === 'object' ? Object.keys(partial) : [];
  const all = keys.length === 0;
  const changed = (key) => all || keys.includes(key);

  if (changed('filtersVisible')) {
    window.dispatchEvent(new CustomEvent(DASHBOARD_FILTER_VISIBILITY_EVENT, {
      detail: { visible: config.filtersVisible },
    }));
  }
  if (changed('tabulatorFiltersVisible')) {
    window.dispatchEvent(new CustomEvent(DASHBOARD_TABULATOR_FILTER_VISIBILITY_EVENT, {
      detail: { visible: config.tabulatorFiltersVisible },
    }));
  }
  if (changed('detailsVisible')) {
    window.dispatchEvent(new CustomEvent(DASHBOARD_DETAILS_VISIBILITY_EVENT, {
      detail: { scope: 'all', visible: config.detailsVisible, action: 'set' },
    }));
  }
  if (changed('tableLayoutMode')) {
    window.dispatchEvent(new CustomEvent(DASHBOARD_TABLE_LAYOUT_EVENT, {
      detail: { mode: config.tableLayoutMode },
    }));
  }
  if (changed('viewScope')) {
    window.dispatchEvent(new CustomEvent(DASHBOARD_VIEW_SCOPE_EVENT, {
      detail: { scope: config.viewScope },
    }));
  }
  if (changed('criteria') && config.criteria && typeof config.criteria === 'object') {
    window.dispatchEvent(new CustomEvent(DASHBOARD_GLOBAL_CRITERIA_EVENT, {
      detail: config.criteria,
    }));
  }
};

/**
 * Merge optional partial updates, persist snapshot, apply chrome, and publish
 * `talia:dashboard.globalConfig` (+ legacy aliases for changed fields only).
 */
export const publishDashboardGlobalConfig = (partial = {}, { dispatchLegacy = true } = {}) => {
  if (typeof window === 'undefined') return null;

  const base = getDashboardGlobalConfig();
  const patch = partial && typeof partial === 'object' ? partial : {};
  const changedKeys = Object.keys(patch);
  const next = {
    ...base,
    ...patch,
    tableLayoutMode: normalizeTableLayoutMode(
      patch.tableLayoutMode ?? base.tableLayoutMode
    ),
    timestamp: new Date().toISOString(),
    changedKeys,
  };
  if (Object.prototype.hasOwnProperty.call(patch, 'criteria')) {
    next.criteria = patch.criteria && typeof patch.criteria === 'object'
      ? { ...patch.criteria }
      : null;
  }

  writeWindowSnapshots(next);
  applyChromeClasses(next);

  window.dispatchEvent(new CustomEvent(DASHBOARD_GLOBAL_CONFIG_EVENT, {
    detail: next,
  }));

  if (dispatchLegacy) {
    dispatchLegacyAliases(next, patch);
  }

  return next;
};

/** @deprecated Prefer publishDashboardGlobalConfig */
export const enforceDashboardUiState = ({ dispatchEvents = true } = {}) => {
  if (typeof window === 'undefined') return;
  if (!dispatchEvents) {
    const config = getDashboardGlobalConfig();
    writeWindowSnapshots(config);
    applyChromeClasses(config);
    return;
  }
  publishDashboardGlobalConfig();
};
