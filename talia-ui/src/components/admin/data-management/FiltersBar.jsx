import React from 'react';

const FiltersBar = ({
  theme,
  tables,
  activeFilter,
  setActiveFilter,
  filterText,
  setFilterText
}) => {
  return (
    <div
      style={{
        background: theme.colors.glass,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: '6px 8px',
        borderRadius: '12px',
        marginBottom: '8px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        border: `1px solid ${theme.colors.glassBorder}`,
        display: 'flex',
        gap: '6px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}
    >
      <button
        onClick={() => setActiveFilter(activeFilter === 'no-data' ? null : 'no-data')}
        style={{
          padding: '4px 8px',
          background: activeFilter === 'no-data' ? theme.colors.accent : theme.colors.glass,
          backdropFilter: activeFilter !== 'no-data' ? 'blur(10px)' : 'none',
          WebkitBackdropFilter: activeFilter !== 'no-data' ? 'blur(10px)' : 'none',
          color: activeFilter === 'no-data' ? '#0f0f23' : theme.colors.foreground,
          border: activeFilter !== 'no-data' ? `1px solid ${theme.colors.glassBorder}` : 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '10px',
          fontWeight: '500',
          transition: 'all 0.2s'
        }}
      >
        No Data ({tables.filter(t => t.rowCount === 0).length})
      </button>
      <button
        onClick={() => setActiveFilter(activeFilter === 'has-data' ? null : 'has-data')}
        style={{
          padding: '4px 8px',
          background: activeFilter === 'has-data' ? theme.colors.accent : theme.colors.glass,
          backdropFilter: activeFilter !== 'has-data' ? 'blur(10px)' : 'none',
          WebkitBackdropFilter: activeFilter !== 'has-data' ? 'blur(10px)' : 'none',
          color: activeFilter === 'has-data' ? '#0f0f23' : theme.colors.foreground,
          border: activeFilter !== 'has-data' ? `1px solid ${theme.colors.glassBorder}` : 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '10px',
          fontWeight: '500',
          transition: 'all 0.2s'
        }}
      >
        Has Data ({tables.filter(t => t.rowCount > 0).length})
      </button>
      <button
        onClick={() => setActiveFilter(activeFilter === 'synced' ? null : 'synced')}
        style={{
          padding: '4px 8px',
          background: activeFilter === 'synced' ? theme.colors.accent : theme.colors.glass,
          backdropFilter: activeFilter !== 'synced' ? 'blur(10px)' : 'none',
          WebkitBackdropFilter: activeFilter !== 'synced' ? 'blur(10px)' : 'none',
          color: activeFilter === 'synced' ? '#0f0f23' : theme.colors.foreground,
          border: activeFilter !== 'synced' ? `1px solid ${theme.colors.glassBorder}` : 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '10px',
          fontWeight: '500',
          transition: 'all 0.2s'
        }}
      >
        Synced ({tables.filter(t => t.syncStatus === 'Synced').length})
      </button>
      <button
        onClick={() => setActiveFilter(activeFilter === 'outdated' ? null : 'outdated')}
        style={{
          padding: '4px 8px',
          background: activeFilter === 'outdated' ? theme.colors.accent : theme.colors.glass,
          backdropFilter: activeFilter !== 'outdated' ? 'blur(10px)' : 'none',
          WebkitBackdropFilter: activeFilter !== 'outdated' ? 'blur(10px)' : 'none',
          color: activeFilter === 'outdated' ? '#0f0f23' : theme.colors.foreground,
          border: activeFilter !== 'outdated' ? `1px solid ${theme.colors.glassBorder}` : 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '10px',
          fontWeight: '500',
          transition: 'all 0.2s'
        }}
      >
        Outdated ({tables.filter(t => t.syncStatus === 'Outdated').length})
      </button>
      <input
        type="text"
        placeholder="Search..."
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        style={{
          flex: 1,
          minWidth: '120px',
          padding: '4px 8px',
          border: `1px solid ${theme.colors.glassBorder}`,
          borderRadius: '6px',
          fontSize: '10px',
          background: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          color: theme.colors.foreground
        }}
      />
    </div>
  );
};

export default FiltersBar;
