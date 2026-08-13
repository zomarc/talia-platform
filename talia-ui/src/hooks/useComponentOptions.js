import { useCallback, useEffect, useMemo, useState } from 'react';
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

  const publish = useCallback((nextViews, nextOps) => {
    if (!key) return;
    window.dispatchEvent(new CustomEvent(COMPONENT_OPTIONS_CHANGED_EVENT, {
      detail: { componentId: key, views: nextViews, operations: nextOps },
    }));
  }, [key]);

  const persist = useCallback(async (nextViews, nextOps) => {
    if (!key) return;
    publish(nextViews, nextOps);
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
        },
      };
    } catch (error) {
      console.warn('[useComponentOptions] save failed:', error?.message || error);
    }
  }, [key, publish]);

  const setView = useCallback((id, value) => {
    setViewsState((prev) => {
      const next = { ...prev, [id]: value };
      persist(next, opsState);
      return next;
    });
  }, [opsState, persist]);

  const setOperation = useCallback((id, value) => {
    if (!canConfigureComponentOperations(role)) return;
    setOpsState((prev) => {
      const next = { ...prev, [id]: value };
      persist(viewsState, next);
      return next;
    });
  }, [persist, role, viewsState]);

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
