/**
 * Position HoverPreview in the global window.
 * Prefer attaching beside the panel/row; the bubble may extend past the panel
 * (below when the row is at the top, above when it is at the bottom).
 * Never clip with an inner scrollbar.
 */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const resolveHoverWindowBox = () => {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  const viewTop = vv?.offsetTop ?? 0;
  const viewLeft = vv?.offsetLeft ?? 0;
  const viewRight = viewLeft + (vv?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 0));
  const viewBottom = viewTop + (vv?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 0));
  return {
    top: viewTop,
    left: viewLeft,
    right: viewRight,
    bottom: viewBottom,
  };
};

export const measureHoverPreviewPosition = ({
  bubbleEl,
  anchorRect,
  x,
  y,
  placement = 'right',
  containEl = null,
}) => {
  const bw = bubbleEl?.offsetWidth || 280;
  const bh = bubbleEl?.offsetHeight || 120;
  const pad = 8;
  const gap = 8;
  const box = resolveHoverWindowBox();
  const minTop = box.top + pad;
  const maxTop = Math.max(minTop, box.bottom - pad - bh);

  const panelRect = containEl?.getBoundingClientRect?.() || null;

  let top = minTop;
  let left = box.left + pad;

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
      left = anchorRect.right + gap;
      top = anchorRect.top + ((anchorRect.height || 0) / 2) - (bh / 2);
    }

    if (placement === 'right' && left + bw > box.right - pad) {
      const flipLeft = (panelRect?.left ?? anchorRect.left) - bw - gap;
      left = Math.max(box.left + pad, flipLeft);
    } else if (placement === 'left' && left < box.left + pad) {
      left = Math.min(box.right - bw - pad, anchorRect.right + gap);
    }
  } else if (x != null && y != null) {
    left = Number(x) + 12;
    top = Number(y) + 12;
    if (left + bw > box.right - pad) left = Math.max(box.left + pad, Number(x) - bw - 12);
  }

  top = clamp(top, minTop, maxTop);
  left = clamp(left, box.left + pad, Math.max(box.left + pad, box.right - pad - bw));

  return { top, left, ready: true };
};
