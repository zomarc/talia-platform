/**
 * Clip a DOM rect to a viewport element (e.g. Tabulator panel).
 * Wide table rows otherwise park HoverPreview far off-screen.
 */

export const clipAnchorRectToViewport = (rowRect, clipEl) => {
  if (!rowRect) return null;
  const clipRect = clipEl?.getBoundingClientRect?.();
  if (!clipRect) {
    return {
      top: rowRect.top,
      left: rowRect.left,
      right: rowRect.right,
      bottom: rowRect.bottom,
      width: Math.max(0, rowRect.right - rowRect.left),
      height: Math.max(0, rowRect.bottom - rowRect.top),
    };
  }
  const left = Math.max(rowRect.left, clipRect.left);
  const right = Math.min(rowRect.right, clipRect.right);
  const top = Math.max(rowRect.top, clipRect.top);
  const bottom = Math.min(rowRect.bottom, clipRect.bottom);
  return {
    top,
    left,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
};
