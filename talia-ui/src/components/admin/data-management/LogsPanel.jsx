import React from 'react';

const LogsPanel = ({ theme, title, logs, emptyMessage, onClear, logRef, getLogStyle }) => {
  return (
    <div
      style={{
        flex: 1,
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
        <div style={{ fontSize: '11px', fontWeight: '600', color: theme.colors.foreground }}>
          {title}
        </div>
        <button
          onClick={onClear}
          style={{
            padding: '2px 6px',
            fontSize: '9px',
            background: 'transparent',
            color: theme.colors.textSecondary,
            border: `1px solid ${theme.colors.glassBorder}`,
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Clear
        </button>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px',
          fontFamily: 'monospace',
          fontSize: '9px'
        }}
        ref={logRef}
      >
        {logs.length === 0 ? (
          <div style={{ color: theme.colors.textMuted, textAlign: 'center', padding: '20px' }}>
            {emptyMessage}
          </div>
        ) : (
          logs.map((log) => {
            const styles = getLogStyle(log);
            return (
              <div
                key={log.id}
                style={{
                  padding: '4px 8px',
                  marginBottom: '2px',
                  borderRadius: '4px',
                  background: styles.background,
                  color: styles.color,
                  borderLeft: `3px solid ${styles.borderColor}`
                }}
              >
                <span style={{ color: theme.colors.textMuted }}>
                  {log.timestamp.toLocaleTimeString()}
                </span>
                {' '}
                <span style={{ fontWeight: '600' }}>[{log.tableName}]</span>
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
