import React from 'react';

const SummaryBar = ({ tables }) => {
  return (
    <div className="dm-summary-bar">
      <div className="dm-summary-item">
        <span className="dm-summary-label">Total:</span>
        <span className="dm-summary-value">{tables.length}</span>
      </div>
      <div className="dm-summary-divider" />
      <div className="dm-summary-item">
        <span className="dm-summary-label">Synced:</span>
        <span className="dm-summary-value dm-summary-value--success">
          {tables.filter(t => t.syncStatus === 'Synced').length}
        </span>
      </div>
      <div className="dm-summary-divider" />
      <div className="dm-summary-item">
        <span className="dm-summary-label">With Data:</span>
        <span className="dm-summary-value">
          {tables.filter(t => t.rowCount > 0).length}
        </span>
      </div>
    </div>
  );
};

export default SummaryBar;
