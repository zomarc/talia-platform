import React from 'react';

const TablesSection = ({
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
        <div className="dm-table-section dm-table-section--spaced">
          <div className="dm-table-section__header">
            Top 5 Tables
          </div>
          <div className="dm-table-section__body">
            <table
              className="data-management-table dm-table"
            >
              {renderTableHeader()}
              <tbody>{renderTableRows(top5Tables)}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rest of Tables */}
      {!loading && !error && restTables.length > 0 && (
        <div className="dm-table-section">
          <div className="dm-table-section__header">
            All Tables ({restTables.length})
          </div>
          <div className="dm-table-section__body">
            <table
              className="data-management-table dm-table"
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
