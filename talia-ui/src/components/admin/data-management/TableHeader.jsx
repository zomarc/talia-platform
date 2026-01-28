import React from 'react';

const TableHeader = ({ theme, columnWidths, handleSort, SortIcon }) => (
  <thead>
    <tr
      className="dm-table-header-row"
      style={{
        background: theme.colors.glass,
        borderBottom: `1px solid ${theme.colors.glassBorder}`
      }}
    >
      <th
        onClick={() => handleSort('tableName')}
        className="dm-table-header-cell dm-table-header-cell-left dm-table-header-cell-sortable"
        style={{
          color: theme.colors.textSecondary,
          width: columnWidths.tableName
        }}
      >
        Table Name<SortIcon column="tableName" />
      </th>
      <th
        onClick={() => handleSort('source')}
        className="dm-table-header-cell dm-table-header-cell-left dm-table-header-cell-sortable"
        style={{
          color: theme.colors.textSecondary,
          width: columnWidths.source
        }}
      >
        Source<SortIcon column="source" />
      </th>
      <th
        onClick={() => handleSort('loadMethod')}
        className="dm-table-header-cell dm-table-header-cell-left dm-table-header-cell-sortable"
        style={{
          color: theme.colors.textSecondary,
          width: columnWidths.loadMethod
        }}
      >
        Load Method<SortIcon column="loadMethod" />
      </th>
      <th
        onClick={() => handleSort('rowCount')}
        className="dm-table-header-cell dm-table-header-cell-right dm-table-header-cell-sortable"
        style={{
          color: theme.colors.textSecondary,
          width: columnWidths.rowCount
        }}
      >
        Rows<SortIcon column="rowCount" />
      </th>
      <th
        onClick={() => handleSort('dateRange')}
        className="dm-table-header-cell dm-table-header-cell-left dm-table-header-cell-sortable"
        style={{
          color: theme.colors.textSecondary,
          width: columnWidths.dateRange
        }}
      >
        Data Range<SortIcon column="dateRange" />
      </th>
      <th
        onClick={() => handleSort('lastSync')}
        className="dm-table-header-cell dm-table-header-cell-left dm-table-header-cell-sortable"
        style={{
          color: theme.colors.textSecondary,
          width: columnWidths.lastSync
        }}
      >
        Last Sync<SortIcon column="lastSync" />
      </th>
      <th
        onClick={() => handleSort('latestSnapshot')}
        className="dm-table-header-cell dm-table-header-cell-left dm-table-header-cell-sortable"
        style={{
          color: theme.colors.textSecondary,
          width: columnWidths.latestSnapshot
        }}
      >
        Latest Snapshot<SortIcon column="latestSnapshot" />
      </th>
      <th
        onClick={() => handleSort('recordsProcessed')}
        className="dm-table-header-cell dm-table-header-cell-right dm-table-header-cell-sortable"
        style={{
          color: theme.colors.textSecondary,
          width: columnWidths.recordsProcessed
        }}
      >
        Records<SortIcon column="recordsProcessed" />
      </th>
      <th
        onClick={() => handleSort('changesDetected')}
        className="dm-table-header-cell dm-table-header-cell-right dm-table-header-cell-sortable"
        style={{
          color: theme.colors.textSecondary,
          width: columnWidths.changesDetected
        }}
      >
        Changes<SortIcon column="changesDetected" />
      </th>
      <th
        onClick={() => handleSort('syncDuration')}
        className="dm-table-header-cell dm-table-header-cell-left dm-table-header-cell-sortable"
        style={{
          color: theme.colors.textSecondary,
          width: columnWidths.syncDuration
        }}
      >
        Duration<SortIcon column="syncDuration" />
      </th>
      <th
        onClick={() => handleSort('status')}
        className="dm-table-header-cell dm-table-header-cell-left dm-table-header-cell-sortable"
        style={{
          color: theme.colors.textSecondary,
          width: columnWidths.status
        }}
      >
        Status<SortIcon column="status" />
      </th>
      <th
        className="dm-table-header-cell dm-table-header-cell-center"
        style={{
          color: theme.colors.textSecondary,
          width: columnWidths.actions
        }}
      >
        Actions
      </th>
    </tr>
  </thead>
);

export default TableHeader;
