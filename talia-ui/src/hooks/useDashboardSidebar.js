import { useCallback, useEffect, useRef, useState } from "react";
import {
  DASHBOARD_SIDEBAR_STATE_EVENT,
  DASHBOARD_TOGGLE_SIDEBAR_EVENT,
} from "../components/dockview/eventConstants";

const DEFAULT_MIN_WIDTH = 200;
const DEFAULT_MAX_WIDTH = 500;
const DEFAULT_COLLAPSED_WIDTH = "48px";

export const useDashboardSidebar = ({
  initialCollapsed = false,
  initialWidth = 280,
  minWidth = DEFAULT_MIN_WIDTH,
  maxWidth = DEFAULT_MAX_WIDTH,
  autoCloseEnabled = false,
  autoCloseMs = 8000,
  autoClosePaused = false,
} = {}) => {
  const shellRef = useRef(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialCollapsed);
  const [sidebarWidth, setSidebarWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!shellRef.current) return;
    const widthValue = sidebarCollapsed ? DEFAULT_COLLAPSED_WIDTH : `${sidebarWidth}px`;
    shellRef.current.style.setProperty("--dashboard-sidebar-width", widthValue);
  }, [sidebarCollapsed, sidebarWidth]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((previous) => !previous);
  }, []);

  useEffect(() => {
    const handleExternalSidebarToggle = () => {
      toggleSidebar();
    };
    window.addEventListener(DASHBOARD_TOGGLE_SIDEBAR_EVENT, handleExternalSidebarToggle);
    return () => window.removeEventListener(DASHBOARD_TOGGLE_SIDEBAR_EVENT, handleExternalSidebarToggle);
  }, [toggleSidebar]);

  useEffect(() => {
    window.__taliaSidebarCollapsed = sidebarCollapsed;
    window.dispatchEvent(
      new CustomEvent(DASHBOARD_SIDEBAR_STATE_EVENT, {
        detail: { collapsed: sidebarCollapsed },
      })
    );
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (sidebarCollapsed) return undefined;
    if (autoCloseEnabled !== true) return undefined;
    if (autoClosePaused === true) return undefined;
    const timeoutMs = Number.isFinite(Number(autoCloseMs))
      ? Math.min(60000, Math.max(1000, Number(autoCloseMs)))
      : 8000;
    const timer = window.setTimeout(() => {
      setSidebarCollapsed(true);
    }, timeoutMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [sidebarCollapsed, autoCloseEnabled, autoCloseMs, autoClosePaused]);

  const handleMouseDown = useCallback((event) => {
    setIsResizing(true);
    event.preventDefault();
    event.stopPropagation();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback(
    (event) => {
      if (!isResizing) return;
      const newWidth = event.clientX;
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setSidebarWidth(newWidth);
      }
    },
    [isResizing, maxWidth, minWidth]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    if (!isResizing) return undefined;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp, isResizing]);

  useEffect(
    () => () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    },
    []
  );

  return {
    shellRef,
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarWidth,
    setSidebarWidth,
    isResizing,
    toggleSidebar,
    handleMouseDown,
  };
};

export default useDashboardSidebar;
