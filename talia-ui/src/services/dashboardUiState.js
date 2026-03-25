import {
  DASHBOARD_DETAILS_VISIBILITY_EVENT,
  DASHBOARD_FILTER_VISIBILITY_EVENT,
  DASHBOARD_TABLE_LAYOUT_EVENT,
} from '../components/dockview/eventConstants';
import { getGlobalReportDetailsVisible } from './panelDetailsState';

const DASHBOARD_GLOBAL_CRITERIA_EVENT = 'talia:dashboard.globalCriteria';
const DASHBOARD_VIEW_SCOPE_EVENT = 'talia:dashboard.viewScope';
const FILTERS_VISIBILITY_STORAGE_KEY = 'taliaHeaderFiltersVisible';
const TABLE_LAYOUT_STORAGE_KEY = 'taliaTableLayoutMode';

const getBoolean = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

export const enforceDashboardUiState = ({ dispatchEvents = true } = {}) => {
  if (typeof window === 'undefined') return;

  const root = document.documentElement;
  const detailsVisible = getGlobalReportDetailsVisible();

  let filtersVisible = getBoolean(window.__taliaFiltersVisible, true);
  try {
    const saved = window.localStorage?.getItem?.(FILTERS_VISIBILITY_STORAGE_KEY);
    if (saved === '0' || saved === 'false') filtersVisible = false;
    if (saved === '1' || saved === 'true') filtersVisible = true;
  } catch {
    // ignore storage failures
  }
  window.__taliaFiltersVisible = filtersVisible;
  root.classList.toggle('talia-filters-hidden', filtersVisible === false);

  let tableLayoutMode = window.__taliaTableLayoutMode === 'data' ? 'data' : 'width';
  try {
    const saved = window.localStorage?.getItem?.(TABLE_LAYOUT_STORAGE_KEY);
    if (saved === 'data' || saved === 'width') tableLayoutMode = saved;
  } catch {
    // ignore storage failures
  }
  window.__taliaTableLayoutMode = tableLayoutMode;

  const criteria = window.__taliaGlobalCriteria || null;
  const viewScope = window.__taliaViewScope === 'wide' ? 'wide' : 'local';

  if (!dispatchEvents) return;

  window.dispatchEvent(new CustomEvent(DASHBOARD_FILTER_VISIBILITY_EVENT, {
    detail: { visible: filtersVisible },
  }));
  window.dispatchEvent(new CustomEvent(DASHBOARD_DETAILS_VISIBILITY_EVENT, {
    detail: { scope: 'all', visible: detailsVisible, action: 'set' },
  }));
  window.dispatchEvent(new CustomEvent(DASHBOARD_TABLE_LAYOUT_EVENT, {
    detail: { mode: tableLayoutMode },
  }));
  window.dispatchEvent(new CustomEvent(DASHBOARD_VIEW_SCOPE_EVENT, {
    detail: { scope: viewScope },
  }));
  if (criteria && typeof criteria === 'object') {
    window.dispatchEvent(new CustomEvent(DASHBOARD_GLOBAL_CRITERIA_EVENT, {
      detail: criteria,
    }));
  }
};

