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

import React, { useState, useEffect, useRef, useMemo } from 'react';
import ModeSelector from '../ModeSelector';
import { canUseAdvancedHeader } from '../../utils/roleUtils';
import {
  REPORT_REFRESH_EVENT,
  REPORT_ACTIVE_PANEL_EVENT,
  DATA_MANAGEMENT_STATE_EVENT,
  DATA_MANAGEMENT_SET_RANGE_EVENT,
  DATA_MANAGEMENT_SYNC_ALL_EVENT,
  DATA_MANAGEMENT_BACKUP_EVENT,
  DATA_MANAGEMENT_REFRESH_EVENT,
  DATA_MANAGEMENT_SELECT_TABLE_EVENT,
  DATA_MANAGEMENT_TABLE_ACTION_EVENT,
  DASHBOARD_DETAILS_VISIBILITY_EVENT,
  DASHBOARD_FILTER_VISIBILITY_EVENT,
  DASHBOARD_TABULATOR_FILTER_VISIBILITY_EVENT,
  DASHBOARD_TABLE_LAYOUT_EVENT,
} from '../dockview/eventConstants';
import {
  getGlobalReportDetailsVisible,
  setGlobalReportDetailsVisible,
  clearPanelReportDetailsOverrides,
} from '../../services/panelDetailsState';
import { enforceDashboardUiState } from '../../services/dashboardUiState';
import { useTheme } from '../../contexts/ThemeContext';
import { useFocusManagement } from '../../hooks/useFocusManagement';
import { DEFAULT_HEADER_LOGO_SRC, resolveAppPublicUrl } from '../../lib/headerLogoAsset';
import { GLOBAL_DATE_RANGE_OPTIONS, normalizeGlobalDateRangeKey, resolveGlobalDateRange } from '../../lib/globalDateRange';
import { extractSailCodeFromEvent, SAIL_CLEAR_EVENT, SAIL_SELECT_EVENT } from '../../lib/eventBus';
import userActivityTracker from '../../services/userActivityTracker';
import { loadUserProfileState, saveUserProfileState } from '../../services/data/userProfileState';
import TaliaTooltip from './TaliaTooltip';
// CSS imported globally in main.jsx
const DASHBOARD_TOGGLE_SIDEBAR_EVENT = 'talia:dashboard.toggleSidebar';
const DASHBOARD_SIDEBAR_STATE_EVENT = 'talia:dashboard.sidebarState';
const FILTERS_VISIBILITY_STORAGE_KEY = 'taliaHeaderFiltersVisible';
const TABULATOR_FILTERS_VISIBILITY_STORAGE_KEY = 'taliaHeaderTabulatorFiltersVisible';
const DASHBOARD_CYCLE_FOCUS_EVENT = 'talia:dashboard.cycleFocus';
const DASHBOARD_SELECT_FOCUS_EVENT = 'talia:dashboard.selectFocus';
const DASHBOARD_SAVE_CURRENT_FOCUS_EVENT = 'talia:dashboard.saveCurrentFocus';
const DASHBOARD_VIEW_SCOPE_EVENT = 'talia:dashboard.viewScope';
const DASHBOARD_GLOBAL_CRITERIA_EVENT = 'talia:dashboard.globalCriteria';
const TABLE_LAYOUT_STORAGE_KEY = 'taliaTableLayoutMode';
const TEST_DEFAULT_GLOBAL_RANGE_KEY = 'all_future';
const TABLE_LAYOUT_MODES = ['best', 'width', 'data'];

const GLOBAL_DURATION_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: '7', label: '7' },
  { key: '14', label: '14' },
  { key: '7-14', label: '7 & 14' },
  { key: '3', label: '3' },
  { key: '4', label: '4' },
  { key: '3-4', label: '3 & 4' }
];

const GLOBAL_DISPLAY_CURRENCY_OPTIONS = [
  { key: 'ALL', label: 'All' },
  { key: 'USD', label: 'USD' },
  { key: 'EUR', label: 'EUR' },
  { key: 'GBP', label: 'GBP' },
  { key: 'AUD', label: 'AUD' },
  { key: 'NZD', label: 'NZD' },
  { key: 'CAD', label: 'CAD' },
  { key: 'JPY', label: 'JPY' },
  { key: 'CHF', label: 'CHF' },
];

const normalizePersistedSailing = (raw) => {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const sailCode = raw.trim();
    return sailCode ? { sailCode, detail: { sail_code: sailCode } } : null;
  }
  if (typeof raw !== 'object') return null;

  const detail = raw.detail && typeof raw.detail === 'object'
    ? raw.detail
    : raw;
  const sailCode = extractSailCodeFromEvent(detail) || raw.sailCode || null;
  if (!sailCode) return null;
  return {
    sailCode: String(sailCode),
    detail,
    capturedAt: raw.capturedAt || detail?.timestamp || null
  };
};

const HeaderCriteriaMenuSelect = ({
  id,
  options,
  value,
  onChange,
  ariaLabel,
  wide = false,
  autoCloseMs = 5000,
}) => {
  const [open, setOpen] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((option) => option.key === value) || options[0] || null;
  const MENU_FADE_MS = 720;

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

  useEffect(() => {
    if (!open) return undefined;
    if (isInteracting) return undefined;
    setIsFading(false);
    const timeoutMs = Number.isFinite(Number(autoCloseMs)) ? Math.max(1000, Number(autoCloseMs)) : 5000;
    const fadeDelayMs = Math.max(120, timeoutMs - MENU_FADE_MS);
    const fadeTimer = window.setTimeout(() => {
      setIsFading(true);
    }, fadeDelayMs);
    const closeTimer = window.setTimeout(() => {
      setOpen(false);
      setIsFading(false);
    }, timeoutMs);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(closeTimer);
      setIsFading(false);
    };
  }, [open, autoCloseMs, isInteracting]);

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
      onMouseEnter={() => setIsInteracting(true)}
      onMouseLeave={() => setIsInteracting(false)}
      onFocusCapture={() => setIsInteracting(true)}
      onBlurCapture={(event) => {
        const nextFocused = event?.relatedTarget;
        if (!rootRef.current?.contains(nextFocused)) {
          setIsInteracting(false);
        }
      }}
    >
      <button
        type="button"
        className="status-bar__menu-select-trigger"
        onClick={() => {
          setIsFading(false);
          setOpen((prev) => !prev);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="status-bar__menu-select-value">{selected?.label || '—'}</span>
        <span className="status-bar__menu-select-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className={`status-bar__menu-select-menu ${isFading ? 'status-bar__menu-select-menu--fading' : ''}`} role="menu" aria-label={ariaLabel}>
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
                <span>{option.label}</span>
                {isSelected ? <span className="status-bar__menu-select-check" aria-hidden="true">✓</span> : null}
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
    applyAppearanceProfile,
    appearanceStyleSelectOptions,
    appearanceStyleSelectValue,
    applyAppearanceStyleSelectKey,
    panelTitlesVisible,
    setPanelTitlesVisible,
    actionsVisible,
    setActionsVisible,
    controlsVisible,
    setControlsVisible,
    menuDisappearMs,
    calloutsVisible,
    setCalloutsVisible,
    headerLogoUrl,
    headerLogoVisible,
    defaultDisplayCurrency,
    setDefaultDisplayCurrency,
    tableLayoutMode: themeTableLayoutMode,
    setTableLayoutMode: setThemeTableLayoutMode,
  } = useTheme();

  const { focuses: canonicalFocuses, currentFocus: currentFocusObject } = useFocusManagement();
  const catalogFocusOptions = useMemo(
    () =>
      Array.isArray(canonicalFocuses)
        ? canonicalFocuses.filter((focus) => focus?.id).map((focus) => ({ id: focus.id, name: focus.name || focus.id }))
        : [],
    [canonicalFocuses]
  );
  const currentFocusId = currentFocusObject?.id || '';

  const displayCurrencyOptions = useMemo(() => {
    const cur = String(defaultDisplayCurrency || '').trim().toUpperCase();
    if (cur && !GLOBAL_DISPLAY_CURRENCY_OPTIONS.some((o) => o.key === cur)) {
      return [...GLOBAL_DISPLAY_CURRENCY_OPTIONS, { key: cur, label: cur }];
    }
    return GLOBAL_DISPLAY_CURRENCY_OPTIONS;
  }, [defaultDisplayCurrency]);

  const resolvedHeaderLogoSrc = useMemo(() => {
    if (!headerLogoVisible) return '';
    const raw = String(headerLogoUrl || '').trim();
    if (raw) {
      if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) return raw;
      const path = raw.startsWith('/') ? raw.slice(1) : raw;
      return resolveAppPublicUrl(path);
    }
    return DEFAULT_HEADER_LOGO_SRC;
  }, [headerLogoUrl, headerLogoVisible]);

  const [headerLogoBroken, setHeaderLogoBroken] = useState(false);
  useEffect(() => {
    setHeaderLogoBroken(false);
  }, [resolvedHeaderLogoSrc]);
  const [showDetails, setShowDetails] = useState(false);
  const [displayMessage, setDisplayMessage] = useState(statusMessage);
  const [isMessageFading, setIsMessageFading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => !!window.__taliaSidebarCollapsed);
  const [filtersVisible, setFiltersVisible] = useState(() => {
    try {
      const s = window.localStorage?.getItem?.(FILTERS_VISIBILITY_STORAGE_KEY);
      if (s === '0' || s === 'false') return false;
      if (s === '1' || s === 'true') return true;
    } catch {
      // ignore
    }
    return window.__taliaFiltersVisible === true;
  });
  const [tabulatorFiltersVisible, setTabulatorFiltersVisible] = useState(() => {
    try {
      const s = window.localStorage?.getItem?.(TABULATOR_FILTERS_VISIBILITY_STORAGE_KEY);
      if (s === '0' || s === 'false') return false;
      if (s === '1' || s === 'true') return true;
    } catch {
      // ignore
    }
    return window.__taliaTabulatorFiltersVisible !== false;
  });
  const [eventsVisible, setEventsVisible] = useState(() => window.__taliaEventsVisible === true);
  const [criteriaVisible, setCriteriaVisible] = useState(() => window.__taliaCriteriaVisible === true);
  const [detailsVisible, setDetailsVisible] = useState(() => getGlobalReportDetailsVisible());
  const [viewScope, setViewScope] = useState(() => window.__taliaViewScope === 'wide' ? 'wide' : 'local');
  const [globalDateRange, setGlobalDateRange] = useState(() => {
    return TEST_DEFAULT_GLOBAL_RANGE_KEY;
  });
  const [globalDuration, setGlobalDuration] = useState(() => {
    const saved = window.__taliaGlobalCriteria?.durationKey;
    return GLOBAL_DURATION_OPTIONS.some((option) => option.key === saved) ? saved : 'all';
  });
  const [globalSailSelection, setGlobalSailSelection] = useState(() => (
    normalizePersistedSailing(
      window.__taliaGlobalCriteria?.selectedSailing || window.lastSailSelectEvent?.detail || null
    )
  ));
  const [focusOptions, setFocusOptions] = useState([]);
  const [selectedFocusId, setSelectedFocusId] = useState(currentFocusId);
  const [lastFocusId, setLastFocusId] = useState('');
  const currentFocusRef = useRef(currentFocusId);
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
    if (TABLE_LAYOUT_MODES.includes(inMemory)) return inMemory;
    const saved = window.localStorage?.getItem?.(TABLE_LAYOUT_STORAGE_KEY);
    return TABLE_LAYOUT_MODES.includes(saved) ? saved : 'best';
  });
  const refreshPhaseTimerRef = useRef(null);
  const criteriaSaveTimerRef = useRef(null);
  const messageFadeTimerRef = useRef(null);
  const messageHideTimerRef = useRef(null);
  const [profileCriteriaHydrated, setProfileCriteriaHydrated] = useState(false);
  const [visibilityControlsOpen, setVisibilityControlsOpen] = useState(false);
  const visibilityControlsRef = useRef(null);
  const visibilityPanelRef = useRef(null);
  const [focusControlsOpen, setFocusControlsOpen] = useState(false);
  const focusControlsRef = useRef(null);
  const focusPanelRef = useRef(null);
  const [autoCloseFading, setAutoCloseFading] = useState({
    advanced: false,
    criteria: false,
    visibility: false,
    focus: false,
  });
  const [isHeaderInteractionActive, setIsHeaderInteractionActive] = useState(false);
  const statusBarRootRef = useRef(null);
  const [activePanelComponent, setActivePanelComponent] = useState(() => (
    window?.dockviewApi?.activePanel?.component
    || window?.dockviewApi?.activePanel?.api?.component
    || null
  ));
  const [dataMgmtState, setDataMgmtState] = useState({
    rangeDraft: { from: '', to: '' },
    selectedTable: '',
    syncableTableNames: [],
    rangeSaving: false,
    bulkSyncing: false,
    bulkMode: null,
    backupLoading: false,
  });
  const hasAdvancedControls = typeof canUseAdvancedControls === 'boolean'
    ? canUseAdvancedControls
    : canUseAdvancedHeader(userRole);
  const isDataManagementActive = activePanelComponent === 'data-management-panel';
  const showDataAdminActions = actionsVisible === true;
  const showDataAdminFilters = filtersVisible === true;
  const showDataAdminStrip = hasAdvancedControls
    && isDataManagementActive
    && controlsVisible === true
    && (showDataAdminActions || showDataAdminFilters);

  /** Hide centered logo while any top header strip / panel is open (avoids overlap). */
  const headerLogoSuppressed = useMemo(() => (
    visibilityControlsOpen
    || criteriaVisible
    || focusControlsOpen
    || eventsVisible
    || showDataAdminStrip
  ), [visibilityControlsOpen, criteriaVisible, focusControlsOpen, eventsVisible, showDataAdminStrip]);

  const reportActionFailure = (message) => {
    const text = String(message || '').trim() || 'Action failed.';
    console.error(`[StatusBar] ${text}`);
    try {
      window.__taliaStatus?.setStatusMessage?.(`Error: ${text}`);
    } catch {
      // Avoid secondary failures while reporting an action error.
    }
  };

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
    window.__taliaGlobalReportDetailsVisible = getGlobalReportDetailsVisible();
  }, []);

  useEffect(() => {
    try {
      window.localStorage?.setItem?.(FILTERS_VISIBILITY_STORAGE_KEY, filtersVisible ? '1' : '0');
    } catch {
      // ignore
    }
  }, [filtersVisible]);

  useEffect(() => {
    try {
      window.localStorage?.setItem?.(TABULATOR_FILTERS_VISIBILITY_STORAGE_KEY, tabulatorFiltersVisible ? '1' : '0');
    } catch {
      // ignore
    }
  }, [tabulatorFiltersVisible]);

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

  const handleTabulatorFiltersToggle = () => {
    const nextVisible = !tabulatorFiltersVisible;
    userActivityTracker.recordHeaderAction('tabulator-filters-toggle', { status: nextVisible ? 'show' : 'hide' });
    setTabulatorFiltersVisible(nextVisible);
  };

  const handleCycleFocus = () => {
    userActivityTracker.recordHeaderAction('focus-cycle');
    window.dispatchEvent(new CustomEvent(DASHBOARD_CYCLE_FOCUS_EVENT));
  };

  const handleSwitchFocus = () => {
    const targetFocusId = lastFocusId;
    if (!targetFocusId) return;
    if (targetFocusId === currentFocusRef.current) return;
    if (!focusOptions.some((focus) => focus.id === targetFocusId)) return;
    userActivityTracker.recordHeaderAction('focus-switch', { status: targetFocusId });
    window.dispatchEvent(
      new CustomEvent(DASHBOARD_SELECT_FOCUS_EVENT, {
        detail: { focusId: targetFocusId },
      })
    );
  };

  useEffect(() => {
    if (!eventsVisible && !criteriaVisible && !visibilityControlsOpen && !focusControlsOpen) {
      setAutoCloseFading({
        advanced: false,
        criteria: false,
        visibility: false,
        focus: false,
      });
      return undefined;
    }
    if (isHeaderInteractionActive) {
      setAutoCloseFading({
        advanced: false,
        criteria: false,
        visibility: false,
        focus: false,
      });
      return undefined;
    }
    const timeoutMs = Number.isFinite(Number(menuDisappearMs)) ? Math.max(1000, Number(menuDisappearMs)) : 5000;
    const fadeMs = 720;
    const fadeDelayMs = Math.max(120, timeoutMs - fadeMs);
    const fadeTimer = window.setTimeout(() => {
      setAutoCloseFading({
        advanced: eventsVisible,
        criteria: criteriaVisible,
        visibility: visibilityControlsOpen,
        focus: focusControlsOpen,
      });
    }, fadeDelayMs);
    const closeTimer = window.setTimeout(() => {
      setEventsVisible(false);
      setCriteriaVisible(false);
      setVisibilityControlsOpen(false);
      setFocusControlsOpen(false);
      setShowSaveFocusConfirm(false);
      setAutoCloseFading({
        advanced: false,
        criteria: false,
        visibility: false,
        focus: false,
      });
    }, timeoutMs);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(closeTimer);
      setAutoCloseFading({
        advanced: false,
        criteria: false,
        visibility: false,
        focus: false,
      });
    };
  }, [eventsVisible, criteriaVisible, visibilityControlsOpen, focusControlsOpen, menuDisappearMs, isHeaderInteractionActive]);

  const handleQuickFocusChange = (nextValue) => {
    const focusId = typeof nextValue === 'string' ? nextValue : nextValue?.target?.value || '';
    setShowSaveFocusConfirm(false);
    if (!focusId) return;
    if (focusId === currentFocusRef.current) return;
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

  const handleTableLayoutSelect = (mode) => {
    if (!TABLE_LAYOUT_MODES.includes(mode)) return;
    const next = mode;
    if (next === tableLayoutMode) return;
    setTableLayoutMode(next);
    if (typeof setThemeTableLayoutMode === 'function') {
      setThemeTableLayoutMode(next);
    } else {
      window.__taliaTableLayoutMode = next;
      try {
        window.localStorage?.setItem?.(TABLE_LAYOUT_STORAGE_KEY, next);
      } catch (error) {
        reportActionFailure(`Failed to persist table layout mode "${next}": ${error?.message || 'Unknown error'}`);
      }
      window.dispatchEvent(
        new CustomEvent(DASHBOARD_TABLE_LAYOUT_EVENT, {
          detail: { mode: next },
        })
      );
    }
    userActivityTracker.recordHeaderAction('table-layout-toggle', { status: next });
  };

  useEffect(() => {
    if (TABLE_LAYOUT_MODES.includes(themeTableLayoutMode)) {
      setTableLayoutMode(themeTableLayoutMode);
    }
  }, [themeTableLayoutMode]);

  const closeOtherTopLevelGroups = (groupToKeep) => {
    if (groupToKeep !== 'advanced') setEventsVisible(false);
    if (groupToKeep !== 'criteria') setCriteriaVisible(false);
    if (groupToKeep !== 'visibility') setVisibilityControlsOpen(false);
    if (groupToKeep !== 'focus') {
      setFocusControlsOpen(false);
      setShowSaveFocusConfirm(false);
    }
    setAutoCloseFading({
      advanced: false,
      criteria: false,
      visibility: false,
      focus: false,
    });
  };

  const handleEventsToggle = () => {
    const nextVisible = !eventsVisible;
    userActivityTracker.recordHeaderAction('advanced-controls-toggle', { status: nextVisible ? 'show' : 'hide' });
    if (nextVisible) closeOtherTopLevelGroups('advanced');
    setEventsVisible(nextVisible);
  };

  const handleCriteriaToggle = () => {
    const nextVisible = !criteriaVisible;
    userActivityTracker.recordHeaderAction('criteria-toggle', { status: nextVisible ? 'show' : 'hide' });
    if (nextVisible) closeOtherTopLevelGroups('criteria');
    setCriteriaVisible(nextVisible);
  };

  const handleVisibilityToggle = () => {
    const nextVisible = !visibilityControlsOpen;
    userActivityTracker.recordHeaderAction('visibility-toggle', { status: nextVisible ? 'show' : 'hide' });
    if (nextVisible) closeOtherTopLevelGroups('visibility');
    setVisibilityControlsOpen(nextVisible);
  };

  // Same pattern as visibility/criteria: toggle immediately. No open delays.
  const handleFocusTopClick = () => {
    const nextVisible = !focusControlsOpen;
    userActivityTracker.recordHeaderAction(
      nextVisible ? 'focus-selector-open' : 'focus-selector-close',
      { status: 'single-click' }
    );
    if (nextVisible) closeOtherTopLevelGroups('focus');
    setFocusControlsOpen(nextVisible);
    setShowSaveFocusConfirm(false);
  };

  const handleFocusTopDoubleClick = (event) => {
    event?.preventDefault?.();
    // Two clicks already toggled open→closed; cycle focus and leave strip closed.
    handleCycleFocus();
    userActivityTracker.recordHeaderAction('focus-next', { status: 'double-click' });
  };

  const handleGlobalDateRangeChange = (nextValue) => {
    const next = normalizeGlobalDateRangeKey(
      typeof nextValue === 'string' ? nextValue : nextValue?.target?.value
    );
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

  const handleGlobalDisplayCurrencyChange = (nextValue) => {
    const raw = typeof nextValue === 'string' ? nextValue : nextValue?.target?.value;
    const next = String(raw || '').trim().toUpperCase();
    if (!next || !displayCurrencyOptions.some((option) => option.key === next)) return;
    userActivityTracker.recordHeaderAction('global-display-currency', { status: next });
    setDefaultDisplayCurrency(next);
  };

  const handleAppearanceProfileChange = (nextValue) => {
    const next = typeof nextValue === 'string' ? nextValue : nextValue?.target?.value;
    if (!next) return;
    userActivityTracker.recordHeaderAction('appearance-profile', { status: next });
    applyAppearanceProfile(next);
  };

  const styleMenuUsesProfiles = appearanceProfiles.length > 0;
  const styleSelectOptions = appearanceStyleSelectOptions;
  const styleSelectValue = appearanceStyleSelectValue;

  const handleStyleVisibilityChange = (nextValue) => {
    const next = typeof nextValue === 'string' ? nextValue : nextValue?.target?.value;
    if (!next || !styleSelectOptions.some((o) => o.key === next)) return;
    if (appearanceProfiles.some((p) => p.id === next)) {
      handleAppearanceProfileChange(next);
      return;
    }
    userActivityTracker.recordHeaderAction('palette-theme', { status: next });
    applyAppearanceStyleSelectKey(next);
  };

  const getActivePanelTarget = () => {
    const activePanel = window?.dockviewApi?.activePanel || null;
    const panelApi = activePanel?.api || null;
    const panelId = activePanel?.id || panelApi?.id || null;
    const panelComponent = activePanel?.component || panelApi?.component || null;
    return { panelId, panelComponent };
  };

  const handleDetailsToggle = () => {
    const nextVisible = !detailsVisible;
    setDetailsVisible(nextVisible);
    setGlobalReportDetailsVisible(nextVisible);
    clearPanelReportDetailsOverrides();
    userActivityTracker.recordHeaderAction('details-toggle', { status: nextVisible ? 'show' : 'hide' });
    window.dispatchEvent(
      new CustomEvent(DASHBOARD_DETAILS_VISIBILITY_EVENT, {
        detail: {
          scope: 'all',
          visible: nextVisible,
          action: 'set',
        },
      })
    );
  };

  const handlePanelTitlesToggle = () => {
    const nextVisible = !panelTitlesVisible;
    userActivityTracker.recordHeaderAction('panel-titles-toggle', { status: nextVisible ? 'show' : 'hide' });
    setPanelTitlesVisible(nextVisible);
  };

  const handleCalloutsToggle = () => {
    const nextVisible = !calloutsVisible;
    userActivityTracker.recordHeaderAction('callouts-toggle', { status: nextVisible ? 'show' : 'hide' });
    setCalloutsVisible(nextVisible);
  };

  const handleActionsToggle = () => {
    const nextVisible = !actionsVisible;
    userActivityTracker.recordHeaderAction('operations-toggle', { status: nextVisible ? 'show' : 'hide' });
    setActionsVisible(nextVisible);
    setControlsVisible(nextVisible);
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
    enforceDashboardUiState({ dispatchEvents: true });
    const { panelId, panelComponent } = getActivePanelTarget();
    if (refreshPhase === 'active') {
      if (!panelId && !panelComponent) {
        reportActionFailure('Refresh failed: no active panel is selected.');
        return;
      }
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

  const dispatchDataManagementCommand = (eventName, detail = {}) => {
    window.dispatchEvent(new CustomEvent(eventName, {
      detail: {
        panelComponent: 'data-management-panel',
        ...detail,
      },
    }));
  };

  const handleDataMgmtRangeInput = (field, value) => {
    const next = {
      from: field === 'from' ? value : dataMgmtState.rangeDraft.from,
      to: field === 'to' ? value : dataMgmtState.rangeDraft.to,
    };
    setDataMgmtState((prev) => ({ ...prev, rangeDraft: next }));
    dispatchDataManagementCommand(DATA_MANAGEMENT_SET_RANGE_EVENT, next);
  };

  const handleDataMgmtSaveRange = () => {
    dispatchDataManagementCommand(DATA_MANAGEMENT_SET_RANGE_EVENT, {
      ...dataMgmtState.rangeDraft,
      save: true,
    });
  };

  const handleDataMgmtSyncAll = (mode) => {
    dispatchDataManagementCommand(DATA_MANAGEMENT_SYNC_ALL_EVENT, {
      mode: mode === 'full' ? 'full' : 'sync',
    });
  };

  const handleDataMgmtBackup = () => {
    dispatchDataManagementCommand(DATA_MANAGEMENT_BACKUP_EVENT);
  };

  const handleDataMgmtRefresh = () => {
    dispatchDataManagementCommand(DATA_MANAGEMENT_REFRESH_EVENT);
  };

  const handleDataMgmtSelectTable = (nextTableName) => {
    const tableName = typeof nextTableName === 'string' ? nextTableName : nextTableName?.target?.value || '';
    setDataMgmtState((prev) => ({ ...prev, selectedTable: tableName }));
    dispatchDataManagementCommand(DATA_MANAGEMENT_SELECT_TABLE_EVENT, { tableName });
  };

  const handleDataMgmtTableAction = (action) => {
    const tableName = dataMgmtState.selectedTable || '';
    if (!tableName) {
      reportActionFailure(`Data Management ${action} failed: no table is selected.`);
      return;
    }
    dispatchDataManagementCommand(DATA_MANAGEMENT_TABLE_ACTION_EVENT, { tableName, action });
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
    window.__taliaTabulatorFiltersVisible = tabulatorFiltersVisible;
    const root = document.documentElement;
    root.classList.toggle('talia-tabulator-filters-hidden', tabulatorFiltersVisible === false);
    window.dispatchEvent(
      new CustomEvent(DASHBOARD_TABULATOR_FILTER_VISIBILITY_EVENT, {
        detail: { visible: tabulatorFiltersVisible },
      })
    );
  }, [tabulatorFiltersVisible]);

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
    const resolveElement = (node) => {
      if (!node) return null;
      if (node instanceof Element) return node;
      return node.parentElement || null;
    };
    const isInside = (node, root, selector) => {
      const el = resolveElement(node);
      if (!el) return false;
      if (root && typeof root.contains === 'function' && root.contains(el)) return true;
      return Boolean(selector && el.closest(selector));
    };

    const handleOutsideClick = (event) => {
      const target = event.target;
      const insideVisibility = isInside(target, visibilityControlsRef.current, '.status-bar__visibility-controls')
        || isInside(target, visibilityPanelRef.current, '.status-bar__criteria--visibility');
      const insideFocus = isInside(target, focusControlsRef.current, '.status-bar__focus-controls')
        || isInside(target, focusPanelRef.current, '.status-bar__criteria--focus');
      if (!insideVisibility) {
        setVisibilityControlsOpen(false);
      }
      if (!insideFocus) {
        setFocusControlsOpen(false);
        setShowSaveFocusConfirm(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setVisibilityControlsOpen(false);
        setFocusControlsOpen(false);
        setShowSaveFocusConfirm(false);
        setCriteriaVisible(false);
        setEventsVisible(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (!root) return undefined;
    const updateOffset = () => {
      const nextHeight = statusBarRootRef.current?.offsetHeight;
      root.style.setProperty('--talia-status-bar-total-height', `${Math.max(38, nextHeight || 38)}px`);
    };
    updateOffset();
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && statusBarRootRef.current) {
      resizeObserver = new ResizeObserver(updateOffset);
      resizeObserver.observe(statusBarRootRef.current);
    }
    window.addEventListener('resize', updateOffset);
    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', updateOffset);
    };
  }, []);

  useEffect(() => {
    window.__taliaCriteriaVisible = criteriaVisible;
  }, [criteriaVisible]);

  useEffect(() => {
    const handleFilterVisibilityEvent = (event) => {
      const visible = event?.detail?.visible;
      if (typeof visible === 'boolean') {
        setFiltersVisible(visible);
      }
    };
    const handleDetailsVisibilityEvent = (event) => {
      const visible = event?.detail?.visible;
      if (typeof visible === 'boolean') {
        setDetailsVisible(visible);
      }
    };
    window.addEventListener(DASHBOARD_FILTER_VISIBILITY_EVENT, handleFilterVisibilityEvent);
    window.addEventListener(DASHBOARD_DETAILS_VISIBILITY_EVENT, handleDetailsVisibilityEvent);
    return () => {
      window.removeEventListener(DASHBOARD_FILTER_VISIBILITY_EVENT, handleFilterVisibilityEvent);
      window.removeEventListener(DASHBOARD_DETAILS_VISIBILITY_EVENT, handleDetailsVisibilityEvent);
    };
  }, []);

  useEffect(() => {
    const handleTableLayoutEvent = (event) => {
      const nextMode = event?.detail?.mode;
      if (TABLE_LAYOUT_MODES.includes(nextMode)) {
        setTableLayoutMode(nextMode);
      }
    };
    window.addEventListener(DASHBOARD_TABLE_LAYOUT_EVENT, handleTableLayoutEvent);
    return () => window.removeEventListener(DASHBOARD_TABLE_LAYOUT_EVENT, handleTableLayoutEvent);
  }, []);

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
    setFocusOptions(catalogFocusOptions);
  }, [catalogFocusOptions]);

  useEffect(() => {
    if (
      currentFocusId
      && currentFocusRef.current
      && currentFocusRef.current !== currentFocusId
    ) {
      setLastFocusId(currentFocusRef.current);
    }
    currentFocusRef.current = currentFocusId || '';
    setSelectedFocusId(currentFocusId || '');
    setShowSaveFocusConfirm(false);
  }, [currentFocusId]);

  useEffect(() => {
    if (!lastFocusId) return;
    const stillExists = focusOptions.some((focus) => focus.id === lastFocusId);
    if (!stillExists) {
      setLastFocusId('');
    }
  }, [focusOptions, lastFocusId]);

  useEffect(() => {
    const handleActivePanelChanged = (event) => {
      const detail = event?.detail || {};
      const panelComponent = detail.panelComponent
        || window?.dockviewApi?.activePanel?.component
        || window?.dockviewApi?.activePanel?.api?.component
        || null;
      setActivePanelComponent(panelComponent);
    };
    const handleDataManagementState = (event) => {
      const detail = event?.detail || {};
      if (detail.panelComponentId !== 'data-management-panel') return;
      setDataMgmtState({
        rangeDraft: detail.rangeDraft || { from: '', to: '' },
        selectedTable: typeof detail.selectedTable === 'string' ? detail.selectedTable : '',
        syncableTableNames: Array.isArray(detail.syncableTableNames) ? detail.syncableTableNames : [],
        rangeSaving: detail.rangeSaving === true,
        bulkSyncing: detail.bulkSyncing === true,
        bulkMode: detail.bulkMode || null,
        backupLoading: detail.backupStatus?.loading === true,
      });
    };
    window.addEventListener(REPORT_ACTIVE_PANEL_EVENT, handleActivePanelChanged);
    window.addEventListener(DATA_MANAGEMENT_STATE_EVENT, handleDataManagementState);
    return () => {
      window.removeEventListener(REPORT_ACTIVE_PANEL_EVENT, handleActivePanelChanged);
      window.removeEventListener(DATA_MANAGEMENT_STATE_EVENT, handleDataManagementState);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profileState = await loadUserProfileState({ component: 'StatusBar' });
        window.__taliaUserProfileState = profileState || {};
        const criteria = profileState?.globalCriteria;
        if (criteria && typeof criteria === 'object') {
          const nextRange = TEST_DEFAULT_GLOBAL_RANGE_KEY;
          const nextDuration = typeof criteria.durationKey === 'string' ? criteria.durationKey : '';
          setGlobalDateRange(nextRange);
          if (GLOBAL_DURATION_OPTIONS.some((option) => option.key === nextDuration)) {
            setGlobalDuration(nextDuration);
          }
          if (Object.prototype.hasOwnProperty.call(criteria, 'activeOnly')) {
            setActiveOnly(criteria.activeOnly !== false);
          } else if (Object.prototype.hasOwnProperty.call(criteria, 'includeNonRealSailings')) {
            setActiveOnly(criteria.includeNonRealSailings !== true);
          }
          const savedCurrency = typeof criteria.defaultDisplayCurrency === 'string'
            ? criteria.defaultDisplayCurrency.trim().toUpperCase()
            : '';
          if (savedCurrency === 'ALL') {
            setDefaultDisplayCurrency(savedCurrency);
          } else if (/^[A-Z]{3}$/.test(savedCurrency)) {
            try {
              Intl.NumberFormat('en-US', { style: 'currency', currency: savedCurrency, maximumFractionDigits: 0 }).format(1);
              setDefaultDisplayCurrency(savedCurrency);
            } catch {
              // ignore invalid currency in profile
            }
          }
          const savedSailing = normalizePersistedSailing(
            criteria.selectedSailing || criteria.selectedSail || criteria.selectedSailCode || null
          );
          if (savedSailing) {
            setGlobalSailSelection(savedSailing);
          }
        }
      } catch (error) {
        reportActionFailure(`Failed to load header criteria: ${error?.message || 'Unknown error'}`);
      } finally {
        if (!cancelled) setProfileCriteriaHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleSailSelect = (event) => {
      const next = normalizePersistedSailing(event?.detail);
      if (!next) return;
      setGlobalSailSelection(next);
    };
    const handleSailClear = () => {
      setGlobalSailSelection(null);
    };
    window.addEventListener(SAIL_SELECT_EVENT, handleSailSelect);
    window.addEventListener(SAIL_CLEAR_EVENT, handleSailClear);
    return () => {
      window.removeEventListener(SAIL_SELECT_EVENT, handleSailSelect);
      window.removeEventListener(SAIL_CLEAR_EVENT, handleSailClear);
    };
  }, []);

  useEffect(() => {
    const range = resolveGlobalDateRange(globalDateRange || TEST_DEFAULT_GLOBAL_RANGE_KEY);
    const includeNonRealSailings = !activeOnly;
    const criteria = {
      rangeKey: range.rangeKey,
      durationKey: globalDuration,
      activeOnly,
      includeNonRealSailings,
      defaultDisplayCurrency: String(defaultDisplayCurrency || '').trim().toUpperCase() || 'USD',
      ...range
    };
    if (globalSailSelection) {
      const selectedSailing = {
        sailCode: globalSailSelection.sailCode,
        detail: globalSailSelection.detail,
        capturedAt: globalSailSelection.capturedAt || new Date().toISOString(),
      };
      criteria.selectedSailCode = selectedSailing.sailCode;
      criteria.selectedSailing = selectedSailing;
    } else {
      criteria.selectedSailCode = null;
      criteria.selectedSailing = null;
    }
    window.__taliaGlobalCriteria = criteria;
    window.dispatchEvent(
      new CustomEvent(DASHBOARD_GLOBAL_CRITERIA_EVENT, {
        detail: criteria,
      })
    );
  }, [globalDateRange, globalDuration, activeOnly, defaultDisplayCurrency]);

  useEffect(() => {
    if (!window.__taliaGlobalCriteria || typeof window.__taliaGlobalCriteria !== 'object') return;
    if (globalSailSelection) {
      window.__taliaGlobalCriteria.selectedSailCode = globalSailSelection.sailCode;
      window.__taliaGlobalCriteria.selectedSailing = {
        sailCode: globalSailSelection.sailCode,
        detail: globalSailSelection.detail,
        capturedAt: globalSailSelection.capturedAt || new Date().toISOString(),
      };
      return;
    }
    window.__taliaGlobalCriteria.selectedSailCode = null;
    window.__taliaGlobalCriteria.selectedSailing = null;
  }, [globalSailSelection]);

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
        defaultDisplayCurrency: String(defaultDisplayCurrency || '').trim().toUpperCase() || 'USD',
        ...resolveGlobalDateRange(globalDateRange),
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
  }, [profileCriteriaHydrated, globalDateRange, globalDuration, activeOnly, defaultDisplayCurrency, globalSailSelection]);

  useEffect(() => {
    enforceDashboardUiState({ dispatchEvents: true });
  }, []);

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
    <div
      className="status-bar"
      ref={statusBarRootRef}
      onMouseEnter={() => setIsHeaderInteractionActive(true)}
      onMouseLeave={() => setIsHeaderInteractionActive(false)}
      onFocusCapture={() => setIsHeaderInteractionActive(true)}
      onBlurCapture={(event) => {
        const nextFocused = event?.relatedTarget;
        if (!statusBarRootRef.current?.contains(nextFocused)) {
          setIsHeaderInteractionActive(false);
        }
      }}
    >
      <div className="status-bar__container">
        <div className="status-bar__leading">
          {currentMode === 'app' && (
            <>
              <TaliaTooltip content={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'} placement="bottom-left" delayMs={180}>
                <button
                  type="button"
                  className="status-bar__header-btn status-bar__sidebar-toggle"
                  onClick={handleSidebarToggle}
                  aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
                >
                  {sidebarCollapsed ? '☰' : '◧'}
                </button>
              </TaliaTooltip>
              <span className="status-bar__leading-separator" aria-hidden="true" />
              <div className="status-bar__quick-actions">
                <TaliaTooltip content={criteriaVisible ? 'Hide global criteria controls' : 'Show global criteria controls'} placement="bottom-left" delayMs={180}>
                  <button
                    type="button"
                    className={`status-bar__header-btn status-bar__header-btn--criteria ${criteriaVisible ? 'status-bar__header-btn--active' : ''}`}
                    onClick={handleCriteriaToggle}
                    aria-label={criteriaVisible ? 'Hide global criteria controls' : 'Show global criteria controls'}
                  >
                    <span className="status-bar__icon-search" aria-hidden="true">🔍</span>
                  </button>
                </TaliaTooltip>
                {hasAdvancedControls && (
                  <div className="status-bar__focus-controls" ref={focusControlsRef}>
                    <TaliaTooltip content={focusControlsOpen
                      ? 'Focus selector open (double-click for next focus)'
                      : 'Open focus selector (double-click for next focus)'} placement="bottom-left" delayMs={180}>
                      <button
                        type="button"
                        className={`status-bar__header-btn status-bar__header-btn--focus-top ${focusControlsOpen ? 'status-bar__header-btn--active' : ''}`}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={handleFocusTopClick}
                        onDoubleClick={handleFocusTopDoubleClick}
                        aria-label={focusControlsOpen ? 'Hide focus controls' : 'Show focus controls'}
                        aria-expanded={focusControlsOpen}
                      >
                        ◎
                      </button>
                    </TaliaTooltip>
                  </div>
                )}
              </div>
              {focusControlsOpen && (
                <>
                  <span className="status-bar__leading-separator" aria-hidden="true" />
                  <div
                    ref={focusPanelRef}
                    className={`status-bar__criteria status-bar__criteria--focus ${autoCloseFading.focus ? 'status-bar__auto-close-fade' : ''}`}
                    role="group"
                    aria-label="Focus controls"
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <TaliaTooltip content={lastFocusId ? `Switch to ${lastFocusId}` : 'Switch to last focus'} placement="bottom-left" delayMs={180}>
                      <button
                        type="button"
                        className="status-bar__header-btn status-bar__header-btn--focus-prev"
                        onClick={handleSwitchFocus}
                        aria-label="Switch focus"
                        disabled={!lastFocusId}
                      >
                        Switch
                      </button>
                    </TaliaTooltip>
                    <TaliaTooltip content="Move to next focus" placement="bottom-left" delayMs={180}>
                      <button
                        type="button"
                        className="status-bar__header-btn status-bar__header-btn--focus-next"
                        onClick={handleCycleFocus}
                        aria-label="Next focus"
                      >
                        Next
                      </button>
                    </TaliaTooltip>
                    {focusOptions.length > 0 && (
                      <div className="status-bar__focus-control">
                        <TaliaTooltip content="Quick focus selector" placement="bottom-left" delayMs={180}>
                        <label className="status-bar__header-range">
                          <span className="status-bar__header-range-label">Focus</span>
                          <HeaderCriteriaMenuSelect
                            id="status-bar-quick-focus"
                            wide
                            options={focusOptions.map((focus) => ({ key: focus.id, label: focus.name || focus.id }))}
                            value={selectedFocusId}
                            onChange={handleQuickFocusChange}
                            aria-label="Quick focus selector"
                            autoCloseMs={menuDisappearMs}
                          />
                        </label>
                        </TaliaTooltip>
                        {selectedFocusId && (
                          <div className="status-bar__focus-save">
                            <TaliaTooltip content="Save current focus" placement="bottom-left" delayMs={180}>
                              <button
                                type="button"
                                className="status-bar__header-btn status-bar__header-btn--focus-save"
                                aria-label="Save current focus"
                                onClick={handleSaveFocusAction}
                              >
                                💾
                              </button>
                            </TaliaTooltip>
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
                  </div>
                </>
              )}
              {criteriaVisible && (
                <>
                  <span className="status-bar__leading-separator" aria-hidden="true" />
                  <div className={`status-bar__criteria ${autoCloseFading.criteria ? 'status-bar__auto-close-fade' : ''}`}>
                    <TaliaTooltip content="Global date range applied across reports" placement="bottom-left" delayMs={180}>
                    <label className="status-bar__header-range">
                      <span className="status-bar__header-range-label">Date</span>
                      <HeaderCriteriaMenuSelect
                        id="status-bar-global-date-range"
                        options={GLOBAL_DATE_RANGE_OPTIONS}
                        value={globalDateRange}
                        onChange={handleGlobalDateRangeChange}
                        aria-label="Global date range"
                        autoCloseMs={menuDisappearMs}
                      />
                    </label>
                    </TaliaTooltip>
                    <TaliaTooltip content="Global duration criteria applied across reports" placement="bottom-left" delayMs={180}>
                    <label className="status-bar__header-range">
                      <span className="status-bar__header-range-label">Dur</span>
                      <HeaderCriteriaMenuSelect
                        id="status-bar-global-duration"
                        options={GLOBAL_DURATION_OPTIONS}
                        value={globalDuration}
                        onChange={handleGlobalDurationChange}
                        aria-label="Global duration criteria"
                        autoCloseMs={menuDisappearMs}
                      />
                    </label>
                    </TaliaTooltip>
                    <TaliaTooltip content="Default currency for prices when missing or when choosing among published-rate rows" placement="bottom-left" delayMs={180}>
                    <label className="status-bar__header-range">
                      <span className="status-bar__header-range-label">Curr</span>
                      <HeaderCriteriaMenuSelect
                        id="status-bar-global-display-currency"
                        options={displayCurrencyOptions}
                        value={defaultDisplayCurrency}
                        onChange={handleGlobalDisplayCurrencyChange}
                        aria-label="Default display currency"
                        autoCloseMs={menuDisappearMs}
                      />
                    </label>
                    </TaliaTooltip>
                    <TaliaTooltip content="Show active sailings only" placement="bottom-left" delayMs={180}>
                    <label className="status-bar__header-toggle" htmlFor="status-bar-active-only">
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
                    </TaliaTooltip>
                    <TaliaTooltip content="Switch between local and wide dashboard scope" placement="bottom-left" delayMs={180}>
                    <label className="status-bar__header-toggle" htmlFor="status-bar-view-scope-wide">
                      <input
                        id="status-bar-view-scope-wide"
                        type="checkbox"
                        className="status-bar__header-checkbox"
                        checked={viewScope === 'wide'}
                        onChange={handleViewScopeToggle}
                        aria-label="Wide dashboard scope"
                      />
                      <span className="status-bar__header-range-label">Wide</span>
                    </label>
                    </TaliaTooltip>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {resolvedHeaderLogoSrc && !headerLogoBroken && !headerLogoSuppressed && (
          <div
            className="status-bar__brand"
            role="img"
            aria-label="Header logo"
          >
            <img
              key={resolvedHeaderLogoSrc}
              className="status-bar__brand-mark"
              src={resolvedHeaderLogoSrc}
              alt=""
              decoding="async"
              onError={() => setHeaderLogoBroken(true)}
            />
          </div>
        )}

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
            <TaliaTooltip content="Global data range and last sync" placement="bottom-left" delayMs={180}>
              <div className="status-bar__item">
                <span className="status-bar__label">Data:</span>
                <span className="status-bar__value">Range {dataRangeText}</span>
                <span className="status-bar__timestamp">Last Sync {dataLastSyncText}</span>
              </div>
            </TaliaTooltip>
          )}
        </div>

        <div className="status-bar__right">
          {eventsVisible && (
            <div className={`status-bar__advanced ${autoCloseFading.advanced ? 'status-bar__auto-close-fade' : ''}`}>
              {currentMode === 'app' && hasAdvancedControls && (
                <div className="status-bar__events">
                  {currentEventSummary && (
                    <TaliaTooltip content="Click to view details" placement="bottom-left" delayMs={180}>
                    <div
                      className="status-bar__item status-bar__item--clickable"
                      onClick={() => setShowDetails(!showDetails)}
                    >
                      <span className="status-bar__label">Current Event:</span>
                      <span className="status-bar__value">
                        {currentEventSummary.source}
                        {currentEventSummary.identifier && ` - ${currentEventSummary.identifier}`}
                      </span>
                      <span className="status-bar__timestamp">{currentEventSummary.timestamp}</span>
                      <span className="status-bar__expand">{showDetails ? '▲' : '▼'}</span>
                    </div>
                    </TaliaTooltip>
                  )}
                  {persistedEventSummary && (
                    <TaliaTooltip content="Click to view details" placement="bottom-left" delayMs={180}>
                    <div
                      className="status-bar__item status-bar__item--clickable"
                      onClick={() => setShowDetails(!showDetails)}
                    >
                      <span className="status-bar__label">Persisted:</span>
                      <span className="status-bar__value">
                        {persistedEventSummary.source}
                        {persistedEventSummary.identifier && ` - ${persistedEventSummary.identifier}`}
                      </span>
                      <span className="status-bar__timestamp">{persistedEventSummary.timestamp}</span>
                    </div>
                    </TaliaTooltip>
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
          {visibilityControlsOpen && (
            <div
              ref={visibilityPanelRef}
              className={`status-bar__criteria status-bar__criteria--visibility ${autoCloseFading.visibility ? 'status-bar__auto-close-fade' : ''}`}
              role="menu"
              aria-label="Visibility controls"
              onPointerDown={(event) => event.stopPropagation()}
            >
              {styleSelectOptions.length > 0 && (
                <TaliaTooltip
                  content={
                    styleMenuUsesProfiles
                      ? 'Saved appearance profiles first, then all palette themes (built-in + registry)'
                      : 'Built-in palette themes plus any keys from the UI theme registry'
                  }
                  placement="bottom-left"
                  delayMs={180}
                >
                  <div className="status-bar__header-range">
                    <span className="status-bar__header-range-label">Style</span>
                    <HeaderCriteriaMenuSelect
                      id="status-bar-appearance-profile-visibility"
                      wide
                      options={styleSelectOptions}
                      value={styleSelectValue}
                      onChange={handleStyleVisibilityChange}
                      aria-label={
                        styleMenuUsesProfiles
                          ? 'Appearance profiles and palette themes'
                          : 'Palette theme selector'
                      }
                      autoCloseMs={menuDisappearMs}
                    />
                  </div>
                </TaliaTooltip>
              )}
              <TaliaTooltip content="Show or hide filter rows on all reports" placement="bottom-left" delayMs={180}>
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={filtersVisible}
                  className={`status-bar__visibility-option ${filtersVisible ? 'status-bar__visibility-option--active' : ''}`}
                  onClick={handleFiltersToggle}
                >
                  <span>Filters</span>
                  {filtersVisible ? <span className="status-bar__menu-select-check" aria-hidden="true">✓</span> : null}
                </button>
              </TaliaTooltip>
              <TaliaTooltip content="Show or hide native Tabulator column header filters on all tables" placement="bottom-left" delayMs={180}>
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={tabulatorFiltersVisible}
                  className={`status-bar__visibility-option ${tabulatorFiltersVisible ? 'status-bar__visibility-option--active' : ''}`}
                  onClick={handleTabulatorFiltersToggle}
                >
                  <span>Column filters</span>
                  {tabulatorFiltersVisible ? <span className="status-bar__menu-select-check" aria-hidden="true">✓</span> : null}
                </button>
              </TaliaTooltip>
              <TaliaTooltip content="Show or hide informational callouts across all reports" placement="bottom-left" delayMs={180}>
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={calloutsVisible}
                  className={`status-bar__visibility-option ${calloutsVisible ? 'status-bar__visibility-option--active' : ''}`}
                  onClick={handleCalloutsToggle}
                >
                  <span>Callouts</span>
                  {calloutsVisible ? <span className="status-bar__menu-select-check" aria-hidden="true">✓</span> : null}
                </button>
              </TaliaTooltip>
              <TaliaTooltip content="Show or hide panel operations (actions + controls) across all reports" placement="bottom-left" delayMs={180}>
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={actionsVisible && controlsVisible}
                  className={`status-bar__visibility-option ${(actionsVisible && controlsVisible) ? 'status-bar__visibility-option--active' : ''}`}
                  onClick={handleActionsToggle}
                >
                  <span>Operations</span>
                  {(actionsVisible && controlsVisible) ? <span className="status-bar__menu-select-check" aria-hidden="true">✓</span> : null}
                </button>
              </TaliaTooltip>
              <TaliaTooltip content="Show or hide panel titles globally" placement="bottom-left" delayMs={180}>
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={panelTitlesVisible}
                  className={`status-bar__visibility-option ${panelTitlesVisible ? 'status-bar__visibility-option--active' : ''}`}
                  onClick={handlePanelTitlesToggle}
                >
                  <span>Titles</span>
                  {panelTitlesVisible ? <span className="status-bar__menu-select-check" aria-hidden="true">✓</span> : null}
                </button>
              </TaliaTooltip>
              <TaliaTooltip content="Show or hide data details on all report panels" placement="bottom-left" delayMs={180}>
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={detailsVisible}
                  className={`status-bar__visibility-option ${detailsVisible ? 'status-bar__visibility-option--active' : ''}`}
                  onClick={handleDetailsToggle}
                >
                  <span>Details</span>
                  {detailsVisible ? <span className="status-bar__menu-select-check" aria-hidden="true">✓</span> : null}
                </button>
              </TaliaTooltip>
              <TaliaTooltip content="Use adaptive best-fit table layout" placement="bottom-left" delayMs={180}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={tableLayoutMode === 'best'}
                  className={`status-bar__visibility-option ${tableLayoutMode === 'best' ? 'status-bar__visibility-option--active' : ''}`}
                  onClick={() => handleTableLayoutSelect('best')}
                >
                  <span>Best Fit</span>
                  {tableLayoutMode === 'best' ? <span className="status-bar__menu-select-check" aria-hidden="true">✓</span> : null}
                </button>
              </TaliaTooltip>
              <TaliaTooltip content="Use width-fit table layout" placement="bottom-left" delayMs={180}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={tableLayoutMode === 'width'}
                  className={`status-bar__visibility-option ${tableLayoutMode === 'width' ? 'status-bar__visibility-option--active' : ''}`}
                  onClick={() => handleTableLayoutSelect('width')}
                >
                  <span>Fit Width</span>
                  {tableLayoutMode === 'width' ? <span className="status-bar__menu-select-check" aria-hidden="true">✓</span> : null}
                </button>
              </TaliaTooltip>
              <TaliaTooltip content="Use data-fit table layout" placement="bottom-left" delayMs={180}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={tableLayoutMode === 'data'}
                  className={`status-bar__visibility-option ${tableLayoutMode === 'data' ? 'status-bar__visibility-option--active' : ''}`}
                  onClick={() => handleTableLayoutSelect('data')}
                >
                  <span>Fit Data</span>
                  {tableLayoutMode === 'data' ? <span className="status-bar__menu-select-check" aria-hidden="true">✓</span> : null}
                </button>
              </TaliaTooltip>
            </div>
          )}
          {currentMode === 'app' && (
            <div className="status-bar__visibility-controls" ref={visibilityControlsRef}>
              <TaliaTooltip content={visibilityControlsOpen ? 'Hide visibility controls' : 'Show visibility controls'} placement="bottom-left" delayMs={180}>
                <button
                  type="button"
                  className={`status-bar__header-btn status-bar__header-btn--visibility ${visibilityControlsOpen ? 'status-bar__header-btn--active' : ''}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={handleVisibilityToggle}
                  aria-label={visibilityControlsOpen ? 'Hide visibility controls' : 'Show visibility controls'}
                >
                  👁
                </button>
              </TaliaTooltip>
            </div>
          )}
          {currentMode === 'app' && (
            <TaliaTooltip content={refreshButtonTitle} placement="bottom-left" delayMs={180}>
              <button
                type="button"
                className={`status-bar__header-btn ${refreshPhase !== 'active' ? 'status-bar__header-btn--active' : ''}`}
                onClick={handleGlobalRefreshCycle}
                aria-label={refreshButtonTitle}
                disabled={refreshPhase === 'cooldown'}
              >
                {refreshButtonLabel}
              </button>
            </TaliaTooltip>
          )}
          <TaliaTooltip content={eventsVisible ? 'Hide advanced header controls' : 'Show advanced header controls'} placement="bottom-left" delayMs={180}>
            <button
              type="button"
              className={`status-bar__header-btn status-bar__header-btn--advanced ${eventsVisible ? 'status-bar__header-btn--active' : ''}`}
              onClick={handleEventsToggle}
              aria-label={eventsVisible ? 'Hide advanced header controls' : 'Show advanced header controls'}
            >
              <span className="status-bar__icon-graph" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
          </TaliaTooltip>
        </div>

      </div>

      {showDataAdminStrip && (
        <div className="status-bar__data-admin">
          <span className="status-bar__data-admin-title">Data Mgmt</span>
          {showDataAdminFilters && (
            <>
              <label className="status-bar__data-admin-range">
                <span className="status-bar__header-range-label">Table</span>
                <HeaderCriteriaMenuSelect
                  id="status-bar-data-management-table"
                  wide
                  options={[
                    { key: '', label: 'Select table' },
                    ...(dataMgmtState.syncableTableNames || []).map((tableName) => ({ key: tableName, label: tableName })),
                  ]}
                  value={dataMgmtState.selectedTable || ''}
                  onChange={handleDataMgmtSelectTable}
                  aria-label="Data Management target table"
                  autoCloseMs={menuDisappearMs}
                />
              </label>
              <label className="status-bar__data-admin-range">
                <span className="status-bar__header-range-label">From</span>
                <input
                  type="date"
                  value={dataMgmtState.rangeDraft.from || ''}
                  onChange={(event) => handleDataMgmtRangeInput('from', event.target.value)}
                  className="status-bar__data-admin-input"
                  aria-label="Data Management range start"
                />
              </label>
              <label className="status-bar__data-admin-range">
                <span className="status-bar__header-range-label">To</span>
                <input
                  type="date"
                  value={dataMgmtState.rangeDraft.to || ''}
                  onChange={(event) => handleDataMgmtRangeInput('to', event.target.value)}
                  className="status-bar__data-admin-input"
                  aria-label="Data Management range end"
                />
              </label>
              <TaliaTooltip content="Save integration date range" placement="bottom-left" delayMs={180}>
                <button
                  type="button"
                  className="status-bar__header-btn"
                  onClick={handleDataMgmtSaveRange}
                  disabled={dataMgmtState.rangeSaving}
                  aria-label="Save integration date range"
                >
                  {dataMgmtState.rangeSaving ? '⏳' : '✓'}
                </button>
              </TaliaTooltip>
            </>
          )}
          {showDataAdminActions && (
            <>
              <TaliaTooltip content="Status for selected table" placement="bottom-left" delayMs={180}>
                <button
                  type="button"
                  className="status-bar__header-btn"
                  onClick={() => handleDataMgmtTableAction('status')}
                  aria-label="Status for selected table"
                  disabled={!dataMgmtState.selectedTable}
                >
                  🧾
                </button>
              </TaliaTooltip>
              <TaliaTooltip content="Review selected table rows" placement="bottom-left" delayMs={180}>
                <button
                  type="button"
                  className="status-bar__header-btn"
                  onClick={() => handleDataMgmtTableAction('review')}
                  aria-label="Review selected table rows"
                  disabled={!dataMgmtState.selectedTable}
                >
                  👁️
                </button>
              </TaliaTooltip>
              <TaliaTooltip content="Sync selected table" placement="bottom-left" delayMs={180}>
                <button
                  type="button"
                  className="status-bar__header-btn"
                  onClick={() => handleDataMgmtTableAction('sync')}
                  aria-label="Sync selected table"
                  disabled={!dataMgmtState.selectedTable}
                >
                  🔄
                </button>
              </TaliaTooltip>
              <TaliaTooltip content="Full update selected table" placement="bottom-left" delayMs={180}>
                <button
                  type="button"
                  className="status-bar__header-btn"
                  onClick={() => handleDataMgmtTableAction('full')}
                  aria-label="Full update selected table"
                  disabled={!dataMgmtState.selectedTable}
                >
                  ⚡
                </button>
              </TaliaTooltip>
              <TaliaTooltip content="Sync all configured tables" placement="bottom-left" delayMs={180}>
                <button
                  type="button"
                  className={`status-bar__header-btn ${dataMgmtState.bulkSyncing && dataMgmtState.bulkMode === 'sync' ? 'status-bar__header-btn--active' : ''}`}
                  onClick={() => handleDataMgmtSyncAll('sync')}
                  disabled={dataMgmtState.bulkSyncing}
                  aria-label="Sync all configured tables"
                >
                  ↻
                </button>
              </TaliaTooltip>
              <TaliaTooltip content="Full update all configured tables" placement="bottom-left" delayMs={180}>
                <button
                  type="button"
                  className={`status-bar__header-btn ${dataMgmtState.bulkSyncing && dataMgmtState.bulkMode === 'full' ? 'status-bar__header-btn--active' : ''}`}
                  onClick={() => handleDataMgmtSyncAll('full')}
                  disabled={dataMgmtState.bulkSyncing}
                  aria-label="Full update all configured tables"
                >
                  ⚡
                </button>
              </TaliaTooltip>
              <TaliaTooltip content="Backup tools" placement="bottom-left" delayMs={180}>
                <button
                  type="button"
                  className="status-bar__header-btn"
                  onClick={handleDataMgmtBackup}
                  disabled={dataMgmtState.backupLoading}
                  aria-label="Backup tools"
                >
                  {dataMgmtState.backupLoading ? '⏳' : '💾'}
                </button>
              </TaliaTooltip>
              <TaliaTooltip content="Refresh Data Management state" placement="bottom-left" delayMs={180}>
                <button
                  type="button"
                  className="status-bar__header-btn"
                  onClick={handleDataMgmtRefresh}
                  aria-label="Refresh Data Management state"
                >
                  ⟳
                </button>
              </TaliaTooltip>
            </>
          )}
        </div>
      )}

      {/* Details Panel */}
      {hasAdvancedControls && showDetails && (currentEventSummary || persistedEventSummary) && (
        <div className="status-bar__details">
          <div className="status-bar__details-header">
            <span className="status-bar__details-title">Event Details</span>
            <TaliaTooltip content="Close" placement="bottom-left" delayMs={180}>
              <button 
                className="status-bar__details-close"
                onClick={() => setShowDetails(false)}
              >
                ×
              </button>
            </TaliaTooltip>
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
