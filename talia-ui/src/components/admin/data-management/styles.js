export const getRootStyle = (theme) => ({
  padding: '8px',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
  backgroundAttachment: 'fixed',
  minHeight: '100vh',
  position: 'relative',
  '--table-row-even': theme.colors.tableRowEven,
  '--table-row-odd': theme.colors.tableRowOdd,
  '--table-row-hover': theme.colors.tableRowHover,
  '--table-row-selected': theme.colors.tableRowSelected,
  '--table-row-selected-hover': theme.colors.tableRowSelectedHover,
  '--glass-border': theme.colors.glassBorder,
  '--foreground': theme.colors.foreground,
  '--text-secondary': theme.colors.textSecondary,
  '--text-muted': theme.colors.textMuted
});
