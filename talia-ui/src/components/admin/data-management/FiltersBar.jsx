import React from 'react';

const FiltersBar = ({
  tables,
  activeFilter,
  setActiveFilter,
  filterText,
  setFilterText
}) => {
  return (
    <div className="dm-filters">
      <button
        onClick={() => setActiveFilter(activeFilter === 'no-data' ? null : 'no-data')}
        className="dm-filter-button"
        data-active={activeFilter === 'no-data'}
      >
        No Data ({tables.filter(t => t.rowCount === 0).length})
      </button>
      <button
        onClick={() => setActiveFilter(activeFilter === 'has-data' ? null : 'has-data')}
        className="dm-filter-button"
        data-active={activeFilter === 'has-data'}
      >
        Has Data ({tables.filter(t => t.rowCount > 0).length})
      </button>
      <button
        onClick={() => setActiveFilter(activeFilter === 'synced' ? null : 'synced')}
        className="dm-filter-button"
        data-active={activeFilter === 'synced'}
      >
        Synced ({tables.filter(t => t.syncStatus === 'Synced').length})
      </button>
      <button
        onClick={() => setActiveFilter(activeFilter === 'outdated' ? null : 'outdated')}
        className="dm-filter-button"
        data-active={activeFilter === 'outdated'}
      >
        Outdated ({tables.filter(t => t.syncStatus === 'Outdated').length})
      </button>
      <input
        type="text"
        placeholder="Search..."
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        className="dm-filter-search"
      />
    </div>
  );
};

export default FiltersBar;
