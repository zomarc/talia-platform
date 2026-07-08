export const REPORT_REFRESH_EVENT = 'talia:report.refresh';
/** @deprecated Legacy toggle; prefer DASHBOARD_DETAILS_VISIBILITY_EVENT */
export const REPORT_TOGGLE_DETAILS_EVENT = 'talia:report.toggleDetails';
/** Header ≣ — user-facing extra data / tables; scope `all` or per-panel via commitVisible */
export const DASHBOARD_DETAILS_VISIBILITY_EVENT = 'talia:dashboard.detailsVisibility';
/** Dock tab ⓘ — technical ReportEventMeta for this panel only (dev/admin); not header ≣ */
export const REPORT_PANEL_TECHNICAL_META_EVENT = 'talia:report.panelTechnicalMeta';
/** Header filter funnel — root class talia-filters-hidden + event for subscribers */
export const DASHBOARD_FILTER_VISIBILITY_EVENT = 'talia:dashboard.filterVisibility';
/** Tabulator column header filters — root class talia-tabulator-filters-hidden + event for subscribers */
export const DASHBOARD_TABULATOR_FILTER_VISIBILITY_EVENT = 'talia:dashboard.tabulatorFilterVisibility';
export const REPORT_GROUP_ACTION_EVENT = 'talia:report.groupAction';
export const REPORT_ACTIVE_PANEL_EVENT = 'talia:report.activePanelChanged';
export const REPORT_PANEL_PAUSE_EVENT = 'talia:report.panelPauseChanged';
export const REPORT_PANEL_LOADING_EVENT = 'talia:report.panelLoadingChanged';
/** Request one step of the tab layout cycle (↑/↔/↓) for a specific panel instance id */
export const REPORT_PANEL_LAYOUT_CYCLE_EVENT = 'talia:report.panelLayoutCycle';
export const DOCKVIEW_MAXIMIZE_STATE_EVENT = 'talia:dockview.maximizeStateChanged';
export const DASHBOARD_TOGGLE_SIDEBAR_EVENT = 'talia:dashboard.toggleSidebar';
export const DASHBOARD_SIDEBAR_STATE_EVENT = 'talia:dashboard.sidebarState';
export const DASHBOARD_CYCLE_FOCUS_EVENT = 'talia:dashboard.cycleFocus';
export const DASHBOARD_SELECT_FOCUS_EVENT = 'talia:dashboard.selectFocus';
export const DASHBOARD_FOCUS_STATE_EVENT = 'talia:dashboard.focusState';
export const DASHBOARD_OPEN_PANEL_EVENT = 'talia:dashboard.openPanel';
export const DASHBOARD_TABLE_LAYOUT_EVENT = 'talia:dashboard.tableLayout';
export const DATA_MANAGEMENT_STATE_EVENT = 'talia:dataManagement.state';
export const DATA_MANAGEMENT_SET_RANGE_EVENT = 'talia:dataManagement.setRange';
export const DATA_MANAGEMENT_SYNC_ALL_EVENT = 'talia:dataManagement.syncAll';
export const DATA_MANAGEMENT_BACKUP_EVENT = 'talia:dataManagement.backup';
export const DATA_MANAGEMENT_REFRESH_EVENT = 'talia:dataManagement.refresh';
export const DATA_MANAGEMENT_SELECT_TABLE_EVENT = 'talia:dataManagement.selectTable';
export const DATA_MANAGEMENT_TABLE_ACTION_EVENT = 'talia:dataManagement.tableAction';
