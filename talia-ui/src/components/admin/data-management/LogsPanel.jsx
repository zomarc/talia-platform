import React from 'react';

const LogsPanel = ({ title, logs, emptyMessage, onClear, logRef, onMaximize, onMinimize, isMaximized, fullHeight }) => {
  const toggleHandler = isMaximized ? onMinimize : onMaximize;
  const panelClassName = `dm-panel ${fullHeight ? 'dm-panel--full' : ''}`;
  const contentClassName = `dm-panel__content ${fullHeight ? '' : 'dm-panel__content--limited'}`;

  const resolveVariant = (log) => {
    if (log.type) return log.type;
    const message = log.message || '';
    if (message.includes('[ERROR]') || message.includes('❌')) return 'error';
    if (message.includes('✅') || message.includes('Successfully')) return 'success';
    if (message.includes('⚠️') || message.toLowerCase().includes('warn')) return 'warning';
    return 'info';
  };

  return (
    <div className={panelClassName}>
      <div className="dm-panel__header">
        <div className="dm-panel__title">{title}</div>
        <div className="dm-panel__actions">
          {toggleHandler && (
            <button
              onClick={toggleHandler}
              className="dm-panel__button"
              title={isMaximized ? 'Minimize' : 'Maximize'}
            >
              {isMaximized ? '⤡' : '⤢'}
            </button>
          )}
          <button
            onClick={onClear}
            className="dm-panel__button"
          >
            Clear
          </button>
        </div>
      </div>
      <div
        className={contentClassName}
        ref={logRef}
      >
        {logs.length === 0 ? (
          <div className="dm-log-empty">
            {emptyMessage}
          </div>
        ) : (
          logs.map((log) => {
            const variant = resolveVariant(log);
            const variantClass = variant && variant !== 'info' ? `dm-log-item--${variant}` : '';
            return (
              <div
                key={log.id}
                className={`dm-log-item ${variantClass}`}
              >
                <span className="dm-log-time">
                  {log.timestamp.toLocaleTimeString()}
                </span>
                {' '}
                <span className="dm-log-table">[{log.tableName}]</span>
                {' '}
                {log.message}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default LogsPanel;
