/**
 * Nested load-factor target profile editor (multi-perspective per inventory item).
 */

import React, { useEffect, useState } from 'react';
import {
  SAIL_SELECT_EVENT,
  SAIL_CLEAR_EVENT,
  extractSailCodeFromEvent,
} from '../../../lib/eventBus';
import inventoryProfileSeriesService from '../../../services/data/inventoryProfileSeriesService';
import inventoryTargetProfileService from '../../../services/data/inventoryTargetProfileService';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';
import InventoryTargetProfilePresenter from './InventoryTargetProfilePresenter';

const resolveSail = (detail) =>
  detail?.canonical_scope?.reference_sail_code ||
  detail?.canonical_scope?.sail_codes?.[0] ||
  extractSailCodeFromEvent(detail);

const InventoryTargetProfileEditorContainer = ({
  panelInstanceId,
  panelComponentId,
  ...props
}) => {
  const { params = {}, theme } = props;
  const [sailCode, setSailCode] = useState(params.sailCode || null);
  const [inventoryItemId, setInventoryItemId] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onSelect = (e) => {
      const code = resolveSail(e?.detail);
      if (code) setSailCode(code);
    };
    const onClear = () => {
      setSailCode(null);
      setInventoryItemId(null);
      setProfiles([]);
    };
    window.addEventListener(SAIL_SELECT_EVENT, onSelect);
    window.addEventListener(SAIL_CLEAR_EVENT, onClear);
    return () => {
      window.removeEventListener(SAIL_SELECT_EVENT, onSelect);
      window.removeEventListener(SAIL_CLEAR_EVENT, onClear);
    };
  }, []);

  const load = async () => {
    if (!sailCode) return;
    setLoading(true);
    setError(null);
    try {
      const item = await inventoryProfileSeriesService.findInventoryItemBySailCode(sailCode);
      if (!item?.id) {
        throw new Error(`No inventory_item for ${sailCode}`);
      }
      setInventoryItemId(item.id);
      const list = await inventoryTargetProfileService.list(item.id);
      setProfiles(list);
    } catch (err) {
      setError(err);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [sailCode]);

  const handleSave = async (draft) => {
    if (!inventoryItemId) return;
    setLoading(true);
    setError(null);
    try {
      await inventoryTargetProfileService.upsert({
        ...draft,
        inventoryItemId: String(inventoryItemId),
      });
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setLoading(true);
    try {
      await inventoryTargetProfileService.delete(id);
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  if (!sailCode) {
    return (
      <div className="focus-panel-empty">
        <p>Select a sailing to edit nested load-factor target profiles</p>
      </div>
    );
  }

  if (loading && !profiles.length) {
    return <LoadingSpinner message="Loading target profiles..." fullScreen={false} />;
  }

  if (error && !profiles.length) {
    return (
      <ErrorMessage error={error} title="Failed to load target profiles" onRetry={load} />
    );
  }

  return (
    <InventoryTargetProfilePresenter
      sailCode={sailCode}
      inventoryItemId={inventoryItemId}
      profiles={profiles}
      theme={theme}
      onSave={handleSave}
      onDelete={handleDelete}
      onRefresh={load}
      panelInstanceId={panelInstanceId}
      panelComponentId={panelComponentId}
    />
  );
};

export default InventoryTargetProfileEditorContainer;
