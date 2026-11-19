import { useEffect, useRef } from 'react';
import { usePanelShell } from '../contexts/PanelShellContext';

/**
 * Framework window-event listener that no-ops while the panel is paused.
 * Marks a pending refresh so onResume (via PanelShellProvider) can catch up.
 *
 * @param {string} eventName
 * @param {(event: Event) => void} handler
 * @param {unknown[]} [deps]
 */
const usePanelBusListener = (eventName, handler, deps = []) => {
  const { shouldSkipRefresh, isPausedRef } = usePanelShell();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!eventName || typeof handlerRef.current !== 'function') return undefined;

    const onEvent = (event) => {
      if (isPausedRef?.current) {
        shouldSkipRefresh();
        return;
      }
      handlerRef.current?.(event);
    };

    window.addEventListener(eventName, onEvent);
    return () => window.removeEventListener(eventName, onEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller supplies deps
  }, [eventName, isPausedRef, shouldSkipRefresh, ...deps]);
};

export default usePanelBusListener;
