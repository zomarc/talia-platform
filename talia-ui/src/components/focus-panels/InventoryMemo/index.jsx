import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import InventoryMemoPresenter from './InventoryMemoPresenter';
import PanelDataState from '../../shared/PanelDataState';
import { MEMO_CREATE_EVENT, SAIL_CLEAR_EVENT, SAIL_SELECT_EVENT } from '../../../lib/eventBus';
import usePanelTrackedFetch from '../../../hooks/usePanelTrackedFetch';

const claimedMemoCreates = new Map();

const extractSelection = (detail) => {
  if (!detail) return { sailCode: '', shipCode: '', shipName: '' };
  const row = detail?.row_data || detail;
  return {
    sailCode: row?.sail_code || row?.Sail_Code || detail?.sail_code || '',
    shipCode: row?.ship_code || row?.ship || '',
    shipName: row?.ship_name || row?.ship || ''
  };
};

const claimMemoCreate = (key) => {
  const now = Date.now();
  const previous = claimedMemoCreates.get(key) || 0;
  if (now - previous < 1500) return false;
  claimedMemoCreates.set(key, now);
  return true;
};

const fetchInventoryItems = async (fetchGraphql, selection) => {
  const query = `
    query GetInventoryItems($filters: InventoryItemFilters) {
      inventoryItems(filters: $filters) {
        id
        localKey
        sailCode
        mmsi
        shipCode
        shipName
        createdAt
        updatedAt
      }
    }
  `;
  const filters = {
    sailCode: selection.sailCode || undefined,
    shipCode: selection.shipCode || undefined,
    limit: 10
  };
  const data = await fetchGraphql({
    query,
    variables: { filters },
    component: 'Inventory Memo',
    purpose: 'Load inventory items for memo',
    tableName: 'inventory_item',
  });
  return data?.inventoryItems || [];
};

const fetchMemos = async (fetchGraphql, inventoryItemId) => {
  const query = `
    query GetInventoryMemos($inventoryItemId: ID!) {
      inventoryMemos(inventoryItemId: $inventoryItemId) {
        id
        inventoryItemId
        memoText
        memoType
        createdBy
        createdAt
      }
    }
  `;
  const data = await fetchGraphql({
    query,
    variables: { inventoryItemId },
    component: 'Inventory Memo',
    purpose: 'Load memos for inventory item',
    tableName: 'inventory_item_memo',
  });
  return data?.inventoryMemos || [];
};

const addMemo = async (fetchGraphql, {
  inventoryItemId,
  selection,
  mmsi,
  memoText,
  memoType,
  sourceTable,
  sourceRowId,
}) => {
  const mutation = `
    mutation AddInventoryMemo($input: InventoryMemoInput!) {
      addInventoryMemo(input: $input) {
        id
        inventoryItemId
        memoText
        memoType
        createdBy
        createdAt
      }
    }
  `;
  const input = {
    inventoryItemId: inventoryItemId || undefined,
    inventoryItem: inventoryItemId ? undefined : {
      sailCode: selection.sailCode || undefined,
      shipCode: selection.shipCode || undefined,
      shipName: selection.shipName || undefined,
      mmsi: mmsi || undefined,
      sourceTable: sourceTable || 'manual-memo',
      sourceRowId: sourceRowId || undefined,
    },
    memoText,
    memoType
  };
  const data = await fetchGraphql({
    query: mutation,
    variables: { input },
    component: 'Inventory Memo',
    purpose: 'Save inventory memo',
    tableName: 'inventory_item_memo',
  });
  return data?.addInventoryMemo;
};

const InventoryMemoContainer = ({ panelInstanceId, panelComponentId }) => {
  const [selection, setSelection] = useState({ sailCode: '', shipCode: '', shipName: '' });
  const [inventoryItem, setInventoryItem] = useState(null);
  const [memos, setMemos] = useState([]);
  const [mmsi, setMmsi] = useState('');
  const [memoText, setMemoText] = useState('');
  const [memoType, setMemoType] = useState('note');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { shouldSkipRefresh, fetchGraphql, onResumeFetch } = usePanelTrackedFetch(
    panelInstanceId,
    panelComponentId
  );
  const loadDataRef = useRef(null);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  const loadData = useCallback(async (nextSelection) => {
    if (shouldSkipRefresh()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const items = await fetchInventoryItems(fetchGraphql, nextSelection);
      const selectedItem = items[0] || null;
      setInventoryItem(selectedItem);
      setMmsi(selectedItem?.mmsi || '');
      if (selectedItem?.id) {
        const rows = await fetchMemos(fetchGraphql, String(selectedItem.id));
        setMemos(rows);
      } else {
        setMemos([]);
      }
    } catch (e) {
      if (e?.code === 'PANEL_PAUSED') return;
      setError(e);
      setInventoryItem(null);
      setMemos([]);
    } finally {
      setLoading(false);
    }
  }, [fetchGraphql, shouldSkipRefresh]);

  loadDataRef.current = loadData;

  useEffect(() => {
    onResumeFetch(() => { loadDataRef.current?.(selectionRef.current); });
    return () => onResumeFetch(null);
  }, [onResumeFetch]);

  useEffect(() => {
    const onSelect = (event) => {
      const next = extractSelection(event?.detail);
      setSelection(next);
      loadData(next);
    };
    const onClear = () => {
      const blank = { sailCode: '', shipCode: '', shipName: '' };
      setSelection(blank);
      loadData(blank);
    };

    window.addEventListener(SAIL_SELECT_EVENT, onSelect);
    window.addEventListener(SAIL_CLEAR_EVENT, onClear);
    if (window.lastSailSelectEvent?.detail) {
      const next = extractSelection(window.lastSailSelectEvent.detail);
      setSelection(next);
      loadData(next);
    } else {
      loadData({ sailCode: '', shipCode: '', shipName: '' });
    }
    return () => {
      window.removeEventListener(SAIL_SELECT_EVENT, onSelect);
      window.removeEventListener(SAIL_CLEAR_EVENT, onClear);
    };
  }, [loadData]);

  useEffect(() => {
    const onCreate = async (event) => {
      const detail = event?.detail || {};
      const text = String(detail.memoText || '').trim();
      if (!text) return;
      const key = `${detail.sourceRowId || ''}|${detail.createdAt || ''}|${text}`;
      if (!claimMemoCreate(key)) return;
      const nextSelection = {
        sailCode: detail.sailCode || '',
        shipCode: detail.shipCode || '',
        shipName: detail.shipName || '',
      };
      setSaving(true);
      setError(null);
      try {
        let inventoryItemId = null;
        if (nextSelection.sailCode) {
          const items = await fetchInventoryItems(fetchGraphql, nextSelection);
          inventoryItemId = items[0]?.id || null;
        }
        await addMemo(fetchGraphql, {
          inventoryItemId,
          selection: nextSelection,
          mmsi: detail.mmsi || '',
          memoText: text,
          memoType: detail.memoType || 'note',
          sourceTable: detail.sourceTable,
          sourceRowId: detail.sourceRowId,
        });
        setMemoType(detail.memoType || 'note');
        if (nextSelection.sailCode) setSelection(nextSelection);
        await loadData(nextSelection.sailCode ? nextSelection : { sailCode: '', shipCode: '', shipName: '' });
      } catch (e) {
        if (e?.code === 'PANEL_PAUSED') return;
        setError(e);
      } finally {
        setSaving(false);
      }
    };
    window.addEventListener(MEMO_CREATE_EVENT, onCreate);
    return () => window.removeEventListener(MEMO_CREATE_EVENT, onCreate);
  }, [fetchGraphql, loadData]);

  const subtitle = useMemo(() => {
    if (selection.sailCode) {
      return `Linked to sail ${selection.sailCode}${selection.shipName ? ` (${selection.shipName})` : ''}`;
    }
    return 'No sail selected. You can still create a memo with manual mapping fields.';
  }, [selection]);

  const onSaveMemo = async () => {
    if (!memoText.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await addMemo(fetchGraphql, {
        inventoryItemId: inventoryItem?.id || null,
        selection,
        mmsi,
        memoText: memoText.trim(),
        memoType
      });
      setMemoText('');
      await loadData(selection);
    } catch (e) {
      if (e?.code === 'PANEL_PAUSED') return;
      setError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PanelDataState
      loading={loading}
      loadingMessage="Loading inventory mapping and memos..."
      error={error}
      errorTitle="Failed to load inventory memos"
      empty={false}
      onRetry={() => loadData(selection)}
    >
      <InventoryMemoPresenter
        selection={selection}
        subtitle={subtitle}
        inventoryItem={inventoryItem}
        memos={memos}
        mmsi={mmsi}
        memoText={memoText}
        memoType={memoType}
        saving={saving}
        setMmsi={setMmsi}
        setMemoText={setMemoText}
        setMemoType={setMemoType}
        onSaveMemo={onSaveMemo}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId}
      />
    </PanelDataState>
  );
};

export default InventoryMemoContainer;
