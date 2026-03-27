import { useCallback } from 'react';

/**
 * Standard requestAnimationFrame loop: await update → draw → reschedule while running.
 */
export function useArcadeGameLoop({ modelRef, rafRef, updateModel, draw }) {
  return useCallback(async function loop() {
    await updateModel();
    draw();
    if (modelRef.current.running) {
      rafRef.current = window.requestAnimationFrame(loop);
    }
  }, [draw, modelRef, rafRef, updateModel]);
}
