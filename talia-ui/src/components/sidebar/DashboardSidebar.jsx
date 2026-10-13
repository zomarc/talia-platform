import React from "react";
import reportRegistry, { canRoleAccessComponent } from "../focus-panels/registry";
import UserProfile from "../UserProfile";
import { isAdmin } from "../../utils/roleUtils";
import { FocusSelector } from "../focus-management";
import { useTheme } from "../../contexts/ThemeContext";
import { resolveAppPublicUrl } from "../../lib/headerLogoAsset";
import TaliaBrandMark from "../shared/TaliaBrandMark";
import {
  DASHBOARD_DETAILS_VISIBILITY_EVENT,
  DASHBOARD_FILTER_VISIBILITY_EVENT,
  DASHBOARD_TABULATOR_FILTER_VISIBILITY_EVENT,
  DASHBOARD_TABLE_LAYOUT_EVENT,
} from "../dockview/eventConstants";
import {
  getGlobalReportDetailsVisible,
  setGlobalReportDetailsVisible,
  clearPanelReportDetailsOverrides,
} from "../../services/panelDetailsState";
import { publishDashboardGlobalConfig } from "../../services/dashboardUiState";
import TaliaTooltip from "../shared/TaliaTooltip";

const FILTERS_VISIBILITY_STORAGE_KEY = 'taliaHeaderFiltersVisible';
const TABULATOR_FILTERS_VISIBILITY_STORAGE_KEY = 'taliaHeaderTabulatorFiltersVisible';
const TABLE_LAYOUT_STORAGE_KEY = 'taliaTableLayoutMode';
const SIDEBAR_SECTIONS_STORAGE_KEY = 'taliaSidebarExpandedSections';
const REPORT_USE_COUNTS_KEY = 'taliaReportUseCounts';
const REPORT_GROUPS_OPEN_KEY = 'taliaReportGroupsOpen';
const REPORT_MOST_USED_KEY = 'taliaReportMostUsed';
const REPORT_FLAGS_KEY = 'taliaReportFlags';
const REPORT_BUCKETS_KEY = 'taliaReportBucketsOpen';

const PROFILE_TOOL_REPORTS = [
  {
    key: 'real-profile',
    panelId: 'booking-profile',
    label: '① Real profile',
    title: 'Real booking profile (+ YoY)',
    params: { reportId: 'booking-profile', includeComparison: false },
    tip: 'Goal ① REAL: inventory-scoped curves; breakdown by market / group / currency; absolute or load-factor %.',
  },
  {
    key: 'real-yoy',
    panelId: 'booking-profile',
    label: '① Real + YoY',
    title: 'Real booking profile + YoY',
    params: { reportId: 'booking-profile', includeComparison: true },
    tip: 'Goal ① with YoY overlay (illustrative — recent years are weak futures proxies). Peer sail auto-resolved when possible.',
  },
  {
    key: 'imported-targets',
    panelId: 'booking-target-data-simple',
    label: '② Imported targets',
    title: 'TARGET only (imported)',
    params: { reportId: 'booking-target-data-simple' },
    tip: 'Goal ② TARGET: curve from Data Management import (booking_targets_supplied)',
  },
  {
    key: 'sailing-profile',
    panelId: 'profile-compare',
    label: 'Sailing Profile',
    title: 'Sailing Profile',
    params: { reportId: 'profile-compare' },
    tip: 'Sailing Profile: REAL vs model prior (lazy/manual map), optional active target + budget gap',
  },
  {
    key: 'target-profiles',
    panelId: 'inventory-target-profile-editor',
    label: 'Target profiles',
    title: 'Target Profile Editor',
    params: { reportId: 'inventory-target-profile-editor' },
    tip: 'Target Profile Editor — define/activate LF goal curves per voyage (Manager+).',
  },
  {
    key: 'profile-aggregations',
    panelId: 'profile-aggregations',
    label: 'Profile aggregations',
    title: 'Profile Aggregations',
    params: { reportId: 'profile-aggregations' },
    tip: 'Read-only profile coverage by ship×month or DOW×duration',
  },
  {
    key: 'overlay',
    panelId: 'booking-combined-data-simple',
    label: 'Overlay (all streams)',
    title: 'Overlay: REAL + TARGET + MODEL',
    params: { reportId: 'booking-combined-data-simple' },
    tip: 'Overlay REAL, imported TARGET, BUDGET, and inventory MODEL on one chart',
  },
  {
    key: 'model-editor',
    panelId: 'booking-target-profile-editor-simple',
    label: '③ Model editor (graph)',
    title: 'MODEL profile editor (graph)',
    params: { reportId: 'booking-target-profile-editor-simple' },
    tip: 'Goal ③ MODEL: drag points / edit table, save consolidated curve on inventory item',
  },
];

function readStoredObject(key) {
  try {
    const raw = window.localStorage?.getItem?.(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function readDockviewOpenCounts() {
  const panels = window.dockviewApi?.panels;
  const counts = {};
  const list = [];
  if (Array.isArray(panels)) {
    list.push(...panels);
  } else if (panels && typeof panels.forEach === 'function') {
    panels.forEach((panel) => list.push(panel));
  }
  list.forEach((panel) => {
    const id = panel?.api?.component || panel?.component || panel?.params?.component;
    if (!id) return;
    counts[id] = (counts[id] || 0) + 1;
  });
  return counts;
}
const TABLE_LAYOUT_MODES = ['best', 'width', 'data'];

function DashboardSidebar({
  isCollapsed,
  onAddPanel,
  currentFocus,
  onFocusChange,
  userRole,
  focusLoading,
  focusError,
  onSaveCurrentLayout,
}) {
  const {
    fontFamily,
    setFontFamily,
    selectedFont,
    fontFamilies,
    fontSize,
    setFontSize,
    textIntensity,
    setTextIntensity,
    groupColorIntensity,
    setGroupColorIntensity,
    rowColorIntensity,
    setRowColorIntensity,
    oddRowIntensity,
    setOddRowIntensity,
    cardColorIntensity,
    setCardColorIntensity,
    evenRowIntensity,
    setEvenRowIntensity,
    componentPadding,
    setComponentPadding,
    groupColorHex,
    setGroupColorHex,
    rowHoverColorHex,
    setRowHoverColorHex,
    oddRowColorHex,
    setOddRowColorHex,
    evenRowColorHex,
    setEvenRowColorHex,
    tableHeaderColorHex,
    setTableHeaderColorHex,
    cardColorHex,
    setCardColorHex,
    tableHeaderIntensity,
    setTableHeaderIntensity,
    tabContrastIntensity,
    setTabContrastIntensity,
    tabColorHex,
    setTabColorHex,
    tabFontScalePercent,
    setTabFontScalePercent,
    tabInactiveIntensity,
    setTabInactiveIntensity,
    panelTitlesVisible,
    setPanelTitlesVisible,
    menuDisappearMs,
    setMenuDisappearMs,
    hoverPreviewDelayMs,
    setHoverPreviewDelayMs,
    hoverPreviewOpacity,
    setHoverPreviewOpacity,
    sidebarAutoCloseEnabled,
    setSidebarAutoCloseEnabled,
    sidebarAutoCloseMs,
    setSidebarAutoCloseMs,
    sidebarDisplayMode,
    setSidebarDisplayMode,
    calloutsVisible,
    setCalloutsVisible,
    chartLegendsVisible,
    setChartLegendsVisible,
    gameSoundEnabled,
    setGameSoundEnabled,
    defaultDisplayCurrency,
    setDefaultDisplayCurrency,
    tableLayoutMode: themeTableLayoutMode,
    setTableLayoutMode: setThemeTableLayoutMode,
    appearanceDbLoaded,
    appearanceProfiles,
    activeAppearanceProfileId,
    applyAppearanceProfile,
    saveAppearanceProfile,
    appearanceStyleSelectOptions,
    appearanceStyleSelectValue,
    applyAppearanceStyleSelectKey,
    bgColor,
    headerLogoUrl,
    setHeaderLogoUrl,
    headerLogoVisible,
    setHeaderLogoVisible,
    mergedTaliaUiThemes,
    customBackgroundHex,
    setCustomBackgroundHex,
  } = useTheme();

  const themeSolidToHex = (solid) => {
    if (!solid || solid.length !== 3) return '#1a1d33';
    const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return `#${h(solid[0])}${h(solid[1])}${h(solid[2])}`;
  };
  const themeBgHexFallback = themeSolidToHex(mergedTaliaUiThemes[bgColor]?.bg?.solid);
  const backgroundColorPickerValue = customBackgroundHex || themeBgHexFallback;
  const [appearanceProfileName, setAppearanceProfileName] = React.useState('');
  const [lastUploadedLogoName, setLastUploadedLogoName] = React.useState('');

  const resolveCustomLogoPreviewSrc = (raw) => {
    const t = String(raw || '').trim();
    if (!t) return '';
    if (t.startsWith('http://') || t.startsWith('https://') || t.startsWith('data:')) return t;
    const path = t.startsWith('/') ? t.slice(1) : t;
    return resolveAppPublicUrl(path);
  };

  const customHeaderLogoPreviewSrc = headerLogoVisible
    ? resolveCustomLogoPreviewSrc(headerLogoUrl)
    : '';
  const useDefaultTaliaBrandPreview = headerLogoVisible && !customHeaderLogoPreviewSrc;

  const handleHeaderLogoFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !file.type.startsWith('image/')) {
      setLastUploadedLogoName('');
      return;
    }
    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      window.alert('Please choose an image under 2 MB.');
      setLastUploadedLogoName('');
      return;
    }
    setLastUploadedLogoName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setHeaderLogoUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };
  const [globalFiltersVisible, setGlobalFiltersVisible] = React.useState(() => {
    try {
      const saved = window.localStorage?.getItem?.(FILTERS_VISIBILITY_STORAGE_KEY);
      if (saved === '0') return false;
      if (saved === '1') return true;
    } catch {
      // ignore
    }
    return window.__taliaFiltersVisible !== false;
  });
  const [globalTabulatorFiltersVisible, setGlobalTabulatorFiltersVisible] = React.useState(() => {
    try {
      const saved = window.localStorage?.getItem?.(TABULATOR_FILTERS_VISIBILITY_STORAGE_KEY);
      if (saved === '0') return false;
      if (saved === '1') return true;
    } catch {
      // ignore
    }
    return window.__taliaTabulatorFiltersVisible !== false;
  });
  const [globalDetailsVisible, setGlobalDetailsVisible] = React.useState(() => getGlobalReportDetailsVisible());
  const [globalTableLayoutMode, setGlobalTableLayoutMode] = React.useState(() => {
    try {
      const saved = window.localStorage?.getItem?.(TABLE_LAYOUT_STORAGE_KEY);
      if (TABLE_LAYOUT_MODES.includes(saved)) return saved;
    } catch {
      // ignore
    }
    return TABLE_LAYOUT_MODES.includes(window.__taliaTableLayoutMode) ? window.__taliaTableLayoutMode : 'best';
  });

  React.useEffect(() => {
    const activeProfile = appearanceProfiles.find((entry) => entry.id === activeAppearanceProfileId);
    setAppearanceProfileName(activeProfile?.name || '');
  }, [appearanceProfiles, activeAppearanceProfileId]);

  React.useEffect(() => {
    const handleFilterVisibilityEvent = (event) => {
      const visible = event?.detail?.visible;
      if (typeof visible === 'boolean') {
        setGlobalFiltersVisible(visible);
      }
    };
    const handleTabulatorFilterVisibilityEvent = (event) => {
      const visible = event?.detail?.visible;
      if (typeof visible === 'boolean') {
        setGlobalTabulatorFiltersVisible(visible);
      }
    };
    const handleTableLayoutEvent = (event) => {
      const mode = event?.detail?.mode;
      if (TABLE_LAYOUT_MODES.includes(mode)) {
        setGlobalTableLayoutMode(mode);
      }
    };
    const handleDetailsVisibilityEvent = (event) => {
      const visible = event?.detail?.visible;
      if (typeof visible === 'boolean') {
        setGlobalDetailsVisible(visible);
      }
    };
    window.addEventListener(DASHBOARD_FILTER_VISIBILITY_EVENT, handleFilterVisibilityEvent);
    window.addEventListener(DASHBOARD_TABULATOR_FILTER_VISIBILITY_EVENT, handleTabulatorFilterVisibilityEvent);
    window.addEventListener(DASHBOARD_TABLE_LAYOUT_EVENT, handleTableLayoutEvent);
    window.addEventListener(DASHBOARD_DETAILS_VISIBILITY_EVENT, handleDetailsVisibilityEvent);
    return () => {
      window.removeEventListener(DASHBOARD_FILTER_VISIBILITY_EVENT, handleFilterVisibilityEvent);
      window.removeEventListener(DASHBOARD_TABULATOR_FILTER_VISIBILITY_EVENT, handleTabulatorFilterVisibilityEvent);
      window.removeEventListener(DASHBOARD_TABLE_LAYOUT_EVENT, handleTableLayoutEvent);
      window.removeEventListener(DASHBOARD_DETAILS_VISIBILITY_EVENT, handleDetailsVisibilityEvent);
    };
  }, []);

  const handleGlobalFiltersToggle = (checked) => {
    setGlobalFiltersVisible(checked);
    window.__taliaFiltersVisible = checked;
    const root = document.documentElement;
    if (checked) {
      root.classList.remove('talia-filters-hidden');
    } else {
      root.classList.add('talia-filters-hidden');
    }
    try {
      window.localStorage?.setItem?.(FILTERS_VISIBILITY_STORAGE_KEY, checked ? '1' : '0');
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent(DASHBOARD_FILTER_VISIBILITY_EVENT, {
      detail: { visible: checked },
    }));
  };

  const handleGlobalTabulatorFiltersToggle = (checked) => {
    setGlobalTabulatorFiltersVisible(checked);
    window.__taliaTabulatorFiltersVisible = checked;
    const root = document.documentElement;
    root.classList.toggle('talia-tabulator-filters-hidden', checked === false);
    try {
      window.localStorage?.setItem?.(TABULATOR_FILTERS_VISIBILITY_STORAGE_KEY, checked ? '1' : '0');
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent(DASHBOARD_TABULATOR_FILTER_VISIBILITY_EVENT, {
      detail: { visible: checked },
    }));
  };

  const handleGlobalDetailsToggle = (checked) => {
    setGlobalDetailsVisible(checked);
    setGlobalReportDetailsVisible(checked);
    clearPanelReportDetailsOverrides();
    publishDashboardGlobalConfig({ detailsVisible: checked });
  };

  const handleTableLayoutModeChange = (nextMode) => {
    if (!TABLE_LAYOUT_MODES.includes(nextMode)) return;
    setGlobalTableLayoutMode(nextMode);
    if (typeof setThemeTableLayoutMode === 'function') {
      setThemeTableLayoutMode(nextMode);
    } else {
      publishDashboardGlobalConfig({ tableLayoutMode: nextMode });
    }
  };

  const reportGroups = React.useMemo(() => {
    const items = Object.values(reportRegistry)
      .filter((report) => report.showInReports && report.panelId && canRoleAccessComponent(report, userRole))
      .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    const grouped = {};
    items.forEach((report) => {
      const category = report.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(report);
    });
    return grouped;
  }, [userRole]);

  const [reportUseCounts, setReportUseCounts] = React.useState(() => readStoredObject(REPORT_USE_COUNTS_KEY));
  const [reportGroupsOpen, setReportGroupsOpen] = React.useState(() => readStoredObject(REPORT_GROUPS_OPEN_KEY));
  const [mostUsedFirst, setMostUsedFirst] = React.useState(() => {
    try {
      return window.localStorage?.getItem?.(REPORT_MOST_USED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [openNowCounts, setOpenNowCounts] = React.useState({});

  React.useEffect(() => {
    let disposed = false;
    const disposers = [];
    const read = () => {
      if (!disposed) setOpenNowCounts(readDockviewOpenCounts());
    };
    const attach = () => {
      const api = window.dockviewApi;
      if (!api || attach.bound) return Boolean(api && attach.bound);
      attach.bound = true;
      read();
      const add = api.onDidAddPanel?.(read);
      const remove = api.onDidRemovePanel?.(read);
      if (add) disposers.push(add);
      if (remove) disposers.push(remove);
      return true;
    };
    if (!attach()) {
      const timer = window.setInterval(() => {
        if (attach()) window.clearInterval(timer);
      }, 1000);
      disposers.push({ dispose: () => window.clearInterval(timer) });
    }
    return () => {
      disposed = true;
      disposers.forEach((disposer) => disposer?.dispose?.());
    };
  }, []);

  const recordReportUse = (panelId) => {
    setReportUseCounts((prev) => {
      const next = { ...prev, [panelId]: (Number(prev[panelId]) || 0) + 1 };
      try {
        window.localStorage?.setItem?.(REPORT_USE_COUNTS_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota */
      }
      return next;
    });
  };

  const addReportPanel = (panelId, label, params) => {
    recordReportUse(panelId);
    onAddPanel(panelId, label, params);
  };

  const toggleReportGroup = (groupId) => {
    setReportGroupsOpen((prev) => {
      const next = { ...prev, [groupId]: prev[groupId] !== true };
      try {
        window.localStorage?.setItem?.(REPORT_GROUPS_OPEN_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota */
      }
      return next;
    });
  };

  const toggleMostUsed = () => {
    setMostUsedFirst((prev) => {
      const next = !prev;
      try {
        window.localStorage?.setItem?.(REPORT_MOST_USED_KEY, next ? '1' : '0');
      } catch {
        /* ignore quota */
      }
      return next;
    });
  };

  const usageFor = (panelId) => Number(reportUseCounts[panelId]) || 0;

  const sectionBadge = (panelIds, itemCount) => {
    const unique = [...new Set(panelIds)];
    const open = unique.reduce((sum, id) => sum + (openNowCounts[id] || 0), 0);
    const used = unique.reduce((sum, id) => sum + usageFor(id), 0);
    if (open > 0) return `${open} open`;
    if (used > 0) return `${used} used`;
    return String(itemCount);
  };

  const [reportFlags, setReportFlags] = React.useState(() => readStoredObject(REPORT_FLAGS_KEY));
  const [reportBucketsOpen, setReportBucketsOpen] = React.useState(() => {
    const stored = readStoredObject(REPORT_BUCKETS_KEY);
    return {
      starred: stored.starred !== false,
      rest: stored.rest === true,
      retired: stored.retired === true,
    };
  });

  const reportCatalog = React.useMemo(() => {
    const profile = PROFILE_TOOL_REPORTS.map((item) => ({
      id: `profile:${item.key}`,
      panelId: item.panelId,
      label: item.label,
      title: item.title,
      params: item.params,
      tip: item.tip,
      category: 'Profile Tools',
      categoryId: 'profile-tools',
      legacy: false,
    }));
    const fromRegistry = Object.entries(reportGroups).flatMap(([category, reports]) => reports.map((report) => ({
      id: `report:${report.panelId}`,
      panelId: report.panelId,
      label: report.title,
      title: report.title,
      params: { reportId: report.panelId },
      tip: report.legacy ? `${report.description || ''} Legacy component.` : report.description,
      category,
      categoryId: category,
      legacy: report.legacy === true,
    })));
    return [...profile, ...fromRegistry];
  }, [reportGroups]);

  const setReportFlag = (id, patch) => {
    setReportFlags((prev) => {
      const next = { ...prev, [id]: { ...(prev[id] || {}), ...patch } };
      try {
        window.localStorage?.setItem?.(REPORT_FLAGS_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota */
      }
      return next;
    });
  };

  const reportIsStarred = (id) => reportFlags[id]?.starred === true;
  const reportIsLegacy = (item) => (
    typeof reportFlags[item.id]?.legacy === 'boolean' ? reportFlags[item.id].legacy : item.legacy === true
  );

  const toggleReportBucket = (bucketId) => {
    setReportBucketsOpen((prev) => {
      const next = { ...prev, [bucketId]: !prev[bucketId] };
      try {
        window.localStorage?.setItem?.(REPORT_BUCKETS_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota */
      }
      return next;
    });
  };

  const [expandedSections, setExpandedSections] = React.useState(() => {
    const defaultState = {
      focus: false,
      user: false,
      reports: false,
      appearance: false,
    };
    try {
      const raw = window.localStorage?.getItem?.(SIDEBAR_SECTIONS_STORAGE_KEY);
      if (!raw) return defaultState;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return defaultState;
      return {
        focus: parsed.focus === true,
        user: parsed.user === true,
        reports: parsed.reports === true,
        appearance: parsed.appearance === true,
      };
    } catch {
      return defaultState;
    }
  });

  React.useEffect(() => {
    try {
      window.localStorage?.setItem?.(SIDEBAR_SECTIONS_STORAGE_KEY, JSON.stringify(expandedSections));
    } catch {
      // Best-effort local persistence only.
    }
  }, [expandedSections]);

  const toggleSection = (section) => {
    setExpandedSections((prev) => {
      const isCurrentlyOpen = prev[section];

      if (isCurrentlyOpen) {
        return {
          ...prev,
          [section]: false,
        };
      }

      return {
        focus: false,
        user: false,
        reports: false,
        appearance: false,
        [section]: true,
      };
    });
  };

  if (isCollapsed) {
    return null;
  }

  return (
    <div className="dashboard-sidebar">
      <div className="dashboard-explorer__content">
        <div className={`dashboard-section dashboard-section--focus ${expandedSections.focus ? 'dashboard-section--expanded' : 'dashboard-section--collapsed'}`}>
          <button type="button" className="dashboard-section__header" onClick={() => toggleSection('focus')}>
            <span className="dashboard-section__title">Focus Management</span>
            <span className={`dashboard-section__icon ${expandedSections.focus ? 'dashboard-section__icon--expanded' : ''}`}>
              ▶
            </span>
          </button>
          <div className={`dashboard-section__content ${expandedSections.focus ? 'dashboard-section__content--expanded' : ''}`}>
            {focusLoading && (
              <div className="dashboard-loading">
                <div className="dashboard-loading__text">Loading focuses...</div>
              </div>
            )}

            {focusError && (
              <div className="dashboard-error">
                <div className="dashboard-error__title">Focus Error</div>
                <div className="dashboard-error__message">{focusError}</div>
              </div>
            )}

            {!focusLoading && (
              <FocusSelector onFocusChange={onFocusChange} currentFocusId={currentFocus} onSaveCurrentLayout={onSaveCurrentLayout} />
            )}
          </div>
        </div>

        <div className={`dashboard-section ${expandedSections.reports ? 'dashboard-section--expanded' : 'dashboard-section--collapsed'}`}>
          <button type="button" className="dashboard-section__header" onClick={() => toggleSection('reports')}>
            <span className="dashboard-section__title">Reports</span>
            <span className={`dashboard-section__icon ${expandedSections.reports ? 'dashboard-section__icon--expanded' : ''}`}>
              ▶
            </span>
          </button>
          <div className={`dashboard-section__content ${expandedSections.reports ? 'dashboard-section__content--expanded' : ''}`}>
            <div className="dashboard-report-toolbar">
              <button
                type="button"
                className={`dashboard-report-toolbar__filter ${mostUsedFirst ? 'dashboard-report-toolbar__filter--active' : ''}`}
                aria-pressed={mostUsedFirst}
                onClick={toggleMostUsed}
              >
                Most used
              </button>
            </div>
            {['starred', 'rest', 'retired'].map((bucketId) => {
              const bucketItems = reportCatalog.filter((item) => {
                const legacy = reportIsLegacy(item);
                if (bucketId === 'retired') return legacy;
                if (legacy) return false;
                return bucketId === 'starred' ? reportIsStarred(item.id) : !reportIsStarred(item.id);
              });
              const open = reportBucketsOpen[bucketId] === true;
              const grouped = {};
              bucketItems.forEach((item) => {
                if (!grouped[item.categoryId]) {
                  grouped[item.categoryId] = { id: item.categoryId, title: item.category, items: [] };
                }
                grouped[item.categoryId].items.push(item);
              });
              const groups = Object.values(grouped);
              groups.forEach((group) => {
                group.items.sort((a, b) => {
                  if (mostUsedFirst) {
                    const used = usageFor(b.panelId) - usageFor(a.panelId);
                    if (used !== 0) return used;
                  }
                  return a.label.localeCompare(b.label);
                });
              });
              groups.sort((a, b) => {
                if (mostUsedFirst) {
                  const usedA = [...new Set(a.items.map((item) => item.panelId))].reduce((sum, id) => sum + usageFor(id), 0);
                  const usedB = [...new Set(b.items.map((item) => item.panelId))].reduce((sum, id) => sum + usageFor(id), 0);
                  if (usedB !== usedA) return usedB - usedA;
                } else if (a.id === 'profile-tools') return -1;
                else if (b.id === 'profile-tools') return 1;
                return a.title.localeCompare(b.title);
              });
              const title = bucketId === 'starred'
                ? 'Starred (Primary)'
                : bucketId === 'retired'
                  ? 'Retired (Legacy)'
                  : 'The rest (Additional)';
              return (
                <div key={bucketId} className="dashboard-report-bucket">
                  <button
                    type="button"
                    className="dashboard-focus-section__title dashboard-focus-section__title--toggle"
                    aria-expanded={open}
                    onClick={() => toggleReportBucket(bucketId)}
                  >
                    <span>{open ? '▼' : '▶'} {title} ({bucketItems.length})</span>
                  </button>
                  {open && bucketItems.length === 0 && bucketId === 'starred' && (
                    <div className="dashboard-focus-section__empty">Star a report to pin it here.</div>
                  )}
                  {open && bucketItems.length === 0 && bucketId === 'retired' && (
                    <div className="dashboard-focus-section__empty">Mark a report with L to retire it.</div>
                  )}
                  {open && groups.map((group) => {
                    const groupKey = `${bucketId}:${group.id}`;
                    const groupOpen = reportGroupsOpen[groupKey] === true;
                    return (
                      <div key={groupKey} className="dashboard-section__group">
                        <button
                          type="button"
                          className="dashboard-section__subtitle dashboard-section__subtitle--toggle"
                          aria-expanded={groupOpen}
                          onClick={() => toggleReportGroup(groupKey)}
                        >
                          <span>{groupOpen ? '▼' : '▶'} {group.title}</span>
                          <span className="dashboard-section__count">
                            {sectionBadge(group.items.map((item) => item.panelId), group.items.length)}
                          </span>
                        </button>
                        {groupOpen && group.items.map((item) => {
                          const legacy = reportIsLegacy(item);
                          const starred = reportIsStarred(item.id);
                          const used = usageFor(item.panelId);
                          return (
                            <TaliaTooltip key={item.id} content={item.tip} placement="bottom-left" delayMs={180}>
                              <div
                                className={`dashboard-focus-item ${legacy ? 'dashboard-focus-item--legacy' : ''}`}
                                onClick={() => addReportPanel(item.panelId, item.title, item.params)}
                              >
                                <div className="dashboard-focus-item__header">
                                  <span className="dashboard-focus-item__name">{item.label}</span>
                                  <button
                                    type="button"
                                    className={`dashboard-focus-item__legacy-btn ${legacy ? 'dashboard-focus-item__legacy-btn--active' : ''}`}
                                    title={legacy ? 'Clear retired / legacy' : 'Mark as retired / legacy'}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setReportFlag(item.id, { legacy: !legacy });
                                    }}
                                  >
                                    L
                                  </button>
                                  <button
                                    type="button"
                                    className={`dashboard-focus-item__favorite-btn ${starred ? 'dashboard-focus-item__favorite-btn--active' : ''}`}
                                    title={starred ? 'Remove from starred' : 'Star this report'}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setReportFlag(item.id, { starred: !starred });
                                    }}
                                  >
                                    ★
                                  </button>
                                </div>
                                <div className="dashboard-focus-item__meta">
                                  <span className="dashboard-focus-item__type">{item.category}</span>
                                  {used > 0 && <span>{used} used</span>}
                                </div>
                              </div>
                            </TaliaTooltip>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className={`dashboard-section ${expandedSections.appearance ? 'dashboard-section--expanded' : 'dashboard-section--collapsed'}`}>
          <button type="button" className="dashboard-section__header" onClick={() => toggleSection('appearance')}>
            <span className="dashboard-section__title">Appearance</span>
            <span className={`dashboard-section__icon ${expandedSections.appearance ? 'dashboard-section__icon--expanded' : ''}`}>
              ▶
            </span>
          </button>
          <div className={`dashboard-section__content ${expandedSections.appearance ? 'dashboard-section__content--expanded' : ''}`}>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Font Family:</label>
              <select className="dashboard-form-input" value={fontFamily} onChange={(event) => setFontFamily(event.target.value)}>
                {Object.entries(fontFamilies).map(([key, font]) => (
                  <option key={key} value={key}>
                    {font.name}
                  </option>
                ))}
              </select>
              <div className="dashboard-form-hint">{selectedFont.description}</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Font Size: {fontSize}px</label>
              <input
                type="range"
                min="9"
                max="13"
                step="0.5"
                value={fontSize}
                onChange={(event) => setFontSize(Number(event.target.value))}
                className="dashboard-form-input dashboard-form-input--range"
              />
              <div className="dashboard-form-hint">Compact range tuned for dense layouts.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Text Intensity: {textIntensity}%</label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={textIntensity}
                onChange={(event) => setTextIntensity(Number(event.target.value))}
                className="dashboard-form-input dashboard-form-input--range"
              />
              <div className="dashboard-form-hint">Controls global text brightness across panels, components, and tables.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Group Row Intensity: {groupColorIntensity}%</label>
              <div className="dashboard-form-control-row">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={groupColorIntensity}
                  onChange={(event) => setGroupColorIntensity(Number(event.target.value))}
                  className="dashboard-form-input dashboard-form-input--range dashboard-form-input--range-inline"
                />
                <TaliaTooltip content="Select group row color" placement="bottom-left" delayMs={180}>
                  <input
                    type="color"
                    className="dashboard-form-color-input"
                    value={groupColorHex}
                    onChange={(event) => setGroupColorHex(event.target.value)}
                    aria-label="Group row color"
                  />
                </TaliaTooltip>
              </div>
              <div className="dashboard-form-hint">Controls how visible grouped table row shading appears.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Row Hover Intensity: {rowColorIntensity}%</label>
              <div className="dashboard-form-control-row">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={rowColorIntensity}
                  onChange={(event) => setRowColorIntensity(Number(event.target.value))}
                  className="dashboard-form-input dashboard-form-input--range dashboard-form-input--range-inline"
                />
                <TaliaTooltip content="Select row hover color" placement="bottom-left" delayMs={180}>
                  <input
                    type="color"
                    className="dashboard-form-color-input"
                    value={rowHoverColorHex}
                    onChange={(event) => setRowHoverColorHex(event.target.value)}
                    aria-label="Row hover color"
                  />
                </TaliaTooltip>
              </div>
              <div className="dashboard-form-hint">Controls data-row hover highlight intensity.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Odd Row Intensity: {oddRowIntensity}%</label>
              <div className="dashboard-form-control-row">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={oddRowIntensity}
                  onChange={(event) => setOddRowIntensity(Number(event.target.value))}
                  className="dashboard-form-input dashboard-form-input--range dashboard-form-input--range-inline"
                />
                <TaliaTooltip content="Select odd row color" placement="bottom-left" delayMs={180}>
                  <input
                    type="color"
                    className="dashboard-form-color-input"
                    value={oddRowColorHex}
                    onChange={(event) => setOddRowColorHex(event.target.value)}
                    aria-label="Odd row color"
                  />
                </TaliaTooltip>
              </div>
              <div className="dashboard-form-hint">Controls odd-row striping intensity in data tables.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Even Row Intensity: {evenRowIntensity}%</label>
              <div className="dashboard-form-control-row">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={evenRowIntensity}
                  onChange={(event) => setEvenRowIntensity(Number(event.target.value))}
                  className="dashboard-form-input dashboard-form-input--range dashboard-form-input--range-inline"
                />
                <TaliaTooltip content="Select even row color" placement="bottom-left" delayMs={180}>
                  <input
                    type="color"
                    className="dashboard-form-color-input"
                    value={evenRowColorHex}
                    onChange={(event) => setEvenRowColorHex(event.target.value)}
                    aria-label="Even row color"
                  />
                </TaliaTooltip>
              </div>
              <div className="dashboard-form-hint">Controls even-row striping intensity in data tables.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Table Header Contrast: {tableHeaderIntensity}%</label>
              <div className="dashboard-form-control-row">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={tableHeaderIntensity}
                  onChange={(event) => setTableHeaderIntensity(Number(event.target.value))}
                  className="dashboard-form-input dashboard-form-input--range dashboard-form-input--range-inline"
                />
                <TaliaTooltip content="Select table header color" placement="bottom-left" delayMs={180}>
                  <input
                    type="color"
                    className="dashboard-form-color-input"
                    value={tableHeaderColorHex}
                    onChange={(event) => setTableHeaderColorHex(event.target.value)}
                    aria-label="Table header color"
                  />
                </TaliaTooltip>
              </div>
              <div className="dashboard-form-hint">Controls Tabulator header background for all tables globally.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">
                Tab font: {Math.max(8, Math.round(fontSize * (Math.max(70, Math.min(140, tabFontScalePercent)) / 100)))}px
                {' '}({tabFontScalePercent}% of {fontSize}px)
              </label>
              <input
                type="range"
                min="70"
                max="140"
                step="5"
                value={tabFontScalePercent}
                onChange={(event) => setTabFontScalePercent(Number(event.target.value))}
                className="dashboard-form-input dashboard-form-input--range"
              />
              <div className="dashboard-form-hint">Dock tab title size, scaled from Appearance font size.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Tab contrast: {tabContrastIntensity}%</label>
              <div className="dashboard-form-control-row">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={tabContrastIntensity}
                  onChange={(event) => setTabContrastIntensity(Number(event.target.value))}
                  className="dashboard-form-input dashboard-form-input--range dashboard-form-input--range-inline"
                />
                <TaliaTooltip content="Select active tab color" placement="bottom-left" delayMs={180}>
                  <input
                    type="color"
                    className="dashboard-form-color-input"
                    value={tabColorHex}
                    onChange={(event) => setTabColorHex(event.target.value)}
                    aria-label="Active tab color"
                  />
                </TaliaTooltip>
              </div>
              <div className="dashboard-form-hint">Active dock tab fill strength and color.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Inactive tab dim: {tabInactiveIntensity}%</label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={tabInactiveIntensity}
                onChange={(event) => setTabInactiveIntensity(Number(event.target.value))}
                className="dashboard-form-input dashboard-form-input--range"
              />
              <div className="dashboard-form-hint">How strongly unselected tabs show a dim version of the tab color.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Card Intensity: {cardColorIntensity}%</label>
              <div className="dashboard-form-control-row">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={cardColorIntensity}
                  onChange={(event) => setCardColorIntensity(Number(event.target.value))}
                  className="dashboard-form-input dashboard-form-input--range dashboard-form-input--range-inline"
                />
                <TaliaTooltip content="Select card color" placement="bottom-left" delayMs={180}>
                  <input
                    type="color"
                    className="dashboard-form-color-input"
                    value={cardColorHex}
                    onChange={(event) => setCardColorHex(event.target.value)}
                    aria-label="Card color"
                  />
                </TaliaTooltip>
              </div>
              <div className="dashboard-form-hint">Controls card and elevated panel background intensity.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Component &amp; Card Padding: {componentPadding}%</label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={componentPadding}
                onChange={(event) => setComponentPadding(Number(event.target.value))}
                className="dashboard-form-input dashboard-form-input--range"
              />
              <div className="dashboard-form-hint">Scales spacing for shared component elements and cards across reports.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label" htmlFor="talia-sidebar-style-select">
                Style / theme
              </label>
              <select
                id="talia-sidebar-style-select"
                className="dashboard-form-input"
                value={appearanceStyleSelectValue}
                onChange={applyAppearanceStyleSelectKey}
              >
                {appearanceStyleSelectOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="dashboard-form-hint">
                Same options as the header visibility (eye) Style menu: saved appearance profiles first, then all palette themes from the registry.
              </div>
              <label className="dashboard-form-label" htmlFor="talia-custom-bg-color" style={{ marginTop: 'var(--theme-component-gap-md)' }}>
                Background color
              </label>
              <div
                className="dashboard-form-control-row"
                style={{
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 'var(--theme-component-gap-sm)',
                  marginTop: 'var(--theme-component-gap-xs)',
                }}
              >
                <TaliaTooltip content="Custom background (overrides preset gradient)" placement="bottom-left" delayMs={180}>
                  <input
                    id="talia-custom-bg-color"
                    type="color"
                    className="dashboard-form-color-input dashboard-form-color-input--large"
                    value={backgroundColorPickerValue}
                    onChange={(event) => setCustomBackgroundHex(event.target.value)}
                    aria-label="Pick custom background color"
                  />
                </TaliaTooltip>
                <button
                  type="button"
                  className="dashboard-form-button"
                  disabled={!customBackgroundHex}
                  onClick={() => setCustomBackgroundHex('')}
                >
                  Use preset gradient
                </button>
              </div>
              <div className="dashboard-form-hint">
                Chooses a solid base and a subtle gradient. Text and accents follow light or dark contrast automatically. Clear to return to the selected preset theme above.
              </div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Logo for this appearance</label>
              <label className="dashboard-form-checkbox">
                <input
                  type="checkbox"
                  checked={headerLogoVisible}
                  onChange={(event) => setHeaderLogoVisible(event.target.checked)}
                />
                <span>Show header logo (centered in top bar)</span>
              </label>
              <p className="dashboard-form-hint" style={{ marginTop: 'var(--theme-component-gap-xs)' }}>
                Uploads and URLs below are stored with these appearance settings and included when you save an appearance profile. With show on and no custom image, the default Talia logo is used.
              </p>
              <label className="dashboard-form-label" htmlFor="talia-appearance-logo-upload" style={{ marginTop: 'var(--theme-component-gap-sm)' }}>
                Upload logo image
              </label>
              <input
                id="talia-appearance-logo-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif,image/*"
                className="dashboard-form-input dashboard-form-input--file-native"
                onChange={handleHeaderLogoFile}
              />
              {lastUploadedLogoName ? (
                <p className="dashboard-form-hint" style={{ marginTop: 'var(--theme-component-gap-xs)' }}>
                  Last file read: {lastUploadedLogoName} (embedded in this appearance)
                </p>
              ) : null}
              <div className="dashboard-form-control-row" style={{ flexWrap: 'wrap', gap: 'var(--theme-component-gap-sm)', marginTop: 'var(--theme-component-gap-sm)' }}>
                <button
                  type="button"
                  className="dashboard-form-button"
                  disabled={!String(headerLogoUrl || '').trim()}
                  onClick={() => {
                    setHeaderLogoUrl('');
                    setLastUploadedLogoName('');
                  }}
                >
                  Clear custom logo
                </button>
              </div>
              {!headerLogoVisible ? (
                <p className="dashboard-form-hint" style={{ marginTop: 'var(--theme-component-gap-sm)' }}>
                  Logo hidden — enable &quot;Show header logo&quot; above to display the default or custom image.
                </p>
              ) : null}
              {headerLogoVisible && (useDefaultTaliaBrandPreview || customHeaderLogoPreviewSrc) ? (
                <div
                  className="dashboard-header-logo-preview"
                  style={{
                    marginTop: 'var(--theme-component-gap-sm)',
                    padding: 'var(--theme-component-padding-sm)',
                    borderRadius: 'var(--theme-radius-sm)',
                    border: '1px solid var(--theme-border)',
                    background: 'var(--theme-glass)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'var(--theme-component-gap-xs)',
                  }}
                >
                  <span className="dashboard-form-hint" style={{ margin: 0 }}>
                    {customHeaderLogoPreviewSrc
                      ? 'Preview (custom)'
                      : 'Preview (default Talia logo — theme color)'}
                  </span>
                  {useDefaultTaliaBrandPreview ? (
                    <TaliaBrandMark
                      className="status-bar__brand-mark status-bar__brand-mark--talia"
                      style={{ height: 40, maxHeight: 48, maxWidth: 200 }}
                    />
                  ) : (
                    <img
                      src={customHeaderLogoPreviewSrc}
                      alt=""
                      style={{
                        maxHeight: 48,
                        maxWidth: 200,
                        width: 'auto',
                        height: 'auto',
                        objectFit: 'contain',
                      }}
                    />
                  )}
                </div>
              ) : null}
              <label className="dashboard-form-label" htmlFor="talia-header-logo-url" style={{ marginTop: 'var(--theme-component-gap-md)' }}>Or logo URL</label>
              <input
                id="talia-header-logo-url"
                type="text"
                className="dashboard-form-input"
                value={headerLogoUrl}
                onChange={(event) => {
                  const v = event.target.value;
                  setHeaderLogoUrl(v);
                  if (!String(v).startsWith('data:')) setLastUploadedLogoName('');
                }}
                placeholder="https://… or path under /public"
                autoComplete="off"
              />
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Panel Titles</label>
              <label className="dashboard-form-checkbox">
                <input
                  type="checkbox"
                  checked={panelTitlesVisible}
                  onChange={(event) => setPanelTitlesVisible(event.target.checked)}
                />
                <span>Show panel titles across all reports</span>
              </label>
              <div className="dashboard-form-hint">Uses the shared panel header selector for all components that follow Talia report standards.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Panel Options</label>
              <div className="dashboard-form-hint">
                Views (flat/nested/details) and Operations are configured per active dock tab via
                the tab <strong>Options</strong> menu. Operations chrome is Admin-only; end users
                inherit role capabilities without seeing that menu section.
              </div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Disappear Time: {menuDisappearMs} ms</label>
              <input
                type="range"
                min="1000"
                max="30000"
                step="500"
                value={menuDisappearMs}
                onChange={(event) => setMenuDisappearMs(Number(event.target.value))}
                className="dashboard-form-input dashboard-form-input--range"
              />
              <div className="dashboard-form-hint">Global auto-dismiss delay for header menus and dropdowns across the app.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Hover Preview Opacity: {hoverPreviewOpacity}%</label>
              <input
                type="range"
                min="20"
                max="100"
                step="5"
                value={hoverPreviewOpacity}
                onChange={(event) => setHoverPreviewOpacity(Number(event.target.value))}
                className="dashboard-form-input dashboard-form-input--range"
              />
              <div className="dashboard-form-hint">Transparency for dense row hover cards (MSE distribution, reservation detail, etc.).</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Hover Preview Delay: {hoverPreviewDelayMs} ms</label>
              <input
                type="range"
                min="0"
                max="500"
                step="10"
                value={hoverPreviewDelayMs}
                onChange={(event) => setHoverPreviewDelayMs(Number(event.target.value))}
                className="dashboard-form-input dashboard-form-input--range"
              />
              <div className="dashboard-form-hint">Time before dense hover cards appear after pointing at a row.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Sidebar Behavior</label>
              <select
                className="dashboard-form-input"
                value={sidebarDisplayMode}
                onChange={(event) => setSidebarDisplayMode(event.target.value === 'overlay' ? 'overlay' : 'panel')}
              >
                <option value="panel">Panel (push layout)</option>
                <option value="overlay">Overlay (float over panels)</option>
              </select>
              <label className="dashboard-form-checkbox">
                <input
                  type="checkbox"
                  checked={sidebarAutoCloseEnabled}
                  onChange={(event) => setSidebarAutoCloseEnabled(event.target.checked)}
                />
                <span>Auto close sidebar after delay</span>
              </label>
              <div className="dashboard-form-hint">Choose whether sidebar opens as a layout panel or as an overlay. Auto close is optional in both modes.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Sidebar Auto Close: {sidebarAutoCloseMs} ms</label>
              <input
                type="range"
                min="1000"
                max="60000"
                step="500"
                value={sidebarAutoCloseMs}
                onChange={(event) => setSidebarAutoCloseMs(Number(event.target.value))}
                className="dashboard-form-input dashboard-form-input--range"
                disabled={!sidebarAutoCloseEnabled}
              />
              <div className="dashboard-form-hint">Used only when sidebar auto close is enabled.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Callouts</label>
              <label className="dashboard-form-checkbox">
                <input
                  type="checkbox"
                  checked={calloutsVisible}
                  onChange={(event) => setCalloutsVisible(event.target.checked)}
                />
                <span>Show informational callouts and tips across reports</span>
              </label>
              <div className="dashboard-form-hint">Matches the callouts toggle in the top header visibility menu.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Chart Legends</label>
              <label className="dashboard-form-checkbox">
                <input
                  type="checkbox"
                  checked={chartLegendsVisible}
                  onChange={(event) => setChartLegendsVisible(event.target.checked)}
                />
                <span>Show compact overlay legends on charts</span>
              </label>
              <div className="dashboard-form-hint">Matches the Legends toggle in the top header visibility menu.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Game Sound</label>
              <label className="dashboard-form-checkbox">
                <input
                  type="checkbox"
                  checked={gameSoundEnabled}
                  onChange={(event) => setGameSoundEnabled(event.target.checked)}
                />
                <span>Enable sound effects across all game panels</span>
              </label>
              <div className="dashboard-form-hint">Global setting for arcade sound effects (Pong, Breakout, Space Invaders, Pac-Man, Asteroids, Moon Lander).</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Default display currency</label>
              <select
                className="dashboard-form-input"
                value={defaultDisplayCurrency}
                onChange={(event) => setDefaultDisplayCurrency(event.target.value)}
              >
                <option value="ALL">All currencies</option>
                <option value="USD">USD — US dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British pound</option>
                <option value="AUD">AUD — Australian dollar</option>
                <option value="NZD">NZD — New Zealand dollar</option>
                <option value="CAD">CAD — Canadian dollar</option>
                <option value="JPY">JPY — Japanese yen</option>
                <option value="CHF">CHF — Swiss franc</option>
              </select>
              <div className="dashboard-form-hint">
                Used when a price has no currency code, and to choose which published-rate rows to prefer when several currencies exist (e.g. sailing overview minimum fare).
              </div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Panel Details</label>
              <label className="dashboard-form-checkbox">
                <input
                  type="checkbox"
                  checked={globalDetailsVisible}
                  onChange={(event) => handleGlobalDetailsToggle(event.target.checked)}
                />
                <span>Show panel details across all reports</span>
              </label>
              <div className="dashboard-form-hint">Uses the same global details toggle available in the top header visibility controls.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Table Fit Mode</label>
              <select
                className="dashboard-form-input"
                value={globalTableLayoutMode}
                onChange={(event) => handleTableLayoutModeChange(event.target.value)}
              >
                <option value="best">Best Fit (recommended)</option>
                <option value="width">Expand to Fit Width</option>
                <option value="data">Fit to Data</option>
              </select>
              <div className="dashboard-form-hint">Default for new reports. Each report can set its own fit in Views.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Global Filters</label>
              <label className="dashboard-form-checkbox">
                <input
                  type="checkbox"
                  checked={globalFiltersVisible}
                  onChange={(event) => handleGlobalFiltersToggle(event.target.checked)}
                />
                <span>Show report filter bars globally</span>
              </label>
              <div className="dashboard-form-hint">Matches the global filter toggle used in the top header.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Column Filters</label>
              <label className="dashboard-form-checkbox">
                <input
                  type="checkbox"
                  checked={globalTabulatorFiltersVisible}
                  onChange={(event) => handleGlobalTabulatorFiltersToggle(event.target.checked)}
                />
                <span>Show native Tabulator column header filters globally</span>
              </label>
              <div className="dashboard-form-hint">Matches the Column filters toggle in the top header visibility menu.</div>
            </div>
            {isAdmin(userRole) && (
              <div className="dashboard-form-group">
                <label className="dashboard-form-label">Appearance Profile (Admin)</label>
                <select
                  className="dashboard-form-input"
                  value={activeAppearanceProfileId || ''}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    if (!nextId) return;
                    applyAppearanceProfile(nextId);
                  }}
                >
                  <option value="">Select profile...</option>
                  {appearanceProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
                <div className="dashboard-form-control-row" style={{ marginTop: 'var(--theme-component-gap-xs)' }}>
                  <input
                    type="text"
                    className="dashboard-form-input"
                    placeholder="Profile name"
                    value={appearanceProfileName}
                    onChange={(event) => setAppearanceProfileName(event.target.value)}
                  />
                </div>
                <div className="dashboard-btn-group">
                  <button
                    type="button"
                    className="dashboard-btn dashboard-btn--small"
                    disabled={!appearanceDbLoaded}
                    onClick={() => {
                      const trimmed = appearanceProfileName.trim();
                      const fallback = `New appearance ${new Date().toISOString().slice(0, 19)}`;
                      const name = trimmed || fallback;
                      const savedId = saveAppearanceProfile(name);
                      if (savedId) {
                        setAppearanceProfileName(trimmed || name);
                      }
                    }}
                  >
                    Save As New
                  </button>
                  <button
                    type="button"
                    className="dashboard-btn dashboard-btn--small"
                    disabled={!appearanceDbLoaded || !activeAppearanceProfileId}
                    onClick={() => {
                      if (!activeAppearanceProfileId) return;
                      const selected = appearanceProfiles.find((entry) => entry.id === activeAppearanceProfileId);
                      const trimmed = appearanceProfileName.trim();
                      const fallback =
                        (selected?.name && String(selected.name).trim())
                        || `Profile ${activeAppearanceProfileId.slice(-6)}`;
                      saveAppearanceProfile(trimmed || fallback, { profileId: activeAppearanceProfileId });
                      setAppearanceProfileName(trimmed || fallback);
                    }}
                  >
                    Update Selected
                  </button>
                </div>
                <div className="dashboard-form-hint">Admins can save/update named appearance profiles. Selecting a profile applies it globally.</div>
              </div>
            )}
          </div>
        </div>

      </div>

      <UserProfile isCollapsed={isCollapsed} />

      <div className="dashboard-user-info">Dockview v4.6.2</div>
    </div>
  );
}

export default DashboardSidebar;
