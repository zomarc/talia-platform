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
  globalFilters,
  onGlobalFiltersChange,
  currentFocus,
  onFocusChange,
  userRole,
  focusLoading,
  focusError,
  onSaveCurrentLayout,
}) {
  const { fontFamily, setFontFamily, selectedFont, fontFamilies, fontSize, setFontSize } = useTheme();

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
    criteria: false,
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
        criteria: false,
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
          <button className="dashboard-sidebar__nav-btn" title="Default Criteria">📊</button>
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
          <div className="dashboard-section__header" onClick={() => toggleSection('criteria')}>
            <span className="dashboard-section__title">Default Criteria</span>
            <span className={`dashboard-section__icon ${expandedSections.criteria ? 'dashboard-section__icon--expanded' : ''}`}>
              ▶
            </span>
          </div>
          <div className={`dashboard-section__content ${expandedSections.criteria ? 'dashboard-section__content--expanded' : ''}`}>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Ship Filter:</label>
              <select
                className="dashboard-form-input"
                value={globalFilters.ship || ''}
                onChange={(event) => onGlobalFiltersChange({ ...globalFilters, ship: event.target.value })}
              >
                <option value="">All Ships</option>
                <option value="Celestyal Discovery">Celestyal Discovery</option>
                <option value="Celestyal Journey">Celestyal Journey</option>
              </select>
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Date From:</label>
              <input
                type="date"
                className="dashboard-form-input"
                value={globalFilters.dateFrom || ''}
                onChange={(event) => onGlobalFiltersChange({ ...globalFilters, dateFrom: event.target.value })}
              />
            </div>
            <div className="dashboard-form-group">
              <label className="dashboard-form-label">Date To:</label>
              <input
                type="date"
                className="dashboard-form-input"
                value={globalFilters.dateTo || ''}
                onChange={(event) => onGlobalFiltersChange({ ...globalFilters, dateTo: event.target.value })}
              />
            </div>
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
