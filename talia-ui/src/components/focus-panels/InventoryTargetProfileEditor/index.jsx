/**
 * Target Profile Editor — two modes in one panel:
 * This sailing = assign/replace the voyage's active target.
 * Library = name and edit reusable standard profiles.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useGlobalDateWindow } from '../../../hooks/useGlobalDateWindow';
import { useGlobalDepartureMonth } from '../../../hooks/useGlobalDepartureMonth';
import { resolveEffectiveCriteriaDateWindow } from '../../../lib/globalCriteriaDateWindow';
import {
  SAIL_SELECT_EVENT,
  SAIL_CLEAR_EVENT,
  extractSailCodeFromEvent,
} from '../../../lib/eventBus';
import { resolveSelectionScope } from '../../../lib/inventoryReference';
import inventoryProfileSeriesService from '../../../services/data/inventoryProfileSeriesService';
import inventoryTargetProfileService from '../../../services/data/inventoryTargetProfileService';
import profileCompareService from '../../../services/data/profileCompareService';
import LoadingSpinner from '../../shared/LoadingSpinner';
import InventoryTargetProfilePresenter from './InventoryTargetProfilePresenter';
import { buildSuggestedTargetDraft } from './suggestTargetProfile';
import { REPORT_REFRESH_EVENT } from '../../dockview/eventConstants';

const resolveSailMeta = (detail) => {
  const scope = detail?.canonical_scope || (() => {
    try {
      return resolveSelectionScope(detail);
    } catch {
      return null;
    }
  })();
  const sailCode =
    scope?.reference_sail_code ||
    scope?.sail_codes?.[0] ||
    extractSailCodeFromEvent(detail);
  return {
    sailCode: sailCode || null,
    referenceSailCode: scope?.reference_sail_code || sailCode || null,
    shipCode: scope?.ship_code || detail?.ship_code || detail?.row_data?.ship_code || null,
    shipName: scope?.ship_name || detail?.ship_name || detail?.row_data?.ship_name || null,
  };
};

const InventoryTargetProfileEditorContainer = ({
  panelInstanceId,
  panelComponentId,
  ...props
}) => {
  const { params = {}, theme } = props;
  const [mode, setMode] = useState(params.sailCode ? 'sailing' : 'library');
  const [sailCode, setSailCode] = useState(params.sailCode || null);
  const [selectionMeta, setSelectionMeta] = useState({
    referenceSailCode: params.sailCode || null,
    shipCode: null,
    shipName: null,
  });
  const [inventoryItemId, setInventoryItemId] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [libraryProfiles, setLibraryProfiles] = useState([]);
  const [suggestedDraft, setSuggestedDraft] = useState(null);
  const [overlaySeries, setOverlaySeries] = useState({ real: [], model: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillResult, setBackfillResult] = useState(null);
  const { dateFrom, dateTo } = useGlobalDateWindow();
  const departureMonth = useGlobalDepartureMonth();
  const horizon = useMemo(
    () => resolveEffectiveCriteriaDateWindow({ dateFrom, dateTo, departureMonth }),
    [dateFrom, dateTo, departureMonth]
  );

  useEffect(() => {
    const onSelect = (e) => {
      const meta = resolveSailMeta(e?.detail);
      if (meta.sailCode) {
        setSailCode(meta.sailCode);
        setSelectionMeta({
          referenceSailCode: meta.referenceSailCode,
          shipCode: meta.shipCode,
          shipName: meta.shipName,
        });
        setMode('sailing');
      }
    };
    const onClear = () => {
      setSailCode(null);
      setSelectionMeta({ referenceSailCode: null, shipCode: null, shipName: null });
      setInventoryItemId(null);
      setProfiles([]);
      setSuggestedDraft(null);
      setOverlaySeries({ real: [], model: [] });
      setError(null);
      setMode('library');
    };
    window.addEventListener(SAIL_SELECT_EVENT, onSelect);
    window.addEventListener(SAIL_CLEAR_EVENT, onClear);
    return () => {
      window.removeEventListener(SAIL_SELECT_EVENT, onSelect);
      window.removeEventListener(SAIL_CLEAR_EVENT, onClear);
    };
  }, []);

  const loadLibrary = async () => {
    try {
      const library = await inventoryTargetProfileService.listLibrary();
      setLibraryProfiles(Array.isArray(library) ? library : []);
    } catch (err) {
      console.warn('[Target Profile Editor] library:', err?.message || err);
      setLibraryProfiles([]);
    }
  };

  const loadSuggestion = async (code) => {
    try {
      const compare = await profileCompareService.fetchCompare(code, {
        includeBudget: false,
        includeTarget: true,
      });
      setOverlaySeries({
        real: compare?.real?.series || [],
        model: compare?.model?.series || [],
      });
      return buildSuggestedTargetDraft({
        modelSeries: compare?.model?.series || [],
        realSeries: compare?.real?.series || [],
        modelSailCode: compare?.modelSailCode || compare?.model?.sailCode || null,
        peerSource: compare?.peerSource || null,
      });
    } catch (err) {
      console.warn('[Target Profile Editor] suggestion:', err?.message || err);
      return null;
    }
  };

  const loadSailing = async () => {
    if (!sailCode) return;
    setLoading(true);
    setError(null);
    setSuggestedDraft(null);
    try {
      const item = await inventoryProfileSeriesService.findInventoryItemBySailCode(sailCode);
      setInventoryItemId(item?.id || null);
      const list = item?.id ? await inventoryTargetProfileService.list(item.id) : [];
      setProfiles(Array.isArray(list) ? list : []);
      const suggestion = await loadSuggestion(sailCode);
      if (!list?.length) setSuggestedDraft(suggestion);
      else setSuggestedDraft(suggestion);
    } catch (err) {
      console.warn('[Target Profile Editor] load:', err?.message || err);
      setError(err);
      setProfiles([]);
      setInventoryItemId(null);
      const suggestion = await loadSuggestion(sailCode);
      setSuggestedDraft(suggestion);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLibrary();
  }, []);

  useEffect(() => {
    loadSailing();
  }, [sailCode]);

  const handleSave = async (draft, { asLibrary = false } = {}) => {
    setLoading(true);
    setError(null);
    try {
      if (asLibrary) {
        await inventoryTargetProfileService.upsert({
          id: draft?.id || null,
          name: draft?.name,
          perspective: draft?.perspective,
          description: draft?.description,
          nodes: draft?.nodes || [],
          asLibrary: true,
          isActive: false,
        });
        await loadLibrary();
        return;
      }

      if (!sailCode) {
        throw new Error('Select a sailing before assigning a target');
      }
      let itemId = inventoryItemId;
      if (!itemId) {
        const item = await inventoryProfileSeriesService.ensureInventoryItemForSail({
          sailCode,
          referenceSailCode: selectionMeta.referenceSailCode || sailCode,
          shipCode: selectionMeta.shipCode,
          shipName: selectionMeta.shipName,
        });
        itemId = item?.id;
        setInventoryItemId(itemId || null);
      }
      if (!itemId) {
        throw new Error('Could not resolve or create inventory_item for this sail');
      }
      const { suggestionMeta, sourceIsLibrary, ...payload } = draft || {};
      await inventoryTargetProfileService.upsert({
        ...payload,
        id: sourceIsLibrary ? null : payload.id,
        inventoryItemId: String(itemId),
        sourceIsLibrary: Boolean(sourceIsLibrary) || !payload.id,
        isActive: true,
      });
      window.dispatchEvent(new CustomEvent(REPORT_REFRESH_EVENT, { detail: {} }));
      await Promise.all([loadSailing(), loadLibrary()]);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setLoading(true);
    setError(null);
    try {
      await inventoryTargetProfileService.delete(id);
      await Promise.all([loadLibrary(), loadSailing()]);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBackfill = async ({ templateProfileId = null } = {}) => {
    setBackfillBusy(true);
    setError(null);
    try {
      const result = await profileCompareService.backfillTargetProfiles({
        fromDate: horizon.from || undefined,
        toDate: horizon.to || undefined,
        templateProfileId: templateProfileId || undefined,
        limit: 500,
      });
      setBackfillResult(result);
      window.dispatchEvent(new CustomEvent(REPORT_REFRESH_EVENT, { detail: {} }));
      await loadSailing();
    } catch (err) {
      setError(err);
    } finally {
      setBackfillBusy(false);
    }
  };

  const handleResuggest = async () => {
    if (!sailCode) return;
    setLoading(true);
    try {
      const suggestion = await loadSuggestion(sailCode);
      setSuggestedDraft(suggestion);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyFromPeer = async () => {
    if (!sailCode) return null;
    setLoading(true);
    setError(null);
    try {
      const compare = await profileCompareService.fetchCompare(sailCode, {
        includeBudget: false,
        includeTarget: true,
      });
      const peerCode = compare?.modelSailCode || compare?.model?.sailCode || null;
      if (!peerCode) {
        setError(new Error('No last-year sailing found for this ship'));
        return null;
      }
      const item = await inventoryProfileSeriesService.findInventoryItemBySailCode(peerCode);
      const list = item?.id ? await inventoryTargetProfileService.list(item.id) : [];
      const active = list.find((profile) => profile.isActive) || list[0];
      if (active) {
        return {
          id: null,
          name: active.name,
          perspective: active.perspective || 'commercial',
          description: `Copied from ${peerCode}`,
          isActive: true,
          sourceIsLibrary: true,
          nodes: (active.nodes || []).map((node, idx) => ({
            ...node,
            id: undefined,
            tempKey: `peer-${idx}`,
          })),
          suggestionMeta: {
            source: 'peer-profile',
            modelSailCode: peerCode,
            endLfPct: active.nodes?.find((node) => Number(node.weeksUntilSailing) === 0)?.lfPct ?? null,
          },
        };
      }
      const suggestion = await loadSuggestion(sailCode);
      if (suggestion) return suggestion;
      setError(new Error(`Last-year sailing ${peerCode} has no target profile`));
      return null;
    } catch (err) {
      setError(err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  if (loading && !profiles.length && !libraryProfiles.length && !suggestedDraft && inventoryItemId == null) {
    return <LoadingSpinner message="Loading target profiles..." fullScreen={false} />;
  }

  return (
    <InventoryTargetProfilePresenter
      mode={mode}
      onModeChange={setMode}
      sailCode={sailCode}
      inventoryItemId={inventoryItemId}
      profiles={profiles}
      libraryProfiles={libraryProfiles}
      suggestedDraft={suggestedDraft}
      overlaySeries={overlaySeries}
      theme={theme}
      loadError={error}
      onSave={handleSave}
      onDelete={handleDelete}
      onRefresh={() => Promise.all([loadLibrary(), loadSailing()])}
      onResuggest={handleResuggest}
      onCopyFromPeer={handleCopyFromPeer}
      onBackfill={handleBackfill}
      backfillBusy={backfillBusy}
      backfillResult={backfillResult}
      panelInstanceId={panelInstanceId}
      panelComponentId={panelComponentId}
    />
  );
};

export default InventoryTargetProfileEditorContainer;
