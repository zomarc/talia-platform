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
  const { fontFamily, setFontFamily, selectedFont, fontFamilies, fontSize, setFontSize, groupColorIntensity, setGroupColorIntensity, rowColorIntensity, setRowColorIntensity, accentColor, setAccentColor, rowAccentColor, setRowAccentColor, bgColor, setBgColor } = useTheme();

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
              <label className="dashboard-form-label">Group Row Intensity: {groupColorIntensity}%</label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={groupColorIntensity}
                onChange={(event) => setGroupColorIntensity(Number(event.target.value))}
                className="dashboard-form-input dashboard-form-input--range"
              />
              <div className="dashboard-form-hint">Controls how visible grouped table row shading appears.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Row &amp; Card Intensity: {rowColorIntensity}%</label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={rowColorIntensity}
                onChange={(event) => setRowColorIntensity(Number(event.target.value))}
                className="dashboard-form-input dashboard-form-input--range"
              />
              <div className="dashboard-form-hint">Controls odd-row striping, hover highlights, and card backgrounds.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Group Color</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                {[
                  { key: 'blue',   label: 'Blue',   swatch: '#385c94' },
                  { key: 'teal',   label: 'Teal',   swatch: '#247878' },
                  { key: 'purple', label: 'Purple', swatch: '#583894' },
                  { key: 'slate',  label: 'Slate',  swatch: '#3e485c' },
                  { key: 'amber',  label: 'Amber',  swatch: '#947024' },
                  { key: 'rose',   label: 'Rose',   swatch: '#943848' },
                ].map((c) => (
                  <button
                    key={c.key}
                    title={c.label}
                    onClick={() => setAccentColor(c.key)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: accentColor === c.key ? '2px solid rgba(255,255,255,0.85)' : '2px solid rgba(255,255,255,0.15)',
                      background: c.swatch,
                      cursor: 'pointer',
                      boxShadow: accentColor === c.key ? '0 0 0 1px rgba(255,255,255,0.3)' : 'none',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                  />
                ))}
              </div>
              <div className="dashboard-form-hint">Base color for group row headers.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Row &amp; Card Color</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                {[
                  { key: 'blue',   label: 'Blue',   swatch: '#26324e' },
                  { key: 'teal',   label: 'Teal',   swatch: '#1e3737' },
                  { key: 'purple', label: 'Purple', swatch: '#302648' },
                  { key: 'slate',  label: 'Slate',  swatch: '#252a37' },
                  { key: 'amber',  label: 'Amber',  swatch: '#3a3020' },
                  { key: 'rose',   label: 'Rose',   swatch: '#3a232a' },
                ].map((c) => (
                  <button
                    key={c.key}
                    title={c.label}
                    onClick={() => setRowAccentColor(c.key)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: rowAccentColor === c.key ? '2px solid rgba(255,255,255,0.85)' : '2px solid rgba(255,255,255,0.15)',
                      background: c.swatch,
                      cursor: 'pointer',
                      boxShadow: rowAccentColor === c.key ? '0 0 0 1px rgba(255,255,255,0.3)' : 'none',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                  />
                ))}
              </div>
              <div className="dashboard-form-hint">Base color for row striping and card backgrounds.</div>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Background</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
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
