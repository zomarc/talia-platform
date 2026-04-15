import React from "react";
import reportRegistry, { canRoleAccessComponent } from "../focus-panels/registry";
import UserProfile from "../UserProfile";
import { isAdmin } from "../../utils/roleUtils";
import { FocusSelector } from "../focus-management";
import { useTheme } from "../../contexts/ThemeContext";
import { DEFAULT_HEADER_LOGO_SRC, resolveAppPublicUrl } from "../../lib/headerLogoAsset";
import {
  DASHBOARD_DETAILS_VISIBILITY_EVENT,
  DASHBOARD_FILTER_VISIBILITY_EVENT,
  DASHBOARD_TABLE_LAYOUT_EVENT,
} from "../dockview/eventConstants";
import {
  getGlobalReportDetailsVisible,
  setGlobalReportDetailsVisible,
  clearPanelReportDetailsOverrides,
} from "../../services/panelDetailsState";

const FILTERS_VISIBILITY_STORAGE_KEY = 'taliaHeaderFiltersVisible';
const TABLE_LAYOUT_STORAGE_KEY = 'taliaTableLayoutMode';
const SIDEBAR_SECTIONS_STORAGE_KEY = 'taliaSidebarExpandedSections';

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
    panelTitlesVisible,
    setPanelTitlesVisible,
    actionsVisible,
    setActionsVisible,
    controlsVisible,
    setControlsVisible,
    menuDisappearMs,
    setMenuDisappearMs,
    sidebarAutoCloseEnabled,
    setSidebarAutoCloseEnabled,
    sidebarAutoCloseMs,
    setSidebarAutoCloseMs,
    sidebarDisplayMode,
    setSidebarDisplayMode,
    calloutsVisible,
    setCalloutsVisible,
    gameSoundEnabled,
    setGameSoundEnabled,
    defaultDisplayCurrency,
    setDefaultDisplayCurrency,
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

  const effectiveHeaderLogoPreviewSrc = () => {
    if (!headerLogoVisible) return '';
    const t = String(headerLogoUrl || '').trim();
    if (t) return resolveCustomLogoPreviewSrc(headerLogoUrl);
    return DEFAULT_HEADER_LOGO_SRC;
  };

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
  const [globalDetailsVisible, setGlobalDetailsVisible] = React.useState(() => getGlobalReportDetailsVisible());
  const [globalTableLayoutMode, setGlobalTableLayoutMode] = React.useState(() => {
    try {
      const saved = window.localStorage?.getItem?.(TABLE_LAYOUT_STORAGE_KEY);
      if (saved === 'data' || saved === 'width') return saved;
    } catch {
      // ignore
    }
    return window.__taliaTableLayoutMode === 'data' ? 'data' : 'width';
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
    const handleTableLayoutEvent = (event) => {
      const mode = event?.detail?.mode;
      if (mode === 'data' || mode === 'width') {
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
    window.addEventListener(DASHBOARD_TABLE_LAYOUT_EVENT, handleTableLayoutEvent);
    window.addEventListener(DASHBOARD_DETAILS_VISIBILITY_EVENT, handleDetailsVisibilityEvent);
    return () => {
      window.removeEventListener(DASHBOARD_FILTER_VISIBILITY_EVENT, handleFilterVisibilityEvent);
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

  const handleGlobalDetailsToggle = (checked) => {
    setGlobalDetailsVisible(checked);
    setGlobalReportDetailsVisible(checked);
    clearPanelReportDetailsOverrides();
    window.dispatchEvent(new CustomEvent(DASHBOARD_DETAILS_VISIBILITY_EVENT, {
      detail: {
        scope: 'all',
        visible: checked,
        action: 'set',
      },
    }));
  };

  const handleTableLayoutModeChange = (nextMode) => {
    if (nextMode !== 'data' && nextMode !== 'width') return;
    setGlobalTableLayoutMode(nextMode);
    window.__taliaTableLayoutMode = nextMode;
    try {
      window.localStorage?.setItem?.(TABLE_LAYOUT_STORAGE_KEY, nextMode);
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent(DASHBOARD_TABLE_LAYOUT_EVENT, {
      detail: { mode: nextMode },
    }));
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

            {!focusLoading && !focusError && (
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
            <div className="dashboard-section__group">
              <div className="dashboard-section__subtitle">Profile Tools (3 goals)</div>
              <button
                className="dashboard-btn"
                onClick={() => onAddPanel('booking-profile', 'Real booking profile (+ YoY)', { reportId: 'booking-profile', includeComparison: false })}
                title="Goal ① REAL: trends from bookings; select a sail in the table. Toggle YoY via the next button or panel params."
              >
                ① Real profile
              </button>
              <button
                className="dashboard-btn"
                onClick={() => onAddPanel('booking-profile', 'Real booking profile + YoY', { reportId: 'booking-profile', includeComparison: true })}
                title="Goal ① REAL with year-over-year comparison (prior sail auto-derived unless you set previousYearSailCode in params)"
              >
                ① Real + YoY
              </button>
              <button
                className="dashboard-btn"
                onClick={() => onAddPanel('booking-target-data-simple', 'TARGET only (imported)', { reportId: 'booking-target-data-simple' })}
                title="Goal ② TARGET: curve from Data Management import (booking_targets_supplied)"
              >
                ② Imported targets
              </button>
              <button
                className="dashboard-btn"
                onClick={() => onAddPanel('booking-combined-data-simple', 'Overlay: REAL + TARGET + MODEL', { reportId: 'booking-combined-data-simple' })}
                title="Overlay REAL, imported TARGET, BUDGET, and inventory MODEL on one chart"
              >
                Overlay (all streams)
              </button>
              <button
                className="dashboard-btn"
                onClick={() => onAddPanel('booking-target-profile-editor-simple', 'MODEL profile editor (graph)', { reportId: 'booking-target-profile-editor-simple' })}
                title="Goal ③ MODEL: drag points / edit table, save consolidated curve on inventory item"
              >
                ③ Model editor (graph)
              </button>
            </div>
            {Object.entries(reportGroups).sort(([a], [b]) => a.localeCompare(b)).map(([category, reports]) => (
              <div key={category} className="dashboard-section__group">
                <div className="dashboard-section__subtitle">{category}</div>
                {reports.map((report) => {
                  const reportLabel = report.legacy ? `${report.title} (Legacy)` : report.title;
                  const reportDescription = report.legacy ? `${report.description || ''} Legacy component.` : report.description;
                  return (
                    <button
                      key={report.panelId}
                      className="dashboard-btn"
                      onClick={() => onAddPanel(report.panelId, reportLabel, { reportId: report.panelId })}
                      title={reportDescription}
                    >
                      {reportLabel}
                    </button>
                  );
                })}
              </div>
            ))}
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
                <input
                  type="color"
                  className="dashboard-form-color-input"
                  value={groupColorHex}
                  onChange={(event) => setGroupColorHex(event.target.value)}
                  title="Select group row color"
                  aria-label="Group row color"
                />
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
                <input
                  type="color"
                  className="dashboard-form-color-input"
                  value={rowHoverColorHex}
                  onChange={(event) => setRowHoverColorHex(event.target.value)}
                  title="Select row hover color"
                  aria-label="Row hover color"
                />
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
                <input
                  type="color"
                  className="dashboard-form-color-input"
                  value={oddRowColorHex}
                  onChange={(event) => setOddRowColorHex(event.target.value)}
                  title="Select odd row color"
                  aria-label="Odd row color"
                />
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
                <input
                  type="color"
                  className="dashboard-form-color-input"
                  value={evenRowColorHex}
                  onChange={(event) => setEvenRowColorHex(event.target.value)}
                  title="Select even row color"
                  aria-label="Even row color"
                />
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
                <input
                  type="color"
                  className="dashboard-form-color-input"
                  value={tableHeaderColorHex}
                  onChange={(event) => setTableHeaderColorHex(event.target.value)}
                  title="Select table header color"
                  aria-label="Table header color"
                />
              </div>
              <div className="dashboard-form-hint">Controls Tabulator header background for all tables globally.</div>
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
                <input
                  type="color"
                  className="dashboard-form-color-input"
                  value={cardColorHex}
                  onChange={(event) => setCardColorHex(event.target.value)}
                  title="Select card color"
                  aria-label="Card color"
                />
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
                <input
                  id="talia-custom-bg-color"
                  type="color"
                  className="dashboard-form-color-input dashboard-form-color-input--large"
                  value={backgroundColorPickerValue}
                  onChange={(event) => setCustomBackgroundHex(event.target.value)}
                  aria-label="Pick custom background color"
                  title="Custom background (overrides preset gradient)"
                />
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
              {headerLogoVisible && effectiveHeaderLogoPreviewSrc() ? (
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
                    {String(headerLogoUrl || '').trim() ? 'Preview (custom)' : 'Preview (default Talia logo)'}
                  </span>
                  <img
                    src={effectiveHeaderLogoPreviewSrc()}
                    alt=""
                    style={{
                      maxHeight: 48,
                      maxWidth: 200,
                      width: 'auto',
                      height: 'auto',
                      objectFit: 'contain',
                    }}
                  />
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
              <label className="dashboard-form-label">Actions</label>
              <label className="dashboard-form-checkbox">
                <input
                  type="checkbox"
                  checked={actionsVisible}
                  onChange={(event) => setActionsVisible(event.target.checked)}
                />
                <span>Show panel action sections across reports</span>
              </label>
              <div className="dashboard-form-hint">Matches the Actions toggle in the top header visibility menu.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Controls</label>
              <label className="dashboard-form-checkbox">
                <input
                  type="checkbox"
                  checked={controlsVisible}
                  onChange={(event) => setControlsVisible(event.target.checked)}
                />
                <span>Show top-level controls drawer for Data Management</span>
              </label>
              <div className="dashboard-form-hint">Matches the Controls toggle in the top header visibility menu. Defaults to closed.</div>
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
                <option value="width">Expand to Fit Width</option>
                <option value="data">Fit to Data</option>
              </select>
              <div className="dashboard-form-hint">Uses the same fit control as the top header eye menu.</div>
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
