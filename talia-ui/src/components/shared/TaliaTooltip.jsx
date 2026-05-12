import React, { useEffect, useId, useRef, useState } from 'react';

const TaliaTooltip = ({ content = '', children, placement = 'bottom-left', delayMs = 220 }) => {
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);
  const tooltipId = useId();
  const text = String(content || '').trim();
  if (!text) return children;

  const handleOpen = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setOpen(true);
      timerRef.current = null;
    }, Math.max(0, Number(delayMs) || 0));
  };

  const handleClose = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOpen(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <span
      className="talia-tooltip"
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
      onFocus={handleOpen}
      onBlur={handleClose}
    >
      <span aria-describedby={tooltipId}>
        {children}
      </span>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className={`talia-tooltip__bubble talia-tooltip__bubble--${placement}`}
        >
          {text}
        </span>
      )}
    </span>
  );
};

export default TaliaTooltip;
