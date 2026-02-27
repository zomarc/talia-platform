import React from 'react';

const TableHeader = ({ handleSort, SortIcon }) => {
  const SortIconComponent = SortIcon;
  return (
    <thead>
    <tr
      className="dm-table-header-row"
    >
      <th
        onClick={() => handleSort('tableName')}
        className="dm-table-header-cell dm-table-header-cell-left dm-table-header-cell-sortable dm-col-table-name"
      >
        Table Name<SortIconComponent column="tableName" />
      </th>
      <th
        onClick={() => handleSort('source')}
        className="dm-table-header-cell dm-table-header-cell-left dm-table-header-cell-sortable dm-col-source"
      >
        Source<SortIconComponent column="source" />
      </th>
      <th
        onClick={() => handleSort('loadMethod')}
        className="dm-table-header-cell dm-table-header-cell-left dm-table-header-cell-sortable dm-col-load-method"
      >
        Load Method<SortIconComponent column="loadMethod" />
      </th>
      <th
        onClick={() => handleSort('rowCount')}
        className="dm-table-header-cell dm-table-header-cell-right dm-table-header-cell-sortable dm-col-row-count"
      >
        Rows<SortIconComponent column="rowCount" />
      </th>
      <th
        onClick={() => handleSort('dateRange')}
        className="dm-table-header-cell dm-table-header-cell-left dm-table-header-cell-sortable dm-col-date-range"
      >
        Data Range<SortIconComponent column="dateRange" />
      </th>
      <th
        onClick={() => handleSort('lastSync')}
        className="dm-table-header-cell dm-table-header-cell-left dm-table-header-cell-sortable dm-col-last-sync"
      >
        Last Sync<SortIconComponent column="lastSync" />
      </th>
      <th
        onClick={() => handleSort('latestSnapshot')}
        className="dm-table-header-cell dm-table-header-cell-left dm-table-header-cell-sortable dm-col-latest-snapshot"
      >
        Latest Snapshot<SortIconComponent column="latestSnapshot" />
      </th>
      <th
        onClick={() => handleSort('latestAvailableData')}
        className="dm-table-header-cell dm-table-header-cell-left dm-table-header-cell-sortable dm-col-latest-available"
        title="Latest data timestamp from the table (prefers snapshot_date, otherwise created/updated)"
      >
        Latest Data (Table)<SortIconComponent column="latestAvailableData" />
      </th>
      <th
        className="dm-table-header-cell dm-table-header-cell-center dm-col-data-health"
        title="Coverage vs lag using configured range and latest data"
      >
        Data Quality
      </th>
      <th
        onClick={() => handleSort('recordsProcessed')}
        className="dm-table-header-cell dm-table-header-cell-right dm-table-header-cell-sortable dm-col-records-processed"
      >
        Records<SortIconComponent column="recordsProcessed" />
      </th>
      <th
        onClick={() => handleSort('changesDetected')}
        className="dm-table-header-cell dm-table-header-cell-right dm-table-header-cell-sortable dm-col-changes-detected"
      >
        Changes<SortIconComponent column="changesDetected" />
      </th>
      <th
        onClick={() => handleSort('syncDuration')}
        className="dm-table-header-cell dm-table-header-cell-left dm-table-header-cell-sortable dm-col-sync-duration"
      >
        Duration<SortIconComponent column="syncDuration" />
      </th>
      <th
        onClick={() => handleSort('status')}
        className="dm-table-header-cell dm-table-header-cell-left dm-table-header-cell-sortable dm-col-status"
      >
        Status<SortIconComponent column="status" />
      </th>
      <th
        className="dm-table-header-cell dm-table-header-cell-center dm-col-actions"
      >
        Actions
      </th>
    </tr>
  </thead>
  );
};

export default TableHeader;
