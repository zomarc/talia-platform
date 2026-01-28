import React from 'react';

const TablesSection = ({
  theme,
  loading,
  error,
  top5Tables,
  restTables,
  renderTableHeader,
  renderTableRows
}) => {
  return (
    <>
      {/* Top 5 Tables */}
      {!loading && !error && top5Tables.length > 0 && (
        <div
          style={{
            background: theme.colors.glass,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            border: `1px solid ${theme.colors.glassBorder}`,
            marginBottom: '8px',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              padding: '6px 8px',
              background: 'rgba(0, 0, 0, 0.2)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderBottom: `1px solid ${theme.colors.glassBorder}`,
              fontSize: '10px',
              fontWeight: '600',
              color: theme.colors.textSecondary
            }}
          >
            Top 5 Tables
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table
              className="data-management-table"
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '10px',
                tableLayout: 'fixed',
                color: theme.colors.foreground
              }}
            >
              {renderTableHeader()}
              <tbody>{renderTableRows(top5Tables)}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rest of Tables */}
      {!loading && !error && restTables.length > 0 && (
        <div
          style={{
            background: theme.colors.glass,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            border: `1px solid ${theme.colors.glassBorder}`,
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              padding: '6px 8px',
              background: 'rgba(0, 0, 0, 0.2)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderBottom: `1px solid ${theme.colors.glassBorder}`,
              fontSize: '10px',
              fontWeight: '600',
              color: theme.colors.textSecondary
            }}
          >
            All Tables ({restTables.length})
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table
              className="data-management-table"
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '10px',
                tableLayout: 'fixed',
                color: theme.colors.foreground
              }}
            >
              {renderTableHeader()}
              <tbody>{renderTableRows(restTables)}</tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
};

export default TablesSection;
