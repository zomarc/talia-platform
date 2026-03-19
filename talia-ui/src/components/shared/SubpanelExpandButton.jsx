import React from 'react';

const SubpanelExpandButton = ({
  expanded = false,
  onToggle,
  label = 'section',
  className = '',
}) => (
  <button
    type="button"
    className={`talia-btn talia-btn--ghost talia-btn--small talia-btn--icon ${className}`.trim()}
    aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
    title={expanded ? 'Return to panel layout' : `Expand ${label}`}
    onClick={onToggle}
  >
    {expanded ? '↙' : '↗'}
  </button>
);

export default SubpanelExpandButton;
