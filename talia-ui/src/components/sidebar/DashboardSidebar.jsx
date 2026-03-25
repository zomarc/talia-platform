import React from "react";
import reportRegistry, { canRoleAccessComponent } from "../focus-panels/registry";
import UserProfile from "../UserProfile";
import { isAdmin } from "../../utils/roleUtils";
import { FocusSelector } from "../focus-management";
import { useTheme } from "../../contexts/ThemeContext";
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

function DashboardSidebar({
  isCollapsed,
  onToggle,
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
    calloutsVisible,
    setCalloutsVisible,
    appearanceProfiles,
    activeAppearanceProfileId,
    applyAppearanceProfile,
    saveAppearanceProfile,
    bgColor,
    setBgColor
  } = useTheme();
  const [appearanceProfileName, setAppearanceProfileName] = React.useState('');
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

  const [expandedSections, setExpandedSections] = React.useState({
    focus: false,
    user: false,
    reports: true, // Reports open by default for quick profile tooling access
    appearance: false,
  });

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
    return (
      <div className="dashboard-sidebar dashboard-sidebar--collapsed">
        <div className="dashboard-sidebar__header">
          <button onClick={onToggle} className="dashboard-sidebar__close-btn">
            ☰
          </button>
        </div>
        <div className="dashboard-sidebar__nav">
          <button className="dashboard-sidebar__nav-btn" title="Reports">📋</button>
          <button className="dashboard-sidebar__nav-btn" title="Appearance">🎨</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-sidebar">
      <div className="dashboard-explorer__header">
        <span className="dashboard-explorer__title">Explorer</span>
        <button onClick={onToggle} className="dashboard-sidebar__close-btn">
          ◀
        </button>
      </div>

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

        <div className="dashboard-section">
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

        <div className="dashboard-section">
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
              <label className="dashboard-form-label">Background</label>
              <div style={{ display: 'flex', gap: 'var(--theme-component-gap-sm)', flexWrap: 'wrap', marginTop: 'var(--theme-component-gap-xs)' }}>
                {[
                  { key: 'midnight',  label: 'Midnight',  swatch: '#1a1d33' },
                  { key: 'charcoal',  label: 'Charcoal',  swatch: '#1e1e22' },
                  { key: 'navy',      label: 'Navy',      swatch: '#12182a' },
                  { key: 'graphite',  label: 'Graphite',  swatch: '#222428' },
                  { key: 'ocean',     label: 'Ocean',     swatch: '#121e26' },
                  { key: 'obsidian',  label: 'Obsidian',  swatch: '#101014' },
                ].map((c) => (
                  <button
                    key={c.key}
                    title={c.label}
                    onClick={() => setBgColor(c.key)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: bgColor === c.key ? '2px solid rgba(255,255,255,0.85)' : '2px solid rgba(255,255,255,0.15)',
                      background: c.swatch,
                      cursor: 'pointer',
                      boxShadow: bgColor === c.key ? '0 0 0 1px rgba(255,255,255,0.3)' : 'none',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                  />
                ))}
              </div>
              <div className="dashboard-form-hint">Global background color theme.</div>
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
                    disabled={!appearanceProfileName.trim()}
                    onClick={() => {
                      const savedId = saveAppearanceProfile(appearanceProfileName);
                      if (savedId) {
                        const saved = appearanceProfiles.find((entry) => entry.id === savedId);
                        setAppearanceProfileName(saved?.name || appearanceProfileName.trim());
                      }
                    }}
                  >
                    Save As New
                  </button>
                  <button
                    type="button"
                    className="dashboard-btn dashboard-btn--small"
                    disabled={!activeAppearanceProfileId || !appearanceProfileName.trim()}
                    onClick={() => {
                      if (!activeAppearanceProfileId) return;
                      saveAppearanceProfile(appearanceProfileName, { profileId: activeAppearanceProfileId });
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

      <UserProfile isCollapsed={isCollapsed} onToggle={onToggle} />

      <div className="dashboard-user-info">Dockview v4.6.2</div>
    </div>
  );
}

export default DashboardSidebar;
