import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';
import { loadUserProfileState, saveUserProfileState } from '../services/data/userProfileState';
import { loadRoleComponentOps } from '../services/data/roleCriteriaService';
import {
  canShowOperationsOptionsMenu,
  filterOperationsForRole,
  getComponentOptionsCatalog,
  resolveOperationEnabled,
  resolveViewValue,
} from '../lib/componentOptionsCatalog';
import { canConfigureComponentOperations } from '../utils/roleUtils';

export const COMPONENT_OPTIONS_CHANGED_EVENT = 'talia:component.optionsChanged';

const PERSIST_DEBOUNCE_MS = 200;

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

  const [viewsState, setViewsState] = useState({});
  const [opsState, setOpsState] = useState({});
  const [roleOpsAllow, setRoleOpsAllow] = useState({});
  const [hydrated, setHydrated] = useState(false);
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
      try {
        const [profile, roleOps] = await Promise.all([
          loadUserProfileState({ component: `Options:${key}` }),
          loadRoleComponentOps(role, { component: `Options:${key}` }),
        ]);
        if (cancelled) return;
        const componentEntry = profile?.componentOptions?.[key] || {};
        setViewsState(componentEntry.views && typeof componentEntry.views === 'object' ? componentEntry.views : {});
        setOpsState(componentEntry.operations && typeof componentEntry.operations === 'object' ? componentEntry.operations : {});
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
      const saved = await saveUserProfileState({
        patch,
        component: `Options:${key}`,
      });
      window.__taliaUserProfileState = {
        ...(window.__taliaUserProfileState || {}),
        ...saved,
        componentOptions: {
          ...(window.__taliaUserProfileState?.componentOptions || {}),
          ...(saved?.componentOptions || {}),
          [key]: {
            views: nextViews,
            operations: nextOps,
          },
        },
      };
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

  const views = useMemo(() => (
    (catalog.views || []).map((def) => ({
      ...def,
      value: resolveViewValue(viewsState, def),
    }))
  ), [catalog.views, viewsState]);

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
