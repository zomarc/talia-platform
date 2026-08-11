/**
 * Keep Dockview tab titles aligned with focus-panel registry titles.
 * Layout JSON may hold stale titles after renames; apply on load/save (not continuous).
 */

export const resolveRegistryPanelTitle = (componentId, metadataByPanelId) => {
  if (!componentId || !metadataByPanelId) return null;
  const meta = metadataByPanelId.get(componentId);
  const title = typeof meta?.title === 'string' ? meta.title.trim() : '';
  return title || null;
};

export const applyRegistryTitlesToDockviewLayout = (layout, metadataByPanelId) => {
  if (!layout?.panels || typeof layout.panels !== 'object' || !metadataByPanelId) {
    return layout;
  }

  let changed = false;
  const panels = {};
  Object.entries(layout.panels).forEach(([panelId, panel]) => {
    if (!panel || typeof panel !== 'object') {
      panels[panelId] = panel;
      return;
    }
    const componentId = panel.contentComponent
      || panel.params?.reportId
      || panel.params?.component
      || null;
    const nextTitle = resolveRegistryPanelTitle(componentId, metadataByPanelId);
    if (nextTitle && panel.title !== nextTitle) {
      panels[panelId] = { ...panel, title: nextTitle };
      changed = true;
      return;
    }
    panels[panelId] = panel;
  });

  return changed ? { ...layout, panels } : layout;
};

export const syncOpenDockviewPanelTitles = (api, metadataByPanelId) => {
  const panels = api?.panels;
  if (!Array.isArray(panels) || !metadataByPanelId) return 0;

  let updated = 0;
  panels.forEach((panel) => {
    const componentId = panel?.component || panel?.api?.component || null;
    const nextTitle = resolveRegistryPanelTitle(componentId, metadataByPanelId);
    if (!nextTitle || panel?.title === nextTitle) return;
    if (typeof panel?.api?.setTitle === 'function') {
      panel.api.setTitle(nextTitle);
      updated += 1;
    }
  });
  return updated;
};
