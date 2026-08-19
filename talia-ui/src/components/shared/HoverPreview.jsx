/**
 * Portal hover surface for rich React content (not text-only TaliaTooltip).
 * Opacity + appear delay come from Appearance (ThemeContext) by default.
 * Position is clamped to the window so the card can extend past the panel.
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { measureHoverPreviewPosition } from '../../lib/hoverPreviewPosition';

/**
 * @param {{
 *   open: boolean,
 *   anchorRect?: DOMRect | { top: number, left: number, right: number, bottom: number, width?: number, height?: number } | null,
 *   x?: number | null,
 *   y?: number | null,
 *   delayMs?: number | null,
 *   placement?: 'right' | 'left' | 'bottom' | 'top',
 *   containRef?: { current: Element | null } | null,
 *   children?: React.ReactNode,
 *   className?: string,
 *   onRequestClose?: () => void,
 * }} props
 */
const HoverPreview = ({
  open = false,
  anchorRect = null,
  x = null,
  y = null,
  delayMs = null,
  placement = 'right',
  containRef = null,
  children = null,
  className = '',
  onRequestClose,
}) => {
  const theme = useTheme();
  const appearanceDelay = Number.isFinite(Number(theme?.hoverPreviewDelayMs))
    ? Number(theme.hoverPreviewDelayMs)
    : 10;
  const appearanceOpacity = Number.isFinite(Number(theme?.hoverPreviewOpacity))
    ? Number(theme.hoverPreviewOpacity)
    : 88;
  const effectiveDelayMs = delayMs == null ? appearanceDelay : Math.max(0, Number(delayMs) || 0);
  const opacity = Math.min(1, Math.max(0.2, appearanceOpacity / 100));

  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, ready: false });
  const bubbleRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!open || !children) {
      setVisible(false);
      setCoords({ top: 0, left: 0, ready: false });
      return undefined;
    }
    timerRef.current = window.setTimeout(() => {
      setVisible(true);
      timerRef.current = null;
    }, effectiveDelayMs);
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [open, effectiveDelayMs, children]);

  useLayoutEffect(() => {
    if (!visible || !bubbleRef.current) return undefined;
    const place = () => {
      setCoords(measureHoverPreviewPosition({
        bubbleEl: bubbleRef.current,
        anchorRect,
        x,
        y,
        placement,
        containEl: containRef?.current || null,
      }));
    };
    place();
    const bubble = bubbleRef.current;
    if (typeof ResizeObserver === 'undefined' || !bubble) return undefined;
    const observer = new ResizeObserver(() => place());
    observer.observe(bubble);
    return () => observer.disconnect();
  }, [visible, anchorRect, x, y, placement, children, containRef]);

  useEffect(() => {
    if (!visible) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onRequestClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onRequestClose]);

  if (!visible || !children || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={bubbleRef}
      className={`talia-hover-preview ${className}`.trim()}
      style={{
        top: coords.top,
        left: coords.left,
        visibility: coords.ready ? 'visible' : 'hidden',
        opacity,
      }}
      role="tooltip"
    >
      {children}
    </div>,
    document.body
  );
};

export default HoverPreview;
