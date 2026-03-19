import React from "react";
import reportRegistry from "../focus-panels/registry";
import UserProfile from "../UserProfile";
import { isAdmin } from "../../utils/roleUtils";
import { FocusSelector } from "../focus-management";
import { useTheme } from "../../contexts/ThemeContext";

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
    cardColorHex,
    setCardColorHex,
    appearanceProfiles,
    activeAppearanceProfileId,
    applyAppearanceProfile,
    saveAppearanceProfile,
    bgColor,
    setBgColor
  } = useTheme();
  const [appearanceProfileName, setAppearanceProfileName] = React.useState('');

  React.useEffect(() => {
    const activeProfile = appearanceProfiles.find((entry) => entry.id === activeAppearanceProfileId);
    setAppearanceProfileName(activeProfile?.name || '');
  }, [appearanceProfiles, activeAppearanceProfileId]);

  const reportGroups = React.useMemo(() => {
    const items = Object.values(reportRegistry)
      .filter((report) => report.showInReports && report.panelId)
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
  }, []);

  const [expandedSections, setExpandedSections] = React.useState({
    focus: true, // Only Focus Management open by default
    user: false,
    reports: false,
    appearance: false,
    admin: false,
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
        admin: false,
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
          <div className="dashboard-section__header" onClick={() => toggleSection('focus')}>
            <span className="dashboard-section__title">Focus Management</span>
            <span className={`dashboard-section__icon ${expandedSections.focus ? 'dashboard-section__icon--expanded' : ''}`}>
              ▶
            </span>
          </div>
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
          <div className="dashboard-section__header" onClick={() => toggleSection('reports')}>
            <span className="dashboard-section__title">Reports</span>
            <span className={`dashboard-section__icon ${expandedSections.reports ? 'dashboard-section__icon--expanded' : ''}`}>
              ▶
            </span>
          </div>
          <div className={`dashboard-section__content ${expandedSections.reports ? 'dashboard-section__content--expanded' : ''}`}>
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
          <div className="dashboard-section__header" onClick={() => toggleSection('appearance')}>
            <span className="dashboard-section__title">Appearance</span>
            <span className={`dashboard-section__icon ${expandedSections.appearance ? 'dashboard-section__icon--expanded' : ''}`}>
              ▶
            </span>
          </div>
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

        {isAdmin(userRole) && (
          <div className="dashboard-section">
            <div className="dashboard-section__header" onClick={() => toggleSection('admin')}>
              <span className="dashboard-section__title">Admin Dashboard</span>
              <span className={`dashboard-section__icon ${expandedSections.admin ? 'dashboard-section__icon--expanded' : ''}`}>
                ▶
              </span>
            </div>
            <div className={`dashboard-section__content ${expandedSections.admin ? 'dashboard-section__content--expanded' : ''}`}>
              <button className="dashboard-btn" onClick={() => onAddPanel('admin-dashboard', '⚙️ Admin Dashboard')}>
                ⚙️ Open Admin Dashboard
              </button>
              <button className="dashboard-btn" onClick={() => onAddPanel('user-mapping-table', '🔗 User Mappings')}>
                🔗 User Mappings
              </button>
              <button className="dashboard-btn" onClick={() => onAddPanel('talia-user-table', '👥 Talia Users')}>
                👥 Talia Users
              </button>
              <div className="dashboard-form-hint dashboard-form-hint--admin">
                💡 Admin tools for managing users and system configuration
              </div>
            </div>
          </div>
        )}
      </div>

      <UserProfile isCollapsed={isCollapsed} onToggle={onToggle} />

      <div className="dashboard-user-info">Dockview v4.6.2</div>
    </div>
  );
}

export default DashboardSidebar;
