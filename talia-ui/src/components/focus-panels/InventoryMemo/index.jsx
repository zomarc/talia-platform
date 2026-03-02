import React, { useEffect, useMemo, useState } from 'react';
import InventoryMemoPresenter from './InventoryMemoPresenter';
import PanelDataState from '../../shared/PanelDataState';
import { SAIL_CLEAR_EVENT, SAIL_SELECT_EVENT } from '../../../lib/eventBus';

const GRAPHQL_URL = '/api/graphql';

const extractSelection = (detail) => {
  if (!detail) return { sailCode: '', shipCode: '', shipName: '' };
  const row = detail?.row_data || detail;
  return {
    sailCode: row?.sail_code || row?.Sail_Code || detail?.sail_code || '',
    shipCode: row?.ship_code || row?.ship || '',
    shipName: row?.ship_name || row?.ship || ''
  };
};

const fetchInventoryItems = async (selection) => {
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
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { filters } })
  });
  const payload = await response.json();
  if (!response.ok || payload?.errors?.length) {
    throw new Error(payload?.errors?.[0]?.message || `HTTP ${response.status}`);
  }
  return payload?.data?.inventoryItems || [];
};

const fetchMemos = async (inventoryItemId) => {
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
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { inventoryItemId } })
  });
  const payload = await response.json();
  if (!response.ok || payload?.errors?.length) {
    throw new Error(payload?.errors?.[0]?.message || `HTTP ${response.status}`);
  }
  return payload?.data?.inventoryMemos || [];
};

const addMemo = async ({ inventoryItemId, selection, mmsi, memoText, memoType }) => {
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
    inventoryItem: {
      sailCode: selection.sailCode || undefined,
      shipCode: selection.shipCode || undefined,
      shipName: selection.shipName || undefined,
      mmsi: mmsi || undefined,
      sourceTable: 'manual-memo'
    },
    memoText,
    memoType
  };
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: mutation, variables: { input } })
  });
  const payload = await response.json();
  if (!response.ok || payload?.errors?.length) {
    throw new Error(payload?.errors?.[0]?.message || `HTTP ${response.status}`);
  }
  return payload?.data?.addInventoryMemo;
};

const InventoryMemoContainer = () => {
  const [selection, setSelection] = useState({ sailCode: '', shipCode: '', shipName: '' });
  const [inventoryItem, setInventoryItem] = useState(null);
  const [memos, setMemos] = useState([]);
  const [mmsi, setMmsi] = useState('');
  const [memoText, setMemoText] = useState('');
  const [memoType, setMemoType] = useState('note');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const loadData = async (nextSelection) => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchInventoryItems(nextSelection);
      const selectedItem = items[0] || null;
      setInventoryItem(selectedItem);
      setMmsi(selectedItem?.mmsi || '');
      if (selectedItem?.id) {
        const rows = await fetchMemos(String(selectedItem.id));
        setMemos(rows);
      } else {
        setMemos([]);
      }
    } catch (e) {
      setError(e);
      setInventoryItem(null);
      setMemos([]);
    } finally {
      setLoading(false);
    }
  };

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
  }, []);

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
      await addMemo({
        inventoryItemId: inventoryItem?.id || null,
        selection,
        mmsi,
        memoText: memoText.trim(),
        memoType
      });
      setMemoText('');
      await loadData(selection);
    } catch (e) {
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
      />
    </PanelDataState>
  );
};

export default InventoryMemoContainer;
