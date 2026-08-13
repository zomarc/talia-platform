/**
 * Target Profile Editor — create/edit/activate goal curves for a selected sail.
 * When none exist, suggests a draft from model prior (else REAL).
 */

import React, { useEffect, useState } from 'react';
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
  const [sailCode, setSailCode] = useState(params.sailCode || null);
  const [selectionMeta, setSelectionMeta] = useState({
    referenceSailCode: params.sailCode || null,
    shipCode: null,
    shipName: null,
  });
  const [inventoryItemId, setInventoryItemId] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [suggestedDraft, setSuggestedDraft] = useState(null);
  const [overlaySeries, setOverlaySeries] = useState({ real: [], model: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillResult, setBackfillResult] = useState(null);

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
    };
    window.addEventListener(SAIL_SELECT_EVENT, onSelect);
    window.addEventListener(SAIL_CLEAR_EVENT, onClear);
    return () => {
      window.removeEventListener(SAIL_SELECT_EVENT, onSelect);
      window.removeEventListener(SAIL_CLEAR_EVENT, onClear);
    };
  }, []);

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

  const load = async () => {
    if (!sailCode) return;
    setLoading(true);
    setError(null);
    setSuggestedDraft(null);
    try {
      const item = await inventoryProfileSeriesService.findInventoryItemBySailCode(sailCode);
      setInventoryItemId(item?.id || null);
      let list = [];
      if (item?.id) {
        list = await inventoryTargetProfileService.list(item.id);
        setProfiles(Array.isArray(list) ? list : []);
      } else {
        setProfiles([]);
      }
      const suggestion = await loadSuggestion(sailCode);
      if (!list?.length) setSuggestedDraft(suggestion);
      else setSuggestedDraft(null);
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
    load();
  }, [sailCode]);

  const handleSave = async (draft) => {
    if (!sailCode) return;
    setLoading(true);
    setError(null);
    try {
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
      const { suggestionMeta, ...payload } = draft || {};
      await inventoryTargetProfileService.upsert({
        ...payload,
        inventoryItemId: String(itemId),
        isActive: Boolean(payload.isActive),
      });
      window.dispatchEvent(new CustomEvent(REPORT_REFRESH_EVENT, { detail: {} }));
      await load();
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
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (id) => {
    setLoading(true);
    setError(null);
    try {
      await inventoryTargetProfileService.setActive(id);
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBackfill = async ({ fromDate = '2026-06-01' } = {}) => {
    setBackfillBusy(true);
    setError(null);
    try {
      const result = await profileCompareService.backfillTargetProfiles({ fromDate });
      setBackfillResult(result);
      window.dispatchEvent(new CustomEvent(REPORT_REFRESH_EVENT, { detail: {} }));
      await load();
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

  if (!sailCode) {
    return (
      <div className="focus-panel-empty">
        <p>Select a sailing to create or edit a target profile</p>
      </div>
    );
  }

  if (loading && !profiles.length && !suggestedDraft && inventoryItemId == null) {
    return <LoadingSpinner message="Loading target profiles..." fullScreen={false} />;
  }

  return (
    <InventoryTargetProfilePresenter
      sailCode={sailCode}
      inventoryItemId={inventoryItemId}
      profiles={profiles}
      suggestedDraft={suggestedDraft}
      overlaySeries={overlaySeries}
      theme={theme}
      loadError={error}
      onSave={handleSave}
      onDelete={handleDelete}
      onActivate={handleActivate}
      onRefresh={load}
      onResuggest={handleResuggest}
      onBackfill={handleBackfill}
      backfillBusy={backfillBusy}
      backfillResult={backfillResult}
      panelInstanceId={panelInstanceId}
      panelComponentId={panelComponentId}
    />
  );
};

export default InventoryTargetProfileEditorContainer;
