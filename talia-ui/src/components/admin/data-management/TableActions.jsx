import React from 'react';
import { getPanelActionDefinition, PANEL_ACTION_IDS } from '../../shared/panelActions';

const TableActions = ({
  table,
  isSyncing,
  selectedTable,
  statusLoadingTable,
  reviewLoading,
  onOpenStatus,
  tableActions
}) => {
  if (table.hasSyncConfig !== true) {
    return <span className="dm-action-placeholder">—</span>;
  }

  return (
    <div className="talia-action-group">
      <button
        onClick={() => onOpenStatus(table)}
        disabled={statusLoadingTable === table.tableName}
        className="talia-btn talia-btn--small talia-btn--icon talia-action-btn talia-action-btn--neutral"
        title={getPanelActionDefinition(PANEL_ACTION_IDS.STATUS)?.title}
        aria-label={getPanelActionDefinition(PANEL_ACTION_IDS.STATUS)?.label}
      >
        {statusLoadingTable === table.tableName ? '⏳' : getPanelActionDefinition(PANEL_ACTION_IDS.STATUS)?.icon}
      </button>
      {selectedTable === table.tableName && (
        <button
          onClick={() => tableActions.handleReview(table)}
          disabled={reviewLoading}
          className="talia-btn talia-btn--small talia-btn--icon talia-action-btn talia-action-btn--success"
          title={getPanelActionDefinition(PANEL_ACTION_IDS.REVIEW)?.title}
          aria-label={getPanelActionDefinition(PANEL_ACTION_IDS.REVIEW)?.label}
        >
          {reviewLoading ? '⏳' : getPanelActionDefinition(PANEL_ACTION_IDS.REVIEW)?.icon}
        </button>
      )}
      <button
        onClick={() => tableActions.handleIncrementalSync(table)}
        disabled={isSyncing}
        className="talia-btn talia-btn--small talia-btn--icon talia-action-btn talia-action-btn--primary"
        title={getPanelActionDefinition(PANEL_ACTION_IDS.SYNC)?.title}
        aria-label={getPanelActionDefinition(PANEL_ACTION_IDS.SYNC)?.label}
      >
        {isSyncing ? '⏳' : getPanelActionDefinition(PANEL_ACTION_IDS.SYNC)?.icon}
      </button>
      <button
        onClick={() => tableActions.handleFullSync(table)}
        disabled={isSyncing}
        className="talia-btn talia-btn--small talia-btn--icon talia-action-btn talia-action-btn--warning"
        title={getPanelActionDefinition(PANEL_ACTION_IDS.FULL)?.title}
        aria-label={getPanelActionDefinition(PANEL_ACTION_IDS.FULL)?.label}
      >
        {isSyncing ? '⏳' : getPanelActionDefinition(PANEL_ACTION_IDS.FULL)?.icon}
      </button>
    </div>
  );
};

export default TableActions;
