/**
 * Activate a Dockview panel so chrome focus and row/data selection share one gesture.
 * Returns true when this call changed the active panel.
 */

const JUST_ACTIVATED_ATTR = 'data-talia-just-activated';
const JUST_ACTIVATED_MS = 400;

export const isDockviewPanelActive = (panelApi) => {
  if (!panelApi) return false;
  return typeof panelApi.isActive === 'function'
    ? Boolean(panelApi.isActive())
    : panelApi.isActive === true;
};

const resolveShell = (panelInstanceId, shellEl = null) => {
  if (shellEl) return shellEl;
  if (!panelInstanceId || typeof document === 'undefined') return null;
  return document.querySelector(
    `[data-panel-instance-id="${CSS.escape(String(panelInstanceId))}"]`
  );
};

const markJustActivated = (panelInstanceId, shellEl = null) => {
  if (typeof document === 'undefined') return;
  const shell = resolveShell(panelInstanceId, shellEl);
  if (!shell) return;
  shell.setAttribute(JUST_ACTIVATED_ATTR, '1');
  const clear = () => {
    if (shell.getAttribute(JUST_ACTIVATED_ATTR) === '1') {
      shell.removeAttribute(JUST_ACTIVATED_ATTR);
    }
    if (typeof window === 'undefined') return;
    window.removeEventListener('pointerup', clear, true);
    window.removeEventListener('click', clear, true);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pointerup', clear, true);
    window.addEventListener('click', clear, true);
    window.setTimeout(clear, JUST_ACTIVATED_MS);
  }
};

export const wasDockviewPanelJustActivated = (hostEl) => {
  if (!hostEl || typeof hostEl.closest !== 'function') return false;
  const shell = hostEl.closest('[data-panel-instance-id]');
  return shell?.getAttribute(JUST_ACTIVATED_ATTR) === '1';
};

/**
 * Dockview consumes the activating click. Replay it on the original target after
 * the turn so Tabulator rowClick/cellClick and other host listeners still run.
 */
export const replayClickAfterActivate = (sourceEvent) => {
  const target = sourceEvent?.target;
  if (!target || typeof target.addEventListener !== 'function') return;
  const blockNativeClick = (clickEvent) => {
    clickEvent.stopImmediatePropagation();
    clickEvent.preventDefault();
    target.removeEventListener('click', blockNativeClick, true);
  };
  target.addEventListener('click', blockNativeClick, true);
  window.setTimeout(() => {
    target.removeEventListener('click', blockNativeClick, true);
    const ClickEvent = typeof MouseEvent === 'function' ? MouseEvent : Event;
    target.dispatchEvent(new ClickEvent('click', {
      bubbles: true,
      cancelable: true,
      view: typeof window !== 'undefined' ? window : undefined,
      clientX: sourceEvent.clientX,
      clientY: sourceEvent.clientY,
    }));
  }, 0);
};

export const activateDockviewPanel = (panelApiOrId, options = {}) => {
  if (typeof window === 'undefined') return false;
  try {
    let panelApi = null;
    let panelInstanceId = typeof options.panelInstanceId === 'string' && options.panelInstanceId.trim()
      ? options.panelInstanceId.trim()
      : null;
    if (panelApiOrId && typeof panelApiOrId === 'object' && typeof panelApiOrId.setActive === 'function') {
      panelApi = panelApiOrId;
      panelInstanceId = panelInstanceId || panelApiOrId.id || null;
    } else if (typeof panelApiOrId === 'string' && panelApiOrId.trim()) {
      panelInstanceId = panelInstanceId || panelApiOrId.trim();
      const panel = window.dockviewApi?.getPanel?.(panelInstanceId);
      panelApi = panel?.api || null;
    }
    if (!panelApi || typeof panelApi.setActive !== 'function') return false;
    if (isDockviewPanelActive(panelApi)) return false;
    panelApi.setActive();
    markJustActivated(panelInstanceId || panelApi.id || null, options.shell || null);
    return true;
  } catch {
    return false;
  }
};

export const activateDockviewPanelFromHost = (hostEl) => {
  if (!hostEl || typeof hostEl.closest !== 'function') return false;
  const shell = hostEl.closest('[data-panel-instance-id]');
  const panelInstanceId = shell?.getAttribute?.('data-panel-instance-id') || null;
  return activateDockviewPanel(panelInstanceId, { panelInstanceId, shell });
};

export default activateDockviewPanel;
