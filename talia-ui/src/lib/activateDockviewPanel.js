/**
 * Activate a Dockview panel so chrome focus and row/data selection can share one gesture.
 * Returns true when this call changed the active panel.
 */

const markJustActivated = (panelInstanceId) => {
  if (!panelInstanceId || typeof document === 'undefined') return;
  const shell = document.querySelector(
    `[data-panel-instance-id="${CSS.escape(String(panelInstanceId))}"]`
  );
  if (!shell) return;
  shell.setAttribute('data-talia-just-activated', '1');
  window.setTimeout(() => {
    if (shell.getAttribute('data-talia-just-activated') === '1') {
      shell.removeAttribute('data-talia-just-activated');
    }
  }, 0);
};

export const wasDockviewPanelJustActivated = (hostEl) => {
  if (!hostEl || typeof hostEl.closest !== 'function') return false;
  const shell = hostEl.closest('[data-panel-instance-id]');
  return shell?.getAttribute('data-talia-just-activated') === '1';
};

export const activateDockviewPanel = (panelApiOrId) => {
  if (typeof window === 'undefined') return false;
  try {
    let panelApi = null;
    let panelInstanceId = null;
    if (panelApiOrId && typeof panelApiOrId === 'object' && typeof panelApiOrId.setActive === 'function') {
      panelApi = panelApiOrId;
      panelInstanceId = panelApiOrId.id || null;
    } else if (typeof panelApiOrId === 'string' && panelApiOrId.trim()) {
      panelInstanceId = panelApiOrId.trim();
      const panel = window.dockviewApi?.getPanel?.(panelInstanceId);
      panelApi = panel?.api || null;
    }
    if (!panelApi || typeof panelApi.setActive !== 'function') return false;
    if (panelApi.isActive) return false;
    panelApi.setActive();
    markJustActivated(panelInstanceId || panelApi.id || null);
    return true;
  } catch {
    return false;
  }
};

export const activateDockviewPanelFromHost = (hostEl) => {
  if (!hostEl || typeof hostEl.closest !== 'function') return false;
  const shell = hostEl.closest('[data-panel-instance-id]');
  const panelInstanceId = shell?.getAttribute?.('data-panel-instance-id') || null;
  return activateDockviewPanel(panelInstanceId);
};

export default activateDockviewPanel;
