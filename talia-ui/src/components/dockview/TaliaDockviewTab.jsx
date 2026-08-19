import React from "react";
import { createPortal } from "react-dom";
import { DockviewDefaultTab } from "dockview";
import {
  DOCKVIEW_MAXIMIZE_STATE_EVENT,
  REPORT_ACTIVE_PANEL_EVENT,
  REPORT_GROUP_ACTION_EVENT,
  REPORT_PANEL_PAUSE_EVENT,
  REPORT_PANEL_LOADING_EVENT,
  REPORT_PANEL_LAYOUT_CYCLE_EVENT,
  REPORT_PANEL_TECHNICAL_META_EVENT,
} from "./eventConstants";
import {
  resolveTechnicalMetaVisible,
  setPanelTechnicalMetaVisible,
} from "../../services/panelTechnicalMetaState";
import { resolvePanelLoading } from "../../services/panelLoadingState";
import {
  PANEL_DATA_EXPORT_CHANGED_EVENT,
  resolvePanelDataExport,
  runPanelDataExport,
} from "../../lib/panelDataExport";
import { useComponentOptions } from "../../hooks/useComponentOptions";
import { resolveChoiceLabel } from "../../lib/componentOptionsCatalog";
import reportRegistry from "../focus-panels/registry";

const SIDE_EXPAND_DECISION_TIMEOUT_MS = 3000;

const getGroupIdsInSameVisualSide = (dockviewApi, targetGroupId) => {
  const groups = Array.isArray(dockviewApi?.groups) ? dockviewApi.groups : [];
  const visibleGroups = groups.filter((group) => !!group?.api?.isVisible && !!group?.element);
  if (!targetGroupId || visibleGroups.length < 2) return null;

  const targetGroup = visibleGroups.find((group) => group.id === targetGroupId);
  if (!targetGroup) return null;

  const withCenters = visibleGroups
    .map((group) => {
      const rect = group.element.getBoundingClientRect();
      const hasArea = rect.width > 0 && rect.height > 0;
      if (!hasArea) return null;
      return {
        id: group.id,
        centerX: rect.left + rect.width / 2,
      };
    })
    .filter(Boolean);

  if (withCenters.length < 2) return null;

  const minX = Math.min(...withCenters.map((entry) => entry.centerX));
  const maxX = Math.max(...withCenters.map((entry) => entry.centerX));
  const sideDivider = minX + (maxX - minX) / 2;
  const targetEntry = withCenters.find((entry) => entry.id === targetGroupId);
  if (!targetEntry) return null;

  const targetIsLeft = targetEntry.centerX <= sideDivider;
  return new Set(
    withCenters
      .filter((entry) => (targetIsLeft ? entry.centerX <= sideDivider : entry.centerX > sideDivider))
      .map((entry) => entry.id)
  );
};

const TaliaDockviewTab = ({
  reportPanelIds,
  groupActionPanelIds,
  dataExportPanelIds,
  maximizeStateToken,
  ...props
}) => {
  const panelApi = props?.api;
  const panelId = panelApi?.id;
  const panelComponent = panelApi?.component;
  const isReportTab = !!panelComponent && reportPanelIds?.has?.(panelComponent);
  const hasGroupActions = !!panelComponent && groupActionPanelIds?.has?.(panelComponent);
  const [exportRegistered, setExportRegistered] = React.useState(
    () => Boolean(resolvePanelDataExport(panelId, panelComponent))
  );
  React.useEffect(() => {
    const sync = () => setExportRegistered(Boolean(resolvePanelDataExport(panelId, panelComponent)));
    sync();
    window.addEventListener(PANEL_DATA_EXPORT_CHANGED_EVENT, sync);
    return () => window.removeEventListener(PANEL_DATA_EXPORT_CHANGED_EVENT, sync);
  }, [panelId, panelComponent]);
  const hasDataExport = Boolean(
    (panelComponent && dataExportPanelIds?.has?.(panelComponent))
    || exportRegistered
  );
  const registryEntry = reportRegistry?.[panelComponent]
    || Object.values(reportRegistry || {}).find((entry) => entry?.panelId === panelComponent)
    || null;
  const registryOptions = registryEntry?.options || null;
  const componentOptionsId = registryEntry?.panelId || panelComponent || '';
  const {
    views: optionViews,
    operations: optionOperations,
    showOperationsMenu,
    hasOptions,
    setView,
    setOperation,
  } = useComponentOptions(isReportTab ? componentOptionsId : '', registryOptions);
  const [showOptionsMenu, setShowOptionsMenu] = React.useState(false);
  const optionsButtonRef = React.useRef(null);
  const optionsMenuRef = React.useRef(null);
  const optionsLeaveTimerRef = React.useRef(null);
  /** After a Views/Ops toggle, dismiss on pointer leave (not on the click itself). */
  const optionsCloseOnLeaveRef = React.useRef(false);
  const [optionsMenuPos, setOptionsMenuPos] = React.useState(null);
  const [_isMaximized, setIsMaximized] = React.useState(() => panelApi?.isMaximized?.() ?? false);
  const [layoutCycleState, setLayoutCycleState] = React.useState(0); // 0: original, 1: side-expand window, 2: full-expand, 3: side-expand restore
  const layoutCycleRef = React.useRef({
    originalVisibility: null,
    panelId: null,
  });
  const sideExpandTimerRef = React.useRef(null);
  const [groupCycleDepth, setGroupCycleDepth] = React.useState(0);
  const [groupCycleMaxDepth, setGroupCycleMaxDepth] = React.useState(2);
  const layoutGlyph = layoutCycleState === 0 ? "↑" : layoutCycleState === 1 ? "↔" : "↓";
  const layoutTitle =
    layoutCycleState === 0
      ? "Expand panel in current side"
      : layoutCycleState === 1
        ? "Expand panel to full width (or wait to restore)"
        : "Collapse to original layout";
  const layoutButtonClassName = [
    "talia-dv-tab__button",
    "talia-dv-tab__button--layout",
    layoutCycleState === 1 ? "talia-dv-tab__button--layout-side-active" : "",
    layoutCycleState === 2 || layoutCycleState === 3 ? "talia-dv-tab__button--layout-restore" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const [showCloseConfirm, setShowCloseConfirm] = React.useState(false);
  const [showExportMenu, setShowExportMenu] = React.useState(false);
  const [exportMenuPos, setExportMenuPos] = React.useState(null);
  const exportMenuRef = React.useRef(null);
  const exportButtonRef = React.useRef(null);
  const [isPrimaryActive, setIsPrimaryActive] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(() => resolvePanelLoading(panelId, panelComponent));
  const reportLayoutFailure = React.useCallback((reason, extra = null) => {
    const message = String(reason || '').trim() || 'Layout action failed.';
    console.error(`[TaliaDockviewTab] ${message}`, extra || '');
    try {
      window.__taliaStatus?.setStatusMessage?.(`Error: ${message}`);
    } catch {
      // Avoid secondary failures while reporting an action error.
    }
  }, []);

  const syncPrimaryActiveState = React.useCallback(() => {
    const activePanelId = window?.__taliaActivePanelId || window?.dockviewApi?.activePanel?.id || null;
    if (activePanelId) {
      setIsPrimaryActive(activePanelId === panelId);
      return;
    }
    const panelIsActive =
      typeof panelApi?.isActive === 'function'
        ? panelApi.isActive()
        : (panelApi?.isActive === true);
    setIsPrimaryActive(Boolean(panelIsActive));
  }, [panelApi, panelId]);

  const syncMaximizedState = React.useCallback(() => {
    const currentlyMaximized = panelApi?.isMaximized?.() ?? false;
    setIsMaximized(currentlyMaximized);
  }, [panelApi]);

  const syncPausedState = React.useCallback(() => {
    const state = window.__taliaPanelPauseState || {};
    if (panelId && Object.prototype.hasOwnProperty.call(state, panelId)) {
      setIsPaused(state[panelId] === true);
      return;
    }
    if (panelComponent && Object.prototype.hasOwnProperty.call(state, panelComponent)) {
      setIsPaused(state[panelComponent] === true);
      return;
    }
    setIsPaused(false);
  }, [panelId, panelComponent]);

  const syncLoadingState = React.useCallback(() => {
    setIsLoading(resolvePanelLoading(panelId, panelComponent));
  }, [panelId, panelComponent]);

  // Keep tab icon/tooltip synced with Dockview maximize state.
  React.useEffect(() => {
    syncMaximizedState();
  }, [syncMaximizedState, maximizeStateToken]);

  React.useEffect(() => {
    const handleMaximizeStateChanged = () => syncMaximizedState();
    window.addEventListener(DOCKVIEW_MAXIMIZE_STATE_EVENT, handleMaximizeStateChanged);
    return () => {
      window.removeEventListener(DOCKVIEW_MAXIMIZE_STATE_EVENT, handleMaximizeStateChanged);
    };
  }, [syncMaximizedState]);

  React.useEffect(() => {
    syncPrimaryActiveState();
    syncPausedState();
    syncLoadingState();
    const handleActivePanelChanged = () => syncPrimaryActiveState();
    const handlePauseStateChanged = () => syncPausedState();
    const handleLoadingStateChanged = (event) => {
      const detail = event?.detail || {};
      const targetPanelId = detail.panelInstanceId || null;
      const targetPanelComponent = detail.panelComponentId || null;
      const isMatch = targetPanelId
        ? panelId === targetPanelId
        : !!(targetPanelComponent && panelComponent === targetPanelComponent);
      if (!isMatch) return;
      setIsLoading(detail.loading === true);
    };
    window.addEventListener(REPORT_ACTIVE_PANEL_EVENT, handleActivePanelChanged);
    window.addEventListener(REPORT_PANEL_PAUSE_EVENT, handlePauseStateChanged);
    window.addEventListener(REPORT_PANEL_LOADING_EVENT, handleLoadingStateChanged);
    window.addEventListener("pointerup", handleActivePanelChanged);
    return () => {
      window.removeEventListener(REPORT_ACTIVE_PANEL_EVENT, handleActivePanelChanged);
      window.removeEventListener(REPORT_PANEL_PAUSE_EVENT, handlePauseStateChanged);
      window.removeEventListener(REPORT_PANEL_LOADING_EVENT, handleLoadingStateChanged);
      window.removeEventListener("pointerup", handleActivePanelChanged);
    };
  }, [syncLoadingState, syncPausedState, syncPrimaryActiveState, panelComponent, panelId]);
  React.useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setShowCloseConfirm(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  React.useEffect(() => {
    return () => {
      if (sideExpandTimerRef.current) {
        window.clearTimeout(sideExpandTimerRef.current);
        sideExpandTimerRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    if (!hasGroupActions) return;
    const syncGroupCycleState = () => {
      const registeredActions = window.__taliaPanelGroupActions || {};
      const panelActions =
        registeredActions[panelId] ||
        (panelComponent ? registeredActions[panelComponent] : null);
      const cycleState = panelActions?.getCycleState?.();
      if (!cycleState) return false;
      if (typeof cycleState.depth === 'number') {
        setGroupCycleDepth(cycleState.depth);
      }
      if (typeof cycleState.maxDepth === 'number' && cycleState.maxDepth > 0) {
        setGroupCycleMaxDepth(cycleState.maxDepth);
      }
      return true;
    };

    const syncedImmediately = syncGroupCycleState();
    if (syncedImmediately) return;
    const timer = window.setTimeout(() => {
      syncGroupCycleState();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [hasGroupActions, panelComponent, panelId, maximizeStateToken]);

  const handlePrimaryAction = (event) => {
    event.stopPropagation();
    setShowCloseConfirm((prev) => !prev);
  };

  const handleLayoutToggle = (event) => {
    event.stopPropagation();
    setShowCloseConfirm(false);

    const dockviewApi = window.dockviewApi;
    const targetPanelId = panelId;
    if (!dockviewApi) {
      reportLayoutFailure('Layout action failed: Dockview API is not available.');
      return;
    }
    if (!targetPanelId) {
      reportLayoutFailure('Layout action failed: panel id is unavailable.');
      return;
    }
    const currentPanelApi = dockviewApi?.getPanel?.(targetPanelId)?.api;
    if (!currentPanelApi) {
      reportLayoutFailure(`Layout action failed: panel "${targetPanelId}" is not available.`);
      return;
    }
    currentPanelApi?.setActive?.();
    const currentGroupId = currentPanelApi?.group?.id;

    if (layoutCycleState === 0) {
      if (sideExpandTimerRef.current) {
        window.clearTimeout(sideExpandTimerRef.current);
        sideExpandTimerRef.current = null;
      }
      const sideGroupIds = getGroupIdsInSameVisualSide(dockviewApi, currentGroupId);
      if (sideGroupIds && sideGroupIds.size > 0) {
        const visibilitySnapshot = {};
        (dockviewApi?.groups || []).forEach((group) => {
          visibilitySnapshot[group.id] = !!group?.api?.isVisible;
        });
        layoutCycleRef.current.originalVisibility = visibilitySnapshot;
        layoutCycleRef.current.panelId = targetPanelId;
        (dockviewApi?.groups || []).forEach((group) => {
          if (sideGroupIds.has(group.id)) {
            // First step: isolate selected panel within its current left/right side container.
            group?.api?.setVisible?.(group.id === currentGroupId);
            return;
          }
          // Keep the opposite side unchanged.
          const originalVisible = visibilitySnapshot[group.id];
          group?.api?.setVisible?.(typeof originalVisible === 'boolean' ? originalVisible : true);
        });
        currentPanelApi?.setActive?.();
        setLayoutCycleState(1);
        sideExpandTimerRef.current = window.setTimeout(() => {
          setLayoutCycleState((previous) => (previous === 1 ? 3 : previous));
          sideExpandTimerRef.current = null;
        }, SIDE_EXPAND_DECISION_TIMEOUT_MS);
      } else {
        // Only one visible group, stacked layout, or geometry not split left/right (e.g. Admin full width):
        // side isolation is impossible — use Dockview maximize directly instead of an error banner.
        layoutCycleRef.current.originalVisibility = null;
        layoutCycleRef.current.panelId = targetPanelId;
        if (dockviewApi?.hasMaximizedGroup?.() && !currentPanelApi?.isMaximized?.()) {
          dockviewApi?.exitMaximizedGroup?.();
        }
        if (!currentPanelApi?.isMaximized?.()) {
          currentPanelApi?.maximize?.();
        }
        setLayoutCycleState(2);
      }
    } else if (layoutCycleState === 1) {
      if (sideExpandTimerRef.current) {
        window.clearTimeout(sideExpandTimerRef.current);
        sideExpandTimerRef.current = null;
      }
      const targetPanelApi =
        (layoutCycleRef.current.panelId ? dockviewApi?.getPanel?.(layoutCycleRef.current.panelId)?.api : null)
        || dockviewApi?.getPanel?.(targetPanelId)?.api;
      if (!targetPanelApi) {
        reportLayoutFailure(`Layout action failed: cannot resolve panel "${targetPanelId}" for maximize.`);
        return;
      }
      targetPanelApi?.setActive?.();
      if (dockviewApi?.hasMaximizedGroup?.() && !targetPanelApi?.isMaximized?.()) {
        dockviewApi?.exitMaximizedGroup?.();
      }
      if (!targetPanelApi?.isMaximized?.()) {
        targetPanelApi?.maximize?.();
      }
      layoutCycleRef.current.panelId = targetPanelId;
      setLayoutCycleState(2);
    } else {
      if (sideExpandTimerRef.current) {
        window.clearTimeout(sideExpandTimerRef.current);
        sideExpandTimerRef.current = null;
      }
      const targetPanelApi =
        (layoutCycleRef.current.panelId ? dockviewApi?.getPanel?.(layoutCycleRef.current.panelId)?.api : null)
        || dockviewApi?.getPanel?.(targetPanelId)?.api;
      if (!targetPanelApi) {
        reportLayoutFailure(`Layout action failed: cannot resolve panel "${targetPanelId}" for restore.`);
        return;
      }
      if (targetPanelApi?.isMaximized?.()) {
        targetPanelApi?.exitMaximized?.();
      }
      if (dockviewApi?.hasMaximizedGroup?.()) {
        dockviewApi?.exitMaximizedGroup?.();
      }
      const originalVisibility = layoutCycleRef.current.originalVisibility;
      if (originalVisibility && typeof originalVisibility === 'object') {
        (dockviewApi?.groups || []).forEach((group) => {
          const previousValue = originalVisibility[group.id];
          group?.api?.setVisible?.(typeof previousValue === 'boolean' ? previousValue : true);
        });
      }
      const cyclePanelId = layoutCycleRef.current.panelId || targetPanelId;
      const restoredPanel = cyclePanelId ? dockviewApi?.getPanel?.(cyclePanelId)?.api : null;
      restoredPanel?.setActive?.();

      layoutCycleRef.current.originalVisibility = null;
      layoutCycleRef.current.panelId = null;
      setLayoutCycleState(0);
    }

    setIsMaximized(currentPanelApi?.isMaximized?.() ?? false);
    window.dispatchEvent(new CustomEvent(DOCKVIEW_MAXIMIZE_STATE_EVENT));
    window.requestAnimationFrame(syncMaximizedState);
  };

  const handleLayoutToggleRef = React.useRef(handleLayoutToggle);
  handleLayoutToggleRef.current = handleLayoutToggle;

  React.useEffect(() => {
    const onLayoutCycleRequest = (event) => {
      const targetId = event?.detail?.panelId || null;
      if (!targetId || targetId !== panelId) return;
      handleLayoutToggleRef.current({ stopPropagation: () => {} });
    };
    window.addEventListener(REPORT_PANEL_LAYOUT_CYCLE_EVENT, onLayoutCycleRequest);
    return () => window.removeEventListener(REPORT_PANEL_LAYOUT_CYCLE_EVENT, onLayoutCycleRequest);
  }, [panelId]);

  const handleConfirmClose = (event) => {
    event.stopPropagation();
    setShowCloseConfirm(false);
    panelApi?.close?.();
  };

  const handleCancelClose = (event) => {
    event.stopPropagation();
    setShowCloseConfirm(false);
  };

  /** Tab ⓘ — technical / dev panel info only (not user data tables; those use header ≣). */
  const handleToggleTechnicalMeta = (event) => {
    event.stopPropagation();
    if (!panelId && !panelComponent) return;
    const current = resolveTechnicalMetaVisible(panelId, panelComponent);
    const nextVisible = !current;
    setPanelTechnicalMetaVisible(panelId, panelComponent, nextVisible);
    window.dispatchEvent(
      new CustomEvent(REPORT_PANEL_TECHNICAL_META_EVENT, {
        detail: {
          panelId,
          panelComponent,
          visible: nextVisible,
        },
      })
    );
  };

  const handleGroupAction = (action) => (event) => {
    event.stopPropagation();
    if (!panelId) return;
    const registeredActions = window.__taliaPanelGroupActions || {};
    const panelActions =
      registeredActions[panelId] ||
      (panelComponent ? registeredActions[panelComponent] : null);
    if (panelActions) {
      if (action === 'cycle') {
        const nextDepth = panelActions.cycle?.();
        const cycleState = panelActions.getCycleState?.();
        if (typeof nextDepth === 'number') {
          setGroupCycleDepth(nextDepth);
        } else if (typeof cycleState?.depth === 'number') {
          setGroupCycleDepth(cycleState.depth);
        }
        if (typeof cycleState?.maxDepth === 'number' && cycleState.maxDepth > 0) {
          setGroupCycleMaxDepth(cycleState.maxDepth);
        }
      } else if (action === 'openAll') {
        panelActions.openAll?.();
      } else if (action === 'collapseAll') {
        panelActions.collapseAll?.();
      }
      return;
    }
    const groupActionEvent = new CustomEvent(REPORT_GROUP_ACTION_EVENT, {
      detail: { panelId, panelComponent, action },
    });
    window.dispatchEvent(groupActionEvent);
    document.dispatchEvent(
      new CustomEvent(REPORT_GROUP_ACTION_EVENT, {
        detail: { panelId, panelComponent, action },
      })
    );
  };

  React.useEffect(() => {
    if (!showExportMenu) return undefined;
    const onPointerDown = (event) => {
      const menu = exportMenuRef.current;
      const button = exportButtonRef.current;
      if (menu?.contains?.(event.target) || button?.contains?.(event.target)) return;
      setShowExportMenu(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setShowExportMenu(false);
    };
    const onResize = () => setShowExportMenu(false);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [showExportMenu]);

  React.useEffect(() => {
    if (!showOptionsMenu) return undefined;
    const onPointerDown = (event) => {
      const menu = optionsMenuRef.current;
      const button = optionsButtonRef.current;
      if (menu?.contains?.(event.target) || button?.contains?.(event.target)) return;
      optionsCloseOnLeaveRef.current = false;
      setShowOptionsMenu(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        optionsCloseOnLeaveRef.current = false;
        setShowOptionsMenu(false);
      }
    };
    const onResize = () => {
      optionsCloseOnLeaveRef.current = false;
      setShowOptionsMenu(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [showOptionsMenu]);

  React.useEffect(() => () => {
    if (optionsLeaveTimerRef.current) {
      window.clearTimeout(optionsLeaveTimerRef.current);
      optionsLeaveTimerRef.current = null;
    }
  }, []);

  const cancelOptionsLeaveClose = React.useCallback(() => {
    if (optionsLeaveTimerRef.current) {
      window.clearTimeout(optionsLeaveTimerRef.current);
      optionsLeaveTimerRef.current = null;
    }
  }, []);

  const scheduleOptionsLeaveClose = React.useCallback(() => {
    if (!optionsCloseOnLeaveRef.current) return;
    cancelOptionsLeaveClose();
    optionsLeaveTimerRef.current = window.setTimeout(() => {
      optionsLeaveTimerRef.current = null;
      if (!optionsCloseOnLeaveRef.current) return;
      optionsCloseOnLeaveRef.current = false;
      setShowOptionsMenu(false);
    }, 120);
  }, [cancelOptionsLeaveClose]);

  const armOptionsCloseOnLeave = React.useCallback(() => {
    optionsCloseOnLeaveRef.current = true;
  }, []);

  React.useEffect(() => {
    if (!isPrimaryActive) {
      setShowExportMenu(false);
      optionsCloseOnLeaveRef.current = false;
      cancelOptionsLeaveClose();
      setShowOptionsMenu(false);
      setShowCloseConfirm(false);
    }
  }, [isPrimaryActive, cancelOptionsLeaveClose]);

  const handleToggleExportMenu = (event) => {
    event.stopPropagation();
    const button = event.currentTarget;
    const rect = button?.getBoundingClientRect?.();
    setShowOptionsMenu(false);
    setShowExportMenu((open) => {
      if (open) return false;
      if (rect) {
        setExportMenuPos({
          top: Math.round(rect.bottom + 4),
          left: Math.round(Math.max(8, rect.right - 88)),
        });
      }
      return true;
    });
  };

  const handleToggleOptionsMenu = (event) => {
    event.stopPropagation();
    const button = event.currentTarget;
    const rect = button?.getBoundingClientRect?.();
    setShowExportMenu(false);
    cancelOptionsLeaveClose();
    setShowOptionsMenu((open) => {
      if (open) {
        optionsCloseOnLeaveRef.current = false;
        return false;
      }
      optionsCloseOnLeaveRef.current = false;
      if (rect) {
        setOptionsMenuPos({
          top: Math.round(rect.bottom + 4),
          left: Math.round(Math.max(8, rect.right - 180)),
        });
      }
      return true;
    });
  };

  const handleExportFormat = (format) => (event) => {
    event.stopPropagation();
    setShowExportMenu(false);
    const registered = resolvePanelDataExport(panelId, panelComponent);
    if (!registered?.getPayload) {
      try {
        window.__taliaStatus?.setStatusMessage?.('Nothing to export');
      } catch { /* noop */ }
      return;
    }
    try {
      runPanelDataExport(format, registered.getPayload);
      try {
          window.__taliaStatus?.setStatusMessage?.(
          format === 'pdf' ? 'Opening print dialog…' : 'Exported to CSV'
        );
      } catch { /* noop */ }
    } catch (err) {
      const message = err?.message || 'Export failed';
      console.error('[TaliaDockviewTab] export failed', err);
      try {
        window.__taliaStatus?.setStatusMessage?.(`Error: ${message}`);
      } catch { /* noop */ }
    }
  };

  const cycleLabel = `Group view level ${groupCycleDepth} of ${groupCycleMaxDepth}`;
  const cycleIcon = groupCycleDepth === 0
    ? '⊟'
    : groupCycleDepth >= groupCycleMaxDepth
      ? '⊠'
      : '⊞';

  return (
    <div className={`talia-dv-tab ${isPrimaryActive ? "talia-dv-tab--primary-active" : ""} ${isLoading ? "talia-dv-tab--loading" : ""}`}>
      <DockviewDefaultTab {...props} hideClose />
      {isLoading && (
        <span
          className="talia-dv-tab__loading-indicator"
          title="Loading data"
          aria-label="Loading data"
        />
      )}
      {isPaused && (
        <span
          className="talia-dv-tab__active-indicator talia-dv-tab__active-indicator--paused"
          title="Panel paused (press P to resume)"
          aria-label="Panel paused (press P to resume)"
        >
          =
        </span>
      )}
      {isPrimaryActive && (
      <div className="talia-dv-tab__actions">
            {isReportTab && hasOptions && (
              <div className="talia-dv-tab__export">
                <button
                  ref={optionsButtonRef}
                  type="button"
                  className="talia-dv-tab__button talia-dv-tab__button--options"
                  title="Panel Options (Views / Operations)"
                  aria-label="Panel Options"
                  aria-expanded={showOptionsMenu}
                  aria-haspopup="menu"
                  onClick={handleToggleOptionsMenu}
                  onMouseEnter={cancelOptionsLeaveClose}
                  onMouseLeave={scheduleOptionsLeaveClose}
                >
                  ⚙
                </button>
                {showOptionsMenu && optionsMenuPos && createPortal(
                  <div
                    ref={optionsMenuRef}
                    className="talia-dv-tab__export-menu talia-dv-tab__export-menu--portal talia-dv-tab__options-menu"
                    role="menu"
                    aria-label="Panel options"
                    style={{ top: optionsMenuPos.top, left: optionsMenuPos.left, minWidth: 180 }}
                    onMouseEnter={cancelOptionsLeaveClose}
                    onMouseLeave={scheduleOptionsLeaveClose}
                  >
                    {optionViews.length > 0 && (
                      <>
                        <div className="talia-dv-tab__options-heading">Views</div>
                        {optionViews.map((entry) => {
                          const isChoice = entry.type === 'choice';
                          const checked = isChoice
                            ? true
                            : entry.value === true;
                          const onToggle = () => {
                            if (entry.type === 'choice' && Array.isArray(entry.choices) && entry.choices.length >= 2) {
                              const idx = entry.choices.indexOf(entry.value);
                              const next = entry.choices[((idx < 0 ? 0 : idx) + 1) % entry.choices.length];
                              setView(entry.id, next);
                              armOptionsCloseOnLeave();
                              return;
                            }
                            setView(entry.id, !entry.value);
                            armOptionsCloseOnLeave();
                          };
                          const label = entry.type === 'choice'
                            ? resolveChoiceLabel(entry, entry.value)
                            : entry.label;
                          return (
                            <button
                              key={`view-${entry.id}`}
                              type="button"
                              className={`talia-dv-tab__export-menu-item${isChoice ? ' talia-dv-tab__export-menu-item--choice' : ' talia-dv-tab__export-menu-item--toggle'}`}
                              role={isChoice ? 'menuitem' : 'menuitemcheckbox'}
                              aria-checked={isChoice ? undefined : Boolean(checked)}
                              onClick={(event) => {
                                event.stopPropagation();
                                onToggle();
                              }}
                            >
                              <span>{label}</span>
                              {isChoice ? (
                                <span className="talia-dv-tab__option-cycle" aria-hidden="true">⇄</span>
                              ) : (
                                <span
                                  className={`talia-dv-tab__option-switch${checked ? ' talia-dv-tab__option-switch--on' : ''}`}
                                  aria-hidden="true"
                                />
                              )}
                            </button>
                          );
                        })}
                      </>
                    )}
                    {showOperationsMenu && optionOperations.length > 0 && (
                      <>
                        <div className="talia-dv-tab__options-heading">Operations</div>
                        {optionOperations.map((entry) => (
                          <button
                            key={`op-${entry.id}`}
                            type="button"
                            className="talia-dv-tab__export-menu-item talia-dv-tab__export-menu-item--toggle"
                            role="menuitemcheckbox"
                            aria-checked={entry.enabled === true}
                            onClick={(event) => {
                              event.stopPropagation();
                              setOperation(entry.id, !entry.enabled);
                              armOptionsCloseOnLeave();
                            }}
                          >
                            <span>{entry.label}</span>
                            <span
                              className={`talia-dv-tab__option-switch${entry.enabled ? ' talia-dv-tab__option-switch--on' : ''}`}
                              aria-hidden="true"
                            />
                          </button>
                        ))}
                      </>
                    )}
                  </div>,
                  document.body
                )}
              </div>
            )}
            {isReportTab && (
              <button
                type="button"
                className="talia-dv-tab__button talia-dv-tab__button--technical"
                title="Technical info (events, sources) — dev/admin; not the same as header data details"
                aria-label="Toggle technical panel information"
                onClick={handleToggleTechnicalMeta}
              >
                ⓘ
              </button>
            )}
            {hasDataExport && (
              <div className="talia-dv-tab__export">
                <button
                  ref={exportButtonRef}
                  type="button"
                  className="talia-dv-tab__button talia-dv-tab__button--export"
                  title="Export to CSV or PDF"
                  aria-label="Export to CSV or PDF"
                  aria-expanded={showExportMenu}
                  aria-haspopup="menu"
                  onClick={handleToggleExportMenu}
                >
                  ⬇
                </button>
                {showExportMenu && exportMenuPos && createPortal(
                  <div
                    ref={exportMenuRef}
                    className="talia-dv-tab__export-menu talia-dv-tab__export-menu--portal"
                    role="menu"
                    aria-label="Export to"
                    style={{ top: exportMenuPos.top, left: exportMenuPos.left }}
                  >
                    <button
                      type="button"
                      className="talia-dv-tab__export-menu-item"
                      role="menuitem"
                      onClick={handleExportFormat('csv')}
                    >
                      Export to CSV
                    </button>
                    <button
                      type="button"
                      className="talia-dv-tab__export-menu-item"
                      role="menuitem"
                      onClick={handleExportFormat('pdf')}
                    >
                      Export to PDF
                    </button>
                  </div>,
                  document.body
                )}
              </div>
            )}
            {hasGroupActions && (
              <button
                type="button"
                className="talia-dv-tab__button talia-dv-tab__button--group"
                title={`${cycleLabel} (click to cycle)`}
                aria-label={`${cycleLabel}. Click to cycle group expansion.`}
                onClick={handleGroupAction('cycle')}
              >
                {cycleIcon}
              </button>
            )}
            <button
              type="button"
              className={layoutButtonClassName}
              title={layoutTitle}
              aria-label={layoutTitle}
              onClick={handleLayoutToggle}
              onDoubleClick={(event) => event.stopPropagation()}
            >
              {layoutGlyph}
            </button>
            <button
              type="button"
              className="talia-dv-tab__button talia-dv-tab__button--primary"
              title="Close tab"
              aria-label="Close tab"
              onClick={handlePrimaryAction}
              onDoubleClick={(event) => event.stopPropagation()}
            >
              X
            </button>
            {showCloseConfirm && (
              <div className="talia-dv-tab__inline-confirm" role="group" aria-label="Confirm close panel">
                <button
                  type="button"
                  className="talia-dv-tab__confirm-btn talia-dv-tab__confirm-btn--danger"
                  onClick={handleConfirmClose}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className="talia-dv-tab__confirm-btn"
                  onClick={handleCancelClose}
                >
                  No
                </button>
              </div>
            )}
      </div>
      )}
    </div>
  );
};

export default TaliaDockviewTab;
