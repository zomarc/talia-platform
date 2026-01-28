import React from 'react';

const ServerStatusPanel = ({
  theme,
  serverServices,
  serverStatus,
  expandedServices,
  setExpandedServices,
  isRefreshingStatus,
  checkServerStatus,
  formatDateTime,
  onRestartGraphQL,
  onLogInfo
}) => {
  return (
    <div
      style={{
        width: '300px',
        background: theme.colors.glass,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: `1px solid ${theme.colors.glassBorder}`,
        borderRadius: '12px 12px 0 0',
        boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${theme.colors.glassBorder}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: '600', color: theme.colors.foreground, display: 'flex', alignItems: 'center', gap: '8px' }}>
          🖥️ Server Status
          <span style={{ fontSize: '9px', fontWeight: '400', color: theme.colors.textSecondary, marginLeft: '4px' }}>
            ({serverServices.filter(service => serverStatus[service.id]?.online).length}/{serverServices.length} Online)
          </span>
        </div>
        <button
          onClick={checkServerStatus}
          disabled={isRefreshingStatus}
          style={{
            padding: '4px 8px',
            fontSize: '10px',
            background: isRefreshingStatus ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
            color: theme.colors.textSecondary,
            border: `1px solid ${theme.colors.glassBorder}`,
            borderRadius: '4px',
            cursor: isRefreshingStatus ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s ease',
            minWidth: '24px',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => {
            if (!isRefreshingStatus) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
          onMouseLeave={(e) => {
            if (!isRefreshingStatus) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
          }}
          title="Refresh Status"
        >
          <span
            style={{
              display: 'inline-block',
              transform: isRefreshingStatus ? 'rotate(360deg)' : 'rotate(0deg)',
              transition: 'transform 0.5s ease',
              transformOrigin: 'center'
            }}
          >
            ⟳
          </span>
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px',
          fontSize: '9px',
          maxHeight: '400px'
        }}
      >
        {serverServices.map(service => {
          const status = serverStatus[service.id] || { online: false };
          const isExpanded = expandedServices[service.id] || false;

          return (
            <div
              key={service.id}
              style={{
                marginBottom: '8px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '6px',
                border: `1px solid ${theme.colors.glassBorder}`,
                overflow: 'hidden'
              }}
            >
              <div
                onClick={() => setExpandedServices(prev => ({ ...prev, [service.id]: !prev[service.id] }))}
                style={{
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'background 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (e.currentTarget) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  if (e.currentTarget) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: status.online ? '#4caf50' : '#f44336',
                      boxShadow: status.online ? '0 0 4px #4caf50' : 'none',
                      flexShrink: 0
                    }}
                  />
                  <span style={{ fontWeight: '600', color: theme.colors.foreground }}>
                    {service.icon} {service.name}
                  </span>
                  <span style={{ fontSize: '8px', color: theme.colors.textSecondary, marginLeft: '4px' }}>
                    {status.online ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '8px',
                    color: theme.colors.textSecondary,
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                    marginLeft: '8px'
                  }}
                >
                  ▼
                </div>
              </div>

              {isExpanded && (
                <div style={{ padding: '8px', paddingTop: '0', borderTop: `1px solid ${theme.colors.glassBorder}` }}>
                  {service.display?.address && (
                    <div style={{ color: theme.colors.textSecondary, fontSize: '8px', marginTop: '4px' }}>
                      {typeof service.display.address === 'function'
                        ? service.display.address(status)
                        : service.display.address}
                    </div>
                  )}

                  {(status.lastStarted || status.lastChecked) && (
                    <div style={{ color: theme.colors.textMuted, fontSize: '8px', marginTop: '4px' }}>
                      {status.lastStarted
                        ? `Last seen online: ${formatDateTime(status.lastStarted)}`
                        : `Last checked: ${formatDateTime(status.lastChecked)}`}
                    </div>
                  )}

                  {!status.online && (
                    <div
                      style={{
                        marginTop: '6px',
                        padding: '4px 6px',
                        background: 'rgba(244, 67, 54, 0.1)',
                        borderRadius: '4px',
                        fontSize: '8px',
                        color: '#f44336'
                      }}
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
                          style={{
                            marginTop: '6px',
                            padding: '4px 8px',
                            fontSize: '8px',
                            background: 'rgba(255, 152, 0, 0.2)',
                            color: '#ff9800',
                            border: `1px solid #ff9800`,
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
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
