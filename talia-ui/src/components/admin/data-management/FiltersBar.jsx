import React from 'react';

const FiltersBar = ({
  tables,
  selectedTable,
  setSelectedTable,
  tableNames = [],
  syncableTableNames = [],
  rangeDraft,
  setRangeDraft,
  rangeSaving = false,
  rangeError = null,
  onSaveRange,
  viewMode,
  setViewMode,
  filterText,
  setFilterText
}) => {
  const counts = {
    all: tables.length,
    'top-five': Math.min(5, tables.length),
    'no-data': tables.filter((t) => t.rowCount === 0).length,
    'has-data': tables.filter((t) => t.rowCount > 0).length,
    synced: tables.filter((t) => t.syncStatus === 'Synced').length,
    outdated: tables.filter((t) => t.syncStatus === 'Outdated').length,
  };
  const tableOptions = React.useMemo(() => {
    const list = Array.isArray(tableNames) ? [...tableNames] : [];
    if (selectedTable && !list.includes(selectedTable)) {
      list.unshift(selectedTable);
    }
    return list;
  }, [tableNames, selectedTable]);

  return (
    <div className="dm-filters talia-report-filters talia-report__filters">
      <label className="dm-filter-group talia-report-filters__group" htmlFor="dm-table-filter">
        <span className="dm-filter-group__label talia-report-filters__label">Table</span>
        <select
          id="dm-table-filter"
          className="dm-filter-select talia-report-filters__input dm-action-header__select"
          value={selectedTable || ''}
          onChange={(event) => setSelectedTable(event.target.value || null)}
        >
          <option value="">Select table</option>
          {tableOptions.map((name) => (
            <option key={name} value={name}>
              {syncableTableNames.includes(name) ? name : `${name} (view only)`}
            </option>
          ))}
        </select>
      </label>
      <label className="dm-filter-group talia-report-filters__group" htmlFor="dm-view-mode">
        <span className="dm-filter-group__label talia-report-filters__label">View</span>
        <select
          id="dm-view-mode"
          className="dm-filter-select talia-report-filters__input"
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value)}
        >
          <option value="top-five">Top Five ({counts['top-five']})</option>
          <option value="all">All ({counts.all})</option>
          <option value="no-data">No Data ({counts['no-data']})</option>
          <option value="has-data">Has Data ({counts['has-data']})</option>
          <option value="synced">Synced ({counts.synced})</option>
          <option value="outdated">Outdated ({counts.outdated})</option>
        </select>
      </label>
      <label className="dm-filter-group talia-report-filters__group" htmlFor="dm-filter-search">
        <span className="dm-filter-group__label talia-report-filters__label">Search</span>
        <input
          id="dm-filter-search"
          type="text"
          placeholder="Search tables..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="dm-filter-search talia-report-filters__input"
        />
      </label>
      <label className="dm-filter-group talia-report-filters__group" htmlFor="dm-date-from">
        <span className="dm-filter-group__label talia-report-filters__label">From</span>
        <input
          id="dm-date-from"
          type="date"
          className="dm-filter-select talia-report-filters__input dm-action-header__input"
          value={rangeDraft?.from || ''}
          onChange={(event) => setRangeDraft((prev) => ({ ...(prev || {}), from: event.target.value || '' }))}
        />
      </label>
      <label className="dm-filter-group talia-report-filters__group" htmlFor="dm-date-to">
        <span className="dm-filter-group__label talia-report-filters__label">To</span>
        <input
          id="dm-date-to"
          type="date"
          className="dm-filter-select talia-report-filters__input dm-action-header__input"
          value={rangeDraft?.to || ''}
          onChange={(event) => setRangeDraft((prev) => ({ ...(prev || {}), to: event.target.value || '' }))}
        />
      </label>
      <button
        type="button"
        className="talia-btn talia-btn--small dm-filter-save"
        onClick={() => onSaveRange?.()}
        disabled={rangeSaving}
        title="Save integration date range"
      >
        {rangeSaving ? '⏳' : '✓'} Save
      </button>
      {rangeError ? <span className="dm-filter-error">{rangeError}</span> : null}
    </div>
  );
};

export default FiltersBar;
