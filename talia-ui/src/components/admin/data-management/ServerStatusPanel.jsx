import React from 'react';

const ServerStatusPanel = ({
  serverServices,
  serverStatus,
  expandedServices,
  setExpandedServices,
  isRefreshingStatus,
  checkServerStatus,
  formatDateTime,
  onRestartGraphQL,
  onLogInfo,
  onMaximize,
  onMinimize,
  isMaximized,
  fullHeight,
  hideTitle,
  embedded = false,
}) => {
  const toggleHandler = isMaximized ? onMinimize : onMaximize;
  const onlineCount = serverServices.filter(service => serverStatus[service.id]?.online).length;
  const panelClassName = `dm-panel dm-status-panel ${fullHeight ? 'dm-panel--full dm-status-panel--full' : ''} ${embedded ? 'dm-panel--embedded' : ''}`.trim();
  const listClassName = `dm-status-list ${fullHeight ? '' : 'dm-panel__content--limited'}`;
  return (
    <div className={panelClassName}>
      <div className={`dm-panel__header ${hideTitle ? 'dm-panel__header--actions-only' : ''}`}>
        {!hideTitle && (
          <div className="dm-panel__title dm-status-title">
            🖥️ Server Status
            <span className="dm-status-count">
              ({onlineCount}/{serverServices.length} Online)
            </span>
          </div>
        )}
        <div className="dm-panel__actions">
          {toggleHandler && (
            <button
              onClick={toggleHandler}
              className="dm-panel__button dm-panel__button--compact"
              title={isMaximized ? 'Minimize' : 'Maximize'}
            >
              {isMaximized ? '⤡' : '⤢'}
            </button>
          )}
          <button
            onClick={checkServerStatus}
            disabled={isRefreshingStatus}
            className="dm-panel__button dm-panel__button--compact"
            title="Refresh Status"
          >
            <span className={`dm-status-refresh__icon ${isRefreshingStatus ? 'is-rotating' : ''}`}>
              ⟳
            </span>
          </button>
        </div>
      </div>

      <div className={listClassName}>
        {serverServices.map(service => {
          const status = serverStatus[service.id] || { online: false };
          const isExpanded = expandedServices[service.id] || false;

          return (
            <div
              key={service.id}
              className="dm-status-card"
            >
              <div
                onClick={() => setExpandedServices(prev => ({ ...prev, [service.id]: !prev[service.id] }))}
                className="dm-status-card__header"
              >
                <div className="dm-status-card__title">
                  <div
                    className={`dm-status-dot ${status.online ? 'dm-status-dot--online' : 'dm-status-dot--offline'}`}
                  />
                  <span className="dm-status-name">
                    {service.icon} {service.name}
                  </span>
                  <span className="dm-status-state">
                    {status.online ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div
                  className={`dm-status-chevron ${isExpanded ? 'dm-status-chevron--expanded' : ''}`}
                >
                  ▼
                </div>
              </div>

              {isExpanded && (
                <div className="dm-status-details">
                  {service.display?.address && (
                    <div className="dm-status-details__row">
                      {typeof service.display.address === 'function'
                        ? service.display.address(status)
                        : service.display.address}
                    </div>
                  )}

                  {(status.lastStarted || status.lastChecked) && (
                    <div className="dm-status-details__row dm-status-details__row--muted">
                      {status.lastStarted
                        ? `Last seen online: ${formatDateTime(status.lastStarted)}`
                        : `Last checked: ${formatDateTime(status.lastChecked)}`}
                    </div>
                  )}

                  {!status.online && (
                    <div
                      className="dm-status-details__error"
                    >
                      {typeof service.offlineMessage === 'function'
                        ? service.offlineMessage(status)
                        : service.offlineMessage}
                    </div>
                  )}

                  {service.actions && status.online && service.actions.map(action => {
                    if (action.handler === 'restartGraphQL') {
                      return (
                        <button
                          key={action.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onLogInfo) {
                              onLogInfo(`🔄 Restarting ${service.name}...`);
                            }
                            if (onRestartGraphQL) {
                              onRestartGraphQL();
                            }
                          }}
                          className="dm-status-action"
                        >
                          {action.icon} {action.label}
                        </button>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ServerStatusPanel;
