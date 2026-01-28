import React from 'react';

const SummaryBar = ({ theme, tables }) => {
  return (
    <div
      style={{
        background: theme.colors.glass,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: '6px 12px',
        borderRadius: '12px',
        marginBottom: '8px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        border: `1px solid ${theme.colors.glassBorder}`,
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        fontSize: '10px',
        borderLeft: `2px solid ${theme.colors.accent}`
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ color: theme.colors.textSecondary }}>Total:</span>
        <span style={{ color: theme.colors.foreground, fontWeight: '600' }}>{tables.length}</span>
      </div>
      <div style={{ width: '1px', height: '16px', background: theme.colors.glassBorder }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ color: theme.colors.textSecondary }}>Synced:</span>
        <span style={{ color: '#4caf50', fontWeight: '600' }}>
          {tables.filter(t => t.syncStatus === 'Synced').length}
        </span>
      </div>
      <div style={{ width: '1px', height: '16px', background: theme.colors.glassBorder }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ color: theme.colors.textSecondary }}>With Data:</span>
        <span style={{ color: theme.colors.foreground, fontWeight: '600' }}>
          {tables.filter(t => t.rowCount > 0).length}
        </span>
      </div>
    </div>
  );
};

export default SummaryBar;
