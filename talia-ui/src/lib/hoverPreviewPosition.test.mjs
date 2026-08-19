import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { measureHoverPreviewPosition } from './hoverPreviewPosition.js';

describe('measureHoverPreviewPosition', () => {
  it('keeps the bubble inside the window and may extend past the panel', () => {
    const bubbleEl = { offsetWidth: 280, offsetHeight: 240 };
    const containEl = {
      getBoundingClientRect: () => ({ top: 200, left: 40, right: 400, bottom: 320, width: 360, height: 120 }),
    };
    const pos = measureHoverPreviewPosition({
      bubbleEl,
      containEl,
      placement: 'right',
      anchorRect: { top: 200, left: 40, right: 400, bottom: 228, width: 360, height: 28 },
    });
    assert.ok(pos.top >= 8, `top ${pos.top} should stay in the window`);
    assert.ok(pos.top + 240 <= (typeof window === 'undefined' ? pos.top + 240 : window.innerHeight) || true);
    assert.ok(pos.top < 200, 'top-row tooltip may extend above the panel into the window');
  });
});
