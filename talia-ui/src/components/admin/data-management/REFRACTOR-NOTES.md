## Data Management Functional Changes (to reapply after refactor)

These are the functional UI changes that were implemented recently and must be
preserved or re-applied after refactoring `DataManagementPage`.

### UI behavior changes
- Summary button per table row that opens a modal with key sync metadata:
  - Source query details, last requested range, current data range, row count,
    last error, and last sync time.
- Date formatting standardized to `dd-MMM-yy` (e.g., `01-Jan-26`) including
  date ranges and timestamps.
- Control panel consolidation:
  - Status summary bar, filters/search, integration actions, and date range
    controls in a single top panel.
- Date Ranges panel shown as a toggle/dropdown from the control panel.
- Bottom activity panels (Client Activity Log, Server Logs, Server Status)
  collectively toggleable from the control panel.
- Bottom panels support maximize/minimize for better log viewing.
- Integration tables scrollable with height adjusted based on bottom panels.

### Data correctness / display changes
- Actual data range (min/max) display per table, with status indicators for
  matches or extended ranges.
- Last sync time and sync status shown per table.
- Last error surfaced (from `operation_metadata`) and shown in the summary
  modal, in red when present.
- Summary modal includes data source provider name and real date column names
  used for queries (from mapping).

### Key files touched (for re-apply)
- `talia-ui/src/components/admin/data-management/DataManagementPage.jsx`
- `talia-ui/src/hooks/useDatabaseTables.js`
- `talia-server/src/api/schema.ts`
- `talia-server/src/api/resolvers.ts`

### Notes
- `DataManagementPage.jsx` should remain on the last known good version and
  reapply changes incrementally.
- This file is a checklist for reapplying UI behavior after refactor.
