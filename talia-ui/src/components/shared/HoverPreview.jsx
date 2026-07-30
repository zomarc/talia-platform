/**
 * Portal hover surface for rich React content (not text-only TaliaTooltip).
 * Opacity + appear delay come from Appearance (ThemeContext) by default.
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../contexts/ThemeContext';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const measurePosition = ({
  bubbleEl,
  anchorRect,
  x,
  y,
  placement,
}) => {
  const bw = bubbleEl.offsetWidth || 280;
  const bh = bubbleEl.offsetHeight || 120;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = 8;
  const gap = 8;

  let top = pad;
  let left = pad;

  if (anchorRect) {
    if (placement === 'top') {
      left = anchorRect.left;
      top = anchorRect.top - bh - gap;
    } else if (placement === 'left') {
      left = anchorRect.left - bw - gap;
      top = anchorRect.top;
    } else if (placement === 'bottom') {
      left = anchorRect.left;
      top = anchorRect.bottom + gap;
    } else {
      // right (default): sit just outside the visible selection edge
      left = anchorRect.right + gap;
      top = anchorRect.top + ((anchorRect.height || 0) / 2) - (bh / 2);
    }

    if (placement === 'right' && left + bw > vw - pad) {
      left = Math.max(pad, anchorRect.left - bw - gap);
    } else if (placement === 'left' && left < pad) {
      left = Math.min(vw - bw - pad, anchorRect.right + gap);
    }

    if (top + bh > vh - pad) {
      top = Math.max(pad, vh - bh - pad);
    }
    if (top < pad) top = pad;
    left = clamp(left, pad, Math.max(pad, vw - bw - pad));
  } else if (x != null && y != null) {
    left = Number(x) + 12;
    top = Number(y) + 12;
    if (left + bw > vw - pad) left = Math.max(pad, Number(x) - bw - 12);
    if (top + bh > vh - pad) top = Math.max(pad, Number(y) - bh - 12);
    left = clamp(left, pad, Math.max(pad, vw - bw - pad));
    top = clamp(top, pad, Math.max(pad, vh - bh - pad));
  }

  return { top, left, ready: true };
};

/**
 * @param {{
 *   open: boolean,
 *   anchorRect?: DOMRect | { top: number, left: number, right: number, bottom: number, width?: number, height?: number } | null,
 *   x?: number | null,
 *   y?: number | null,
 *   delayMs?: number | null,
 *   placement?: 'right' | 'left' | 'bottom' | 'top',
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
    if (!visible || !bubbleRef.current) return;
    setCoords(measurePosition({
      bubbleEl: bubbleRef.current,
      anchorRect,
      x,
      y,
      placement,
    }));
  }, [visible, anchorRect, x, y, placement, children]);

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
