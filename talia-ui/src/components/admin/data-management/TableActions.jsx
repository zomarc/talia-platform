import React from 'react';
import { getPanelActionDefinition, PANEL_ACTION_IDS } from '../../shared/panelActions';
import { PanelActionIcon } from '../../shared/StatusBarIcons';

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

  const statusDef = getPanelActionDefinition(PANEL_ACTION_IDS.STATUS);
  const reviewDef = getPanelActionDefinition(PANEL_ACTION_IDS.REVIEW);
  const syncDef = getPanelActionDefinition(PANEL_ACTION_IDS.SYNC);
  const fullDef = getPanelActionDefinition(PANEL_ACTION_IDS.FULL);
  const stopDef = getPanelActionDefinition(PANEL_ACTION_IDS.STOP);

  return (
    <div className="talia-action-group">
      <button
        onClick={() => onOpenStatus(table)}
        disabled={statusLoadingTable === table.tableName}
        className="talia-btn talia-btn--small talia-btn--icon talia-action-btn talia-action-btn--neutral"
        title={statusDef?.title}
        aria-label={statusDef?.label}
      >
        <PanelActionIcon
          actionId={PANEL_ACTION_IDS.STATUS}
          busy={statusLoadingTable === table.tableName}
        />
      </button>
      {selectedTable === table.tableName && (
        <button
          onClick={() => tableActions.handleReview(table)}
          disabled={reviewLoading}
          className="talia-btn talia-btn--small talia-btn--icon talia-action-btn talia-action-btn--success"
          title={reviewDef?.title}
          aria-label={reviewDef?.label}
        >
          <PanelActionIcon actionId={PANEL_ACTION_IDS.REVIEW} busy={reviewLoading} />
        </button>
      )}
      <button
        onClick={() => tableActions.handleIncrementalSync(table)}
        disabled={isSyncing}
        className="talia-btn talia-btn--small talia-btn--icon talia-action-btn talia-action-btn--primary"
        title={syncDef?.title}
        aria-label={syncDef?.label}
      >
        <PanelActionIcon actionId={PANEL_ACTION_IDS.SYNC} busy={isSyncing} />
      </button>
      <button
        onClick={() => tableActions.handleFullSync(table)}
        disabled={isSyncing}
        className="talia-btn talia-btn--small talia-btn--icon talia-action-btn talia-action-btn--warning"
        title={fullDef?.title}
        aria-label={fullDef?.label}
      >
        <PanelActionIcon actionId={PANEL_ACTION_IDS.FULL} busy={isSyncing} />
      </button>
      {isSyncing ? (
        <button
          onClick={() => tableActions.handleStop(table)}
          className="talia-btn talia-btn--small talia-btn--icon talia-action-btn talia-action-btn--danger"
          title={stopDef?.title}
          aria-label={stopDef?.label}
        >
          <PanelActionIcon actionId={PANEL_ACTION_IDS.STOP} />
        </button>
      ) : null}
    </div>
  );
};

export default TableActions;
