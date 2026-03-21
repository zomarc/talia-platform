/**
 * StatusBar Component
 * 
 * Unified title bar at the top of the page showing:
 * - Focus save confirmations
 * - Current event from report selection
 * - Persisted event information
 * - Mode selection (integrated on the right)
 * - Clickable to view details
 */

import React, { useState, useEffect, useRef } from 'react';
import ModeSelector from '../ModeSelector';
import { canUseAdvancedHeader } from '../../utils/roleUtils';
import { REPORT_REFRESH_EVENT } from '../dockview/eventConstants';
import { useTheme } from '../../contexts/ThemeContext';
import userActivityTracker from '../../services/userActivityTracker';
import { loadUserProfileState, saveUserProfileState } from '../../services/data/userProfileState';
// CSS imported globally in main.jsx
const DASHBOARD_TOGGLE_SIDEBAR_EVENT = 'talia:dashboard.toggleSidebar';
const DASHBOARD_SIDEBAR_STATE_EVENT = 'talia:dashboard.sidebarState';
const DASHBOARD_FILTER_VISIBILITY_EVENT = 'talia:dashboard.filterVisibility';
const DASHBOARD_CYCLE_FOCUS_EVENT = 'talia:dashboard.cycleFocus';
const DASHBOARD_SELECT_FOCUS_EVENT = 'talia:dashboard.selectFocus';
const DASHBOARD_FOCUS_STATE_EVENT = 'talia:dashboard.focusState';
const DASHBOARD_SAVE_CURRENT_FOCUS_EVENT = 'talia:dashboard.saveCurrentFocus';
const DASHBOARD_VIEW_SCOPE_EVENT = 'talia:dashboard.viewScope';
const DASHBOARD_DETAILS_VISIBILITY_EVENT = 'talia:dashboard.detailsVisibility';
const DASHBOARD_GLOBAL_CRITERIA_EVENT = 'talia:dashboard.globalCriteria';
const DASHBOARD_TABLE_LAYOUT_EVENT = 'talia:dashboard.tableLayout';
const TABLE_LAYOUT_STORAGE_KEY = 'taliaTableLayoutMode';

const GLOBAL_DATE_RANGE_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: '30d', label: '30d' },
  { key: '60d', label: '60d' },
  { key: '120d', label: '120d' },
  { key: '6m', label: '6m' }
];
const GLOBAL_DURATION_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: '7', label: '7' },
  { key: '14', label: '14' },
  { key: '7-14', label: '7 & 14' },
  { key: '3', label: '3' },
  { key: '4', label: '4' },
  { key: '3-4', label: '3 & 4' }
];

const toIsoDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const resolveDateRange = (rangeKey) => {
  if (rangeKey === 'all') {
    return {
      dateFrom: '',
      dateTo: ''
    };
  }

  const now = new Date();
  const end = new Date(now);
  let start = new Date(now);

  if (rangeKey === '6m') {
    start.setMonth(start.getMonth() - 6);
  } else {
    const days = Number.parseInt(String(rangeKey || '').replace('d', ''), 10);
    const safeDays = Number.isFinite(days) && days > 0 ? days : 30;
    start.setDate(start.getDate() - safeDays);
  }

  return {
    dateFrom: toIsoDate(start),
    dateTo: toIsoDate(end)
  };
};

const HeaderCriteriaMenuSelect = ({
  id,
  options,
  value,
  onChange,
  ariaLabel,
  wide = false,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((option) => option.key === value) || options[0] || null;

  useEffect(() => {
    if (!open) return undefined;
    const handleOutsideClick = (event) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleOptionSelect = (nextValue) => {
    setOpen(false);
    if (nextValue === value) return;
    onChange(nextValue);
  };

  return (
    <div
      id={id}
      ref={rootRef}
      className={`status-bar__menu-select ${wide ? 'status-bar__menu-select--wide' : ''}`}
    >
      <button
        type="button"
        className="status-bar__menu-select-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="status-bar__menu-select-value">{selected?.label || '—'}</span>
        <span className="status-bar__menu-select-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="status-bar__menu-select-menu" role="menu" aria-label={ariaLabel}>
          {options.map((option) => {
            const isSelected = option.key === value;
            return (
              <button
                type="button"
                key={option.key}
                role="menuitemradio"
                aria-checked={isSelected}
                className={`status-bar__menu-select-option ${isSelected ? 'status-bar__menu-select-option--active' : ''}`}
                onClick={() => handleOptionSelect(option.key)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const StatusBar = ({
  statusMessage,
  currentEvent,
  persistedEvent,
  currentMode,
  onModeChange,
  dataStatus,
  userRole,
  canUseAdvancedControls
}) => {
  const {
    appearanceProfiles,
    activeAppearanceProfileId,
    applyAppearanceProfile,
  } = useTheme();
  const [showDetails, setShowDetails] = useState(false);
  const [displayMessage, setDisplayMessage] = useState(statusMessage);
  const [isMessageFading, setIsMessageFading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => !!window.__taliaSidebarCollapsed);
  const [filtersVisible, setFiltersVisible] = useState(() => window.__taliaFiltersVisible === true);
  const [eventsVisible, setEventsVisible] = useState(() => window.__taliaEventsVisible === true);
  const [criteriaVisible, setCriteriaVisible] = useState(() => window.__taliaCriteriaVisible === true);
  const [viewScope, setViewScope] = useState(() => window.__taliaViewScope === 'wide' ? 'wide' : 'local');
  const [globalDateRange, setGlobalDateRange] = useState(() => {
    const saved = window.__taliaGlobalCriteria?.rangeKey;
    return GLOBAL_DATE_RANGE_OPTIONS.some((option) => option.key === saved) ? saved : '30d';
  });
  const [globalDuration, setGlobalDuration] = useState(() => {
    const saved = window.__taliaGlobalCriteria?.durationKey;
    return GLOBAL_DURATION_OPTIONS.some((option) => option.key === saved) ? saved : 'all';
  });
  const [focusOptions, setFocusOptions] = useState(() => {
    const options = window.__taliaFocusState?.focuses;
    return Array.isArray(options) ? options.filter((focus) => focus?.id) : [];
  });
  const [selectedFocusId, setSelectedFocusId] = useState(() => window.__taliaFocusState?.currentFocusId || '');
  const [showSaveFocusConfirm, setShowSaveFocusConfirm] = useState(false);
  const [activeOnly, setActiveOnly] = useState(() => {
    const saved = window.__taliaGlobalCriteria;
    if (saved && Object.prototype.hasOwnProperty.call(saved, 'activeOnly')) {
      return saved.activeOnly !== false;
    }
    if (saved && Object.prototype.hasOwnProperty.call(saved, 'includeNonRealSailings')) {
      return saved.includeNonRealSailings !== true;
    }
    return true;
  });
  const [refreshPhase, setRefreshPhase] = useState('active'); // active -> all -> cooldown
  const [tableLayoutMode, setTableLayoutMode] = useState(() => {
    const inMemory = window.__taliaTableLayoutMode;
    if (inMemory === 'data' || inMemory === 'width') return inMemory;
    const saved = window.localStorage?.getItem?.(TABLE_LAYOUT_STORAGE_KEY);
    return saved === 'data' ? 'data' : 'width';
  });
  const refreshPhaseTimerRef = useRef(null);
  const criteriaSaveTimerRef = useRef(null);
  const messageFadeTimerRef = useRef(null);
  const messageHideTimerRef = useRef(null);
  const [profileCriteriaHydrated, setProfileCriteriaHydrated] = useState(false);
  const appVersion = import.meta.env.VITE_APP_VERSION || '0.1.6';
  const hasAdvancedControls = typeof canUseAdvancedControls === 'boolean'
    ? canUseAdvancedControls
    : canUseAdvancedHeader(userRole);

  // Update display message when statusMessage changes
  useEffect(() => {
    if (messageFadeTimerRef.current) {
      window.clearTimeout(messageFadeTimerRef.current);
      messageFadeTimerRef.current = null;
    }
    if (messageHideTimerRef.current) {
      window.clearTimeout(messageHideTimerRef.current);
      messageHideTimerRef.current = null;
    }
    if (statusMessage) {
      setDisplayMessage(statusMessage);
      setIsMessageFading(false);
      // Standard status-message lifecycle: visible for 9s, fade, then hide at 10s.
      messageFadeTimerRef.current = window.setTimeout(() => {
        setIsMessageFading(true);
      }, 9000);
      messageHideTimerRef.current = window.setTimeout(() => {
        setDisplayMessage(null);
        setIsMessageFading(false);
      }, 10000);
    } else {
      setDisplayMessage(null);
      setIsMessageFading(false);
    }
    return () => {
      if (messageFadeTimerRef.current) {
        window.clearTimeout(messageFadeTimerRef.current);
        messageFadeTimerRef.current = null;
      }
      if (messageHideTimerRef.current) {
        window.clearTimeout(messageHideTimerRef.current);
        messageHideTimerRef.current = null;
      }
    };
  }, [statusMessage]);

  useEffect(() => {
    const handleSidebarState = (event) => {
      const collapsed = event?.detail?.collapsed;
      if (typeof collapsed === 'boolean') {
        setSidebarCollapsed(collapsed);
      }
    };
    window.addEventListener(DASHBOARD_SIDEBAR_STATE_EVENT, handleSidebarState);
    return () => window.removeEventListener(DASHBOARD_SIDEBAR_STATE_EVENT, handleSidebarState);
  }, []);

  const handleSidebarToggle = () => {
    userActivityTracker.recordHeaderAction('sidebar-toggle', { status: sidebarCollapsed ? 'open' : 'close' });
    window.dispatchEvent(new CustomEvent(DASHBOARD_TOGGLE_SIDEBAR_EVENT));
  };

  const handleFiltersToggle = () => {
    const nextVisible = !filtersVisible;
    userActivityTracker.recordHeaderAction('filters-toggle', { status: nextVisible ? 'show' : 'hide' });
    setFiltersVisible(nextVisible);
  };

  const handleCycleFocus = () => {
    userActivityTracker.recordHeaderAction('focus-cycle');
    window.dispatchEvent(new CustomEvent(DASHBOARD_CYCLE_FOCUS_EVENT));
  };

  const handleQuickFocusChange = (nextValue) => {
    const focusId = typeof nextValue === 'string' ? nextValue : nextValue?.target?.value || '';
    setSelectedFocusId(focusId);
    setShowSaveFocusConfirm(false);
    if (!focusId) return;
    userActivityTracker.recordHeaderAction('focus-select', { status: focusId });
    window.dispatchEvent(
      new CustomEvent(DASHBOARD_SELECT_FOCUS_EVENT, {
        detail: { focusId },
      })
    );
  };

  const handleSaveFocusAction = () => {
    if (!selectedFocusId) return;
    setShowSaveFocusConfirm((prev) => !prev);
  };

  const handleConfirmSaveFocus = () => {
    if (!selectedFocusId) {
      setShowSaveFocusConfirm(false);
      return;
    }
    setShowSaveFocusConfirm(false);
    window.dispatchEvent(
      new CustomEvent(DASHBOARD_SAVE_CURRENT_FOCUS_EVENT, {
        detail: { focusId: selectedFocusId },
      })
    );
  };

  const handleCancelSaveFocus = () => {
    setShowSaveFocusConfirm(false);
  };

  const handleViewScopeToggle = () => {
    const next = viewScope === 'wide' ? 'local' : 'wide';
    userActivityTracker.recordHeaderAction('view-scope-toggle', { status: next });
    setViewScope(next);
  };

  const handleTableLayoutToggle = () => {
    const next = tableLayoutMode === 'width' ? 'data' : 'width';
    setTableLayoutMode(next);
    window.__taliaTableLayoutMode = next;
    try {
      window.localStorage?.setItem?.(TABLE_LAYOUT_STORAGE_KEY, next);
    } catch {
      // no-op
    }
    window.dispatchEvent(
      new CustomEvent(DASHBOARD_TABLE_LAYOUT_EVENT, {
        detail: { mode: next },
      })
    );
    userActivityTracker.recordHeaderAction('table-layout-toggle', { status: next });
  };

  const handleEventsToggle = () => {
    const nextVisible = !eventsVisible;
    userActivityTracker.recordHeaderAction('advanced-controls-toggle', { status: nextVisible ? 'show' : 'hide' });
    setEventsVisible(nextVisible);
  };

  const handleCriteriaToggle = () => {
    const nextVisible = !criteriaVisible;
    userActivityTracker.recordHeaderAction('criteria-toggle', { status: nextVisible ? 'show' : 'hide' });
    setCriteriaVisible(nextVisible);
  };

  const handleGlobalDateRangeChange = (nextValue) => {
    const next = typeof nextValue === 'string' ? nextValue : nextValue?.target?.value;
    if (!GLOBAL_DATE_RANGE_OPTIONS.some((option) => option.key === next)) return;
    userActivityTracker.recordHeaderAction('global-date-range', { status: next });
    setGlobalDateRange(next);
  };

  const handleGlobalDurationChange = (nextValue) => {
    const next = typeof nextValue === 'string' ? nextValue : nextValue?.target?.value;
    if (!GLOBAL_DURATION_OPTIONS.some((option) => option.key === next)) return;
    userActivityTracker.recordHeaderAction('global-duration', { status: next });
    setGlobalDuration(next);
  };

  const handleAppearanceProfileChange = (nextValue) => {
    const next = typeof nextValue === 'string' ? nextValue : nextValue?.target?.value;
    if (!next) return;
    userActivityTracker.recordHeaderAction('appearance-profile', { status: next });
    applyAppearanceProfile(next);
  };

  const getActivePanelTarget = () => {
    const panelApi = window?.dockviewApi?.activePanel?.api || null;
    const panelId = panelApi?.id || null;
    const panelComponent = panelApi?.component || null;
    return { panelId, panelComponent };
  };

  const getPanelDetailsVisible = (panelId, panelComponent) => {
    const store = window.__taliaPanelDetailsVisibility || {};
    if (panelId && Object.prototype.hasOwnProperty.call(store, panelId)) {
      return store[panelId] !== false;
    }
    if (panelComponent && Object.prototype.hasOwnProperty.call(store, panelComponent)) {
      return store[panelComponent] !== false;
    }
    return true;
  };

  const handleDetailsToggle = () => {
    const { panelId, panelComponent } = getActivePanelTarget();
    if (!panelId && !panelComponent) return;
    const currentVisible = getPanelDetailsVisible(panelId, panelComponent);
    const nextVisible = !currentVisible;
    window.__taliaPanelDetailsVisibility = {
      ...(window.__taliaPanelDetailsVisibility || {}),
      ...(panelId ? { [panelId]: nextVisible } : {}),
      ...(panelComponent ? { [panelComponent]: nextVisible } : {}),
    };
    userActivityTracker.recordHeaderAction('details-toggle', { status: nextVisible ? 'show' : 'hide' });
    window.dispatchEvent(
      new CustomEvent(DASHBOARD_DETAILS_VISIBILITY_EVENT, {
        detail: {
          panelId,
          panelComponent,
          visible: nextVisible,
          action: 'set',
        },
      })
    );
  };

  const clearRefreshTimer = () => {
    if (refreshPhaseTimerRef.current) {
      window.clearTimeout(refreshPhaseTimerRef.current);
      refreshPhaseTimerRef.current = null;
    }
  };

  const startRefreshWindow = (nextPhase) => {
    clearRefreshTimer();
    setRefreshPhase(nextPhase);
    refreshPhaseTimerRef.current = window.setTimeout(() => {
      setRefreshPhase('active');
      refreshPhaseTimerRef.current = null;
    }, 5000);
  };

  const dispatchReportRefresh = (detail = {}) => {
    window.dispatchEvent(
      new CustomEvent(REPORT_REFRESH_EVENT, {
        detail,
      })
    );
  };

  const handleGlobalRefreshCycle = () => {
    const { panelId, panelComponent } = getActivePanelTarget();
    if (refreshPhase === 'active') {
      if (!panelId && !panelComponent) return;
      dispatchReportRefresh({
        panelId: panelComponent || panelId,
        panelInstanceId: panelId || null,
        panelComponent: panelComponent || null,
        scope: 'active',
      });
      userActivityTracker.recordHeaderAction('refresh', { status: 'active-panel' });
      startRefreshWindow('all');
      return;
    }

    if (refreshPhase === 'all') {
      dispatchReportRefresh({ scope: 'all' });
      userActivityTracker.recordHeaderAction('refresh', { status: 'all-panels' });
      startRefreshWindow('cooldown');
      return;
    }
  };

  const handleActiveOnlyChange = (checked) => {
    userActivityTracker.recordHeaderAction('active-only-toggle', { status: checked ? 'active-only' : 'include-non-real' });
    setActiveOnly(checked);
  };

  useEffect(() => {
    window.__taliaFiltersVisible = filtersVisible;
    const root = document.documentElement;
    if (filtersVisible) {
      root.classList.remove('talia-filters-hidden');
    } else {
      root.classList.add('talia-filters-hidden');
    }
    window.dispatchEvent(
      new CustomEvent(DASHBOARD_FILTER_VISIBILITY_EVENT, {
        detail: { visible: filtersVisible },
      })
    );
  }, [filtersVisible]);

  useEffect(() => {
    window.__taliaViewScope = viewScope;
    window.dispatchEvent(
      new CustomEvent(DASHBOARD_VIEW_SCOPE_EVENT, {
        detail: { scope: viewScope },
      })
    );
  }, [viewScope]);

  useEffect(() => {
    window.__taliaEventsVisible = eventsVisible;
  }, [eventsVisible]);

  useEffect(() => {
    window.__taliaCriteriaVisible = criteriaVisible;
  }, [criteriaVisible]);

  useEffect(() => {
    return () => {
      clearRefreshTimer();
      if (messageFadeTimerRef.current) {
        window.clearTimeout(messageFadeTimerRef.current);
      }
      if (messageHideTimerRef.current) {
        window.clearTimeout(messageHideTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleFocusState = (event) => {
      const options = event?.detail?.focuses;
      const currentFocusId = event?.detail?.currentFocusId;
      if (Array.isArray(options)) {
        setFocusOptions(options.filter((focus) => focus?.id));
      }
      setSelectedFocusId(currentFocusId || '');
      setShowSaveFocusConfirm(false);
    };
    window.addEventListener(DASHBOARD_FOCUS_STATE_EVENT, handleFocusState);
    return () => window.removeEventListener(DASHBOARD_FOCUS_STATE_EVENT, handleFocusState);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profileState = await loadUserProfileState({ component: 'StatusBar' });
        window.__taliaUserProfileState = profileState || {};
        const criteria = profileState?.globalCriteria;
        if (criteria && typeof criteria === 'object') {
          const nextRange = typeof criteria.rangeKey === 'string' ? criteria.rangeKey : '';
          const nextDuration = typeof criteria.durationKey === 'string' ? criteria.durationKey : '';
          if (GLOBAL_DATE_RANGE_OPTIONS.some((option) => option.key === nextRange)) {
            setGlobalDateRange(nextRange);
          }
          if (GLOBAL_DURATION_OPTIONS.some((option) => option.key === nextDuration)) {
            setGlobalDuration(nextDuration);
          }
          if (Object.prototype.hasOwnProperty.call(criteria, 'activeOnly')) {
            setActiveOnly(criteria.activeOnly !== false);
          } else if (Object.prototype.hasOwnProperty.call(criteria, 'includeNonRealSailings')) {
            setActiveOnly(criteria.includeNonRealSailings !== true);
          }
        }
      } catch {
        // local fallback remains in place
      } finally {
        if (!cancelled) setProfileCriteriaHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const range = resolveDateRange(globalDateRange);
    const includeNonRealSailings = !activeOnly;
    const criteria = {
      rangeKey: globalDateRange,
      durationKey: globalDuration,
      activeOnly,
      includeNonRealSailings,
      ...range
    };
    window.__taliaGlobalCriteria = criteria;
    window.dispatchEvent(
      new CustomEvent(DASHBOARD_GLOBAL_CRITERIA_EVENT, {
        detail: criteria,
      })
    );
  }, [globalDateRange, globalDuration, activeOnly]);

  useEffect(() => {
    if (!profileCriteriaHydrated) return undefined;
    if (criteriaSaveTimerRef.current) {
      window.clearTimeout(criteriaSaveTimerRef.current);
      criteriaSaveTimerRef.current = null;
    }
    criteriaSaveTimerRef.current = window.setTimeout(() => {
      const currentCriteria = window.__taliaGlobalCriteria || {
        rangeKey: globalDateRange,
        durationKey: globalDuration,
        activeOnly,
        includeNonRealSailings: !activeOnly,
      };
      saveUserProfileState({
        patch: { globalCriteria: currentCriteria },
        component: 'StatusBar',
      }).catch(() => {
        // best effort only
      });
    }, 250);
    return () => {
      if (criteriaSaveTimerRef.current) {
        window.clearTimeout(criteriaSaveTimerRef.current);
        criteriaSaveTimerRef.current = null;
      }
    };
  }, [profileCriteriaHydrated, globalDateRange, globalDuration, activeOnly]);

  // Get event summary
  const getEventSummary = (event) => {
    if (!event) return null;
    
    const eventType = event.name || event.eventType || 'Unknown';
    const detail = event.detail || event.rowData || {};
    
    // Extract key information
    const source = event.source || eventType.replace('talia:', '').replace('.select', '').replace('.clear', '');
    const timestamp = event.timestamp || detail.timestamp || new Date().toLocaleTimeString();
    
    // Get primary identifier from detail
    let identifier = '';
    if (detail.sail_code) identifier = `Sail: ${detail.sail_code}`;
    else if (detail.ship_code) identifier = `Ship: ${detail.ship_code}`;
    else if (detail.id) identifier = `ID: ${detail.id}`;
    else if (detail.title) identifier = detail.title;
    else if (Object.keys(detail).length > 0) {
      // Try to find a meaningful identifier
      const keys = Object.keys(detail);
      const firstKey = keys.find(k => k !== 'timestamp' && k !== 'row_data');
      if (firstKey) identifier = `${firstKey}: ${detail[firstKey]}`;
    }
    
    return {
      source,
      identifier,
      timestamp,
      eventType,
      detail
    };
  };

  const currentEventSummary = getEventSummary(currentEvent);
  const persistedEventSummary = getEventSummary(persistedEvent);
  const formatRange = (range) => {
    if (!range || (!range.min && !range.max)) return 'N/A';
    const min = range.min ? String(range.min).split('T')[0] : 'N/A';
    const max = range.max ? String(range.max).split('T')[0] : 'N/A';
    return min === max ? min : `${min} → ${max}`;
  };
  const dataRangeText = formatRange(dataStatus?.globalRange);
  const dataLastSyncText = dataStatus?.lastSync
    ? new Date(dataStatus.lastSync).toLocaleString()
    : 'N/A';
  const refreshButtonLabel = refreshPhase === 'active' ? '↻' : (refreshPhase === 'all' ? '↻↻' : '✓');
  const refreshButtonTitle = refreshPhase === 'active'
    ? 'Refresh active panel (click again within 5s for all panels)'
    : refreshPhase === 'all'
      ? 'Refresh all panels'
      : 'Refresh completed (resets in 5s)';

  // Always render - mode selector should always be visible
  return (
    <div className="status-bar">
      <div className="status-bar__container">
        <div className="status-bar__leading">
          {currentMode === 'app' && (
            <>
              <button
                type="button"
                className="status-bar__header-btn status-bar__sidebar-toggle"
                onClick={handleSidebarToggle}
                title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
                aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
              >
                {sidebarCollapsed ? '☰' : '◧'}
              </button>
              <span className="status-bar__leading-separator" aria-hidden="true" />
              <div className="status-bar__quick-actions">
                <button
                  type="button"
                  className={`status-bar__header-btn ${filtersVisible ? 'status-bar__header-btn--active' : ''}`}
                  onClick={handleFiltersToggle}
                  title={filtersVisible ? 'Hide filters on all reports' : 'Show filters on all reports'}
                  aria-label={filtersVisible ? 'Hide filters on all reports' : 'Show filters on all reports'}
                >
                  ▾
                </button>
                <button
                  type="button"
                  className={`status-bar__header-btn ${viewScope === 'wide' ? 'status-bar__header-btn--active' : ''}`}
                  onClick={handleViewScopeToggle}
                  title={viewScope === 'wide' ? 'Wide view active (click for local view)' : 'Local view active (click for wide view)'}
                  aria-label={viewScope === 'wide' ? 'Switch to local view' : 'Switch to wide view'}
                >
                  {viewScope === 'wide' ? 'W' : 'L'}
                </button>
                <button
                  type="button"
                  className={`status-bar__header-btn ${tableLayoutMode === 'width' ? 'status-bar__header-btn--active' : ''}`}
                  onClick={handleTableLayoutToggle}
                  title={tableLayoutMode === 'width' ? 'Tables: fill to width (click for fit to data)' : 'Tables: fit to data (click for fill to width)'}
                  aria-label={tableLayoutMode === 'width' ? 'Switch tables to fit data' : 'Switch tables to fill width'}
                >
                  {tableLayoutMode === 'width' ? '↔' : '⇵'}
                </button>
                <button
                  type="button"
                  className="status-bar__header-btn"
                  onClick={handleDetailsToggle}
                  title="Show/hide details on active panel"
                  aria-label="Show or hide details on active panel"
                >
                  ≣
                </button>
                <button
                  type="button"
                  className={`status-bar__header-btn ${refreshPhase !== 'active' ? 'status-bar__header-btn--active' : ''}`}
                  onClick={handleGlobalRefreshCycle}
                  title={refreshButtonTitle}
                  aria-label={refreshButtonTitle}
                  disabled={refreshPhase === 'cooldown'}
                >
                  {refreshButtonLabel}
                </button>
                {hasAdvancedControls && (
                  <button
                    type="button"
                    className="status-bar__header-btn status-bar__header-btn--focus"
                    onClick={handleCycleFocus}
                    title="Cycle focus"
                    aria-label="Cycle focus"
                  >
                    ⟳
                  </button>
                )}
                <button
                  type="button"
                  className={`status-bar__header-btn status-bar__header-btn--criteria ${criteriaVisible ? 'status-bar__header-btn--active' : ''}`}
                  onClick={handleCriteriaToggle}
                  title={criteriaVisible ? 'Hide global criteria controls' : 'Show global criteria controls'}
                  aria-label={criteriaVisible ? 'Hide global criteria controls' : 'Show global criteria controls'}
                >
                  <span className="status-bar__icon-search" aria-hidden="true">🔍</span>
                </button>
              </div>
              {criteriaVisible && (
                <>
                  <span className="status-bar__leading-separator" aria-hidden="true" />
                  <div className="status-bar__criteria">
                    {focusOptions.length > 0 && (
                      <div className="status-bar__focus-control">
                        <label className="status-bar__header-range" title="Quick focus selector">
                          <span className="status-bar__header-range-label">Focus</span>
                          <HeaderCriteriaMenuSelect
                            id="status-bar-quick-focus"
                            wide
                            options={focusOptions.map((focus) => ({ key: focus.id, label: focus.name || focus.id }))}
                            value={selectedFocusId}
                            onChange={handleQuickFocusChange}
                            aria-label="Quick focus selector"
                          />
                        </label>
                        {hasAdvancedControls && selectedFocusId && (
                          <div className="status-bar__focus-save">
                            <button
                              type="button"
                              className="status-bar__header-btn status-bar__header-btn--focus-save"
                              title="Save current focus"
                              aria-label="Save current focus"
                              onClick={handleSaveFocusAction}
                            >
                              💾
                            </button>
                            {showSaveFocusConfirm && (
                              <div className="status-bar__inline-confirm" role="group" aria-label="Confirm save current focus">
                                <button
                                  type="button"
                                  className="status-bar__confirm-btn status-bar__confirm-btn--ok"
                                  onClick={handleConfirmSaveFocus}
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  className="status-bar__confirm-btn"
                                  onClick={handleCancelSaveFocus}
                                >
                                  No
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {appearanceProfiles.length > 0 && (
                      <label className="status-bar__header-range" title="Apply a saved appearance profile">
                        <span className="status-bar__header-range-label">Style</span>
                        <HeaderCriteriaMenuSelect
                          id="status-bar-appearance-profile"
                          wide
                          options={appearanceProfiles.map((profile) => ({ key: profile.id, label: profile.name }))}
                          value={activeAppearanceProfileId}
                          onChange={handleAppearanceProfileChange}
                          aria-label="Appearance profile selector"
                        />
                      </label>
                    )}
                    <label className="status-bar__header-range" title="Global date range applied across reports">
                      <span className="status-bar__header-range-label">Date</span>
                      <HeaderCriteriaMenuSelect
                        id="status-bar-global-date-range"
                        options={GLOBAL_DATE_RANGE_OPTIONS}
                        value={globalDateRange}
                        onChange={handleGlobalDateRangeChange}
                        aria-label="Global date range"
                      />
                    </label>
                    <label className="status-bar__header-range" title="Global duration criteria applied across reports">
                      <span className="status-bar__header-range-label">Dur</span>
                      <HeaderCriteriaMenuSelect
                        id="status-bar-global-duration"
                        options={GLOBAL_DURATION_OPTIONS}
                        value={globalDuration}
                        onChange={handleGlobalDurationChange}
                        aria-label="Global duration criteria"
                      />
                    </label>
                    <label className="status-bar__header-toggle" htmlFor="status-bar-active-only" title="Show active sailings only">
                      <input
                        id="status-bar-active-only"
                        type="checkbox"
                        className="status-bar__header-checkbox"
                        checked={activeOnly}
                        onChange={(event) => handleActiveOnlyChange(event.target.checked)}
                        aria-label="Active sailings only"
                      />
                      <span className="status-bar__header-range-label">Active</span>
                    </label>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Left side: Status messages and events */}
        <div className="status-bar__left">
          {/* Status Message (temporary) */}
          {displayMessage && (
            <div className={`status-bar__message status-bar__message--success ${isMessageFading ? 'status-bar__message--fading' : ''}`}>
              <span className="status-bar__icon">✓</span>
              <span className="status-bar__text">{displayMessage}</span>
            </div>
          )}

          {currentMode === 'data' && dataStatus && (
            <div className="status-bar__item" title="Global data range and last sync">
              <span className="status-bar__label">Data:</span>
              <span className="status-bar__value">Range {dataRangeText}</span>
              <span className="status-bar__timestamp">Last Sync {dataLastSyncText}</span>
            </div>
          )}
        </div>

        <div className="status-bar__right">
          {eventsVisible && (
            <div className="status-bar__advanced">
              {currentMode === 'app' && hasAdvancedControls && (
                <div className="status-bar__events">
                  {currentEventSummary && (
                    <div
                      className="status-bar__item status-bar__item--clickable"
                      onClick={() => setShowDetails(!showDetails)}
                      title="Click to view details"
                    >
                      <span className="status-bar__label">Current Event:</span>
                      <span className="status-bar__value">
                        {currentEventSummary.source}
                        {currentEventSummary.identifier && ` - ${currentEventSummary.identifier}`}
                      </span>
                      <span className="status-bar__timestamp">{currentEventSummary.timestamp}</span>
                      <span className="status-bar__expand">{showDetails ? '▲' : '▼'}</span>
                    </div>
                  )}
                  {persistedEventSummary && (
                    <div
                      className="status-bar__item status-bar__item--clickable"
                      onClick={() => setShowDetails(!showDetails)}
                      title="Click to view details"
                    >
                      <span className="status-bar__label">Persisted:</span>
                      <span className="status-bar__value">
                        {persistedEventSummary.source}
                        {persistedEventSummary.identifier && ` - ${persistedEventSummary.identifier}`}
                      </span>
                      <span className="status-bar__timestamp">{persistedEventSummary.timestamp}</span>
                    </div>
                  )}
                </div>
              )}
              {currentMode && onModeChange && (
                <div className="status-bar__mode">
                  <ModeSelector currentMode={currentMode} onModeChange={onModeChange} />
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            className={`status-bar__header-btn ${eventsVisible ? 'status-bar__header-btn--active' : ''}`}
            onClick={handleEventsToggle}
            title={eventsVisible ? 'Hide advanced header controls' : 'Show advanced header controls'}
            aria-label={eventsVisible ? 'Hide advanced header controls' : 'Show advanced header controls'}
          >
            <span className="status-bar__icon-graph" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>

      </div>

      {/* Details Panel */}
      {hasAdvancedControls && showDetails && (currentEventSummary || persistedEventSummary) && (
        <div className="status-bar__details">
          <div className="status-bar__details-header">
            <span className="status-bar__details-title">Event Details</span>
            <button 
              className="status-bar__details-close"
              onClick={() => setShowDetails(false)}
              title="Close"
            >
              ×
            </button>
          </div>
          
          <div className="status-bar__details-content">
            {currentEventSummary && (
              <div className="status-bar__details-section">
                <div className="status-bar__details-section-title">Current Event</div>
                <div className="status-bar__details-row">
                  <span className="status-bar__details-label">Type:</span>
                  <span className="status-bar__details-value">{currentEventSummary.eventType}</span>
                </div>
                <div className="status-bar__details-row">
                  <span className="status-bar__details-label">Source:</span>
                  <span className="status-bar__details-value">{currentEventSummary.source}</span>
                </div>
                <div className="status-bar__details-row">
                  <span className="status-bar__details-label">Timestamp:</span>
                  <span className="status-bar__details-value">{currentEventSummary.timestamp}</span>
                </div>
                <div className="status-bar__details-data">
                  <span className="status-bar__details-label">Data:</span>
                  <pre className="status-bar__details-json">
                    {JSON.stringify(currentEventSummary.detail, null, 2)}
                  </pre>
                </div>
              </div>
            )}
            
            {persistedEventSummary && (
              <div className="status-bar__details-section">
                <div className="status-bar__details-section-title">Persisted Event</div>
                <div className="status-bar__details-row">
                  <span className="status-bar__details-label">Type:</span>
                  <span className="status-bar__details-value">{persistedEventSummary.eventType}</span>
                </div>
                <div className="status-bar__details-row">
                  <span className="status-bar__details-label">Source:</span>
                  <span className="status-bar__details-value">{persistedEventSummary.source}</span>
                </div>
                <div className="status-bar__details-row">
                  <span className="status-bar__details-label">Timestamp:</span>
                  <span className="status-bar__details-value">{persistedEventSummary.timestamp}</span>
                </div>
                <div className="status-bar__details-data">
                  <span className="status-bar__details-label">Data:</span>
                  <pre className="status-bar__details-json">
                    {JSON.stringify(persistedEventSummary.detail, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusBar;
