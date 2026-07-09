import React from "react";
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

const TaliaDockviewTab = ({ reportPanelIds, groupActionPanelIds, maximizeStateToken, ...props }) => {
  const panelApi = props?.api;
  const panelId = panelApi?.id;
  const panelComponent = panelApi?.component;
  const isReportTab = !!panelComponent && reportPanelIds?.has?.(panelComponent);
  const hasGroupActions = !!panelComponent && groupActionPanelIds?.has?.(panelComponent);
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

  const cycleLabel = `Group view level ${groupCycleDepth} of ${groupCycleMaxDepth}`;
  const cycleIcon = groupCycleDepth === 0
    ? '⊟'
    : groupCycleDepth >= groupCycleMaxDepth
      ? '⊠'
      : '⊞';
  const indicatorSymbol = isPaused ? '=' : (isPrimaryActive ? '*' : '0');
  const indicatorTitle = isPaused
    ? 'Panel paused (press P to resume)'
    : (isPrimaryActive ? 'Active panel' : 'Available panel');
  const indicatorClassName = [
    'talia-dv-tab__active-indicator',
    isPaused ? 'talia-dv-tab__active-indicator--paused' : '',
    isPrimaryActive ? 'talia-dv-tab__active-indicator--active' : '',
    !isPaused && !isPrimaryActive ? 'talia-dv-tab__active-indicator--available' : '',
  ].filter(Boolean).join(' ');

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
      <span className={indicatorClassName} title={indicatorTitle} aria-label={indicatorTitle}>
        {indicatorSymbol}
      </span>
      <div className="talia-dv-tab__actions">
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
    </div>
  );
};

export default TaliaDockviewTab;
