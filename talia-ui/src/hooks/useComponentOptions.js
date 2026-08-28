import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';
import {
  getCachedComponentOptionsEntry,
  loadUserProfileState,
  saveUserProfileState,
} from '../services/data/userProfileState';
import { loadRoleComponentOps } from '../services/data/roleCriteriaService';
import {
  canShowOperationsOptionsMenu,
  filterOperationsForRole,
  filterViewsForRole,
  getComponentOptionsCatalog,
  resolveOperationEnabled,
  resolveViewValue,
} from '../lib/componentOptionsCatalog';
import { COMPONENT_OPTIONS_CHANGED_EVENT } from '../lib/componentOptionsEvents';
import { canConfigureComponentOperations } from '../utils/roleUtils';

export { COMPONENT_OPTIONS_CHANGED_EVENT } from '../lib/componentOptionsEvents';

const PERSIST_DEBOUNCE_MS = 200;

const shallowEqualRecords = (a, b) => {
  const left = a && typeof a === 'object' ? a : {};
  const right = b && typeof b === 'object' ? b : {};
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((k) => left[k] === right[k]);
};

/**
 * User × component Views prefs + role-gated Operations.
 * @param {string} componentId registry panelId
 * @param {object|null} registryOptions optional registry.options override
 */
export function useComponentOptions(componentId, registryOptions = null) {
  const { user } = useSupabaseAuth();
  const role = user?.role || 'USER';
  const key = String(componentId || '');
  const catalog = useMemo(
    () => getComponentOptionsCatalog(key, registryOptions),
    [key, registryOptions]
  );

  const cachedEntry = key ? getCachedComponentOptionsEntry(key) : { views: {}, operations: {} };
  const [viewsState, setViewsState] = useState(() => cachedEntry?.views || {});
  const [opsState, setOpsState] = useState(() => cachedEntry?.operations || {});
  const [roleOpsAllow, setRoleOpsAllow] = useState({});
  // Profile already in cache → first paint can use real prefs (no all-true flash).
  const [hydrated, setHydrated] = useState(() => cachedEntry != null || !key);
  const viewsRef = useRef(viewsState);
  const opsRef = useRef(opsState);
  const persistTimerRef = useRef(null);
  viewsRef.current = viewsState;
  opsRef.current = opsState;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!key) {
        setHydrated(true);
        return;
      }
      // Re-seed if cache arrived between first render and this effect (e.g. StatusBar load).
      const seeded = getCachedComponentOptionsEntry(key);
      if (seeded) {
        setViewsState((prev) => (shallowEqualRecords(prev, seeded.views) ? prev : seeded.views));
        setOpsState((prev) => (shallowEqualRecords(prev, seeded.operations) ? prev : seeded.operations));
        setHydrated(true);
      }
      try {
        const [profile, roleOps] = await Promise.all([
          loadUserProfileState({ component: `Options:${key}` }),
          loadRoleComponentOps(role, { component: `Options:${key}` }),
        ]);
        if (cancelled) return;
        const componentEntry = profile?.componentOptions?.[key] || {};
        const nextViews = componentEntry.views && typeof componentEntry.views === 'object'
          ? componentEntry.views
          : {};
        const nextOps = componentEntry.operations && typeof componentEntry.operations === 'object'
          ? componentEntry.operations
          : {};
        setViewsState((prev) => (shallowEqualRecords(prev, nextViews) ? prev : nextViews));
        setOpsState((prev) => (shallowEqualRecords(prev, nextOps) ? prev : nextOps));
        setRoleOpsAllow(roleOps && typeof roleOps === 'object' ? roleOps : {});
      } catch (error) {
        console.warn('[useComponentOptions] hydrate failed:', error?.message || error);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, role]);

  useEffect(() => {
    const handleChanged = (event) => {
      const detail = event?.detail || {};
      if (String(detail.componentId || '') !== key) return;
      if (detail.views && typeof detail.views === 'object') setViewsState(detail.views);
      if (detail.operations && typeof detail.operations === 'object') setOpsState(detail.operations);
    };
    window.addEventListener(COMPONENT_OPTIONS_CHANGED_EVENT, handleChanged);
    return () => window.removeEventListener(COMPONENT_OPTIONS_CHANGED_EVENT, handleChanged);
  }, [key]);

  useEffect(() => () => {
    if (persistTimerRef.current) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
  }, []);

  const publish = useCallback((nextViews, nextOps) => {
    if (!key) return;
    window.dispatchEvent(new CustomEvent(COMPONENT_OPTIONS_CHANGED_EVENT, {
      detail: { componentId: key, views: nextViews, operations: nextOps },
    }));
  }, [key]);

  const persistNow = useCallback(async (nextViews, nextOps) => {
    if (!key) return;
    const patch = {
      componentOptions: {
        [key]: {
          views: nextViews,
          operations: nextOps,
        },
      },
    };
    try {
      await saveUserProfileState({
        patch,
        component: `Options:${key}`,
      });
    } catch (error) {
      console.warn('[useComponentOptions] save failed:', error?.message || error);
    }
  }, [key]);

  const schedulePersist = useCallback((nextViews, nextOps) => {
    if (!key) return;
    publish(nextViews, nextOps);
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      // Always flush the latest ref values (avoids rapid-toggle races).
      persistNow(viewsRef.current, opsRef.current);
    }, PERSIST_DEBOUNCE_MS);
  }, [key, persistNow, publish]);

  const setView = useCallback((id, value) => {
    setViewsState((prev) => {
      const next = { ...prev, [id]: value };
      viewsRef.current = next;
      schedulePersist(next, opsRef.current);
      return next;
    });
  }, [schedulePersist]);

  const setOperation = useCallback((id, value) => {
    if (!canConfigureComponentOperations(role)) return;
    setOpsState((prev) => {
      const next = { ...prev, [id]: value };
      opsRef.current = next;
      schedulePersist(viewsRef.current, next);
      return next;
    });
  }, [role, schedulePersist]);

  const views = useMemo(() => {
    const allowed = filterViewsForRole(catalog.views, role, roleOpsAllow, key);
    return allowed.map((def) => ({
      ...def,
      value: resolveViewValue(viewsState, def),
    }));
  }, [catalog.views, key, role, roleOpsAllow, viewsState]);

  const operations = useMemo(() => {
    const allowed = filterOperationsForRole(catalog.operations, role, roleOpsAllow, key);
    return allowed.map((def) => ({
      ...def,
      enabled: resolveOperationEnabled(opsState, def, role, roleOpsAllow, key),
    }));
  }, [catalog.operations, key, opsState, role, roleOpsAllow]);

  const showOperationsMenu = canShowOperationsOptionsMenu(role);
  const hasOptions = (views.length > 0) || (showOperationsMenu && operations.length > 0);

  return {
    hydrated,
    role,
    views,
    operations,
    showOperationsMenu,
    hasOptions,
    setView,
    setOperation,
    viewsState,
    opsState,
  };
}

export default useComponentOptions;
