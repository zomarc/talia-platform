/**
 * Requirements Log — ADMIN+ container (load / mutate / import-export).
 * Table filters are applied client-side so facet dropdowns always list the full catalog.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import {
  DELETE_REQUIREMENT_ITEM_MUTATION,
  REQUIREMENT_ITEMS_QUERY,
  SET_REQUIREMENT_ITEM_STATUS_MUTATION,
  UPSERT_REQUIREMENT_ITEM_MUTATION,
  UPSERT_REQUIREMENT_ITEMS_MUTATION,
} from '../../../graphql/taliaRequirementLogOperations';
import usePanelTrackedFetch from '../../../hooks/usePanelTrackedFetch';
import {
  buildRequirementInputsFromPack,
  buildRequirementsLogExportPack,
  downloadRequirementsLogPack,
  parseRequirementsLogExportPack,
  parseRequirementsLogPackJsonFileText,
} from '../../../lib/taliaRequirementsLogExportPack';
import { canAccessPrivilegedPanels, normalizeRole } from '../../../utils/roleUtils';
import PanelDataState from '../../shared/PanelDataState';
import RequirementsLogPresenter, { EMPTY_REQUIREMENT_FORM } from './RequirementsLogPresenter';

const COMPONENT = 'RequirementsLog';
const TABLE = 'talia_requirement_item';

const STATUS_CYCLE = ['backlog', 'in_progress', 'done', 'cancelled'];

const nextStatus = (current) => {
  const idx = STATUS_CYCLE.indexOf(String(current || 'backlog'));
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
};

const uniqueSorted = (rows, field) => {
  const set = new Set();
  (rows || []).forEach((row) => {
    const v = row?.[field];
    if (v != null && String(v).trim()) set.add(String(v).trim());
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
};

const RequirementsLogContainer = ({ panelInstanceId, panelComponentId }) => {
  const { user } = useSupabaseAuth();
  const role = normalizeRole(user?.role || 'USER');
  const allowed = canAccessPrivilegedPanels(role);

  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [includeDone, setIncludeDone] = useState(false);
  const [sectionFilter, setSectionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [versionFilter, setVersionFilter] = useState('');
  const [taliaVersionFilter, setTaliaVersionFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_REQUIREMENT_FORM);
  const { shouldSkipRefresh, fetchGraphql, onResumeFetch } = usePanelTrackedFetch(
    panelInstanceId,
    panelComponentId
  );
  const loadItemsRef = useRef(null);

  const loadItems = useCallback(async () => {
    if (shouldSkipRefresh()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Always load the full board (done included) so facet dropdowns stay complete.
      // Visibility of done/cancelled is applied client-side with the other filters.
      const data = await fetchGraphql({
        query: REQUIREMENT_ITEMS_QUERY,
        variables: { filters: { includeDone: true, limit: 2000 } },
        component: panelComponentId || COMPONENT,
        purpose: 'Load Requirements Log items',
        tableName: TABLE,
      });
      setAllItems(Array.isArray(data?.requirementItems) ? data.requirementItems : []);
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setError(err?.message || String(err));
      setAllItems([]);
    } finally {
      setLoading(false);
    }
  }, [fetchGraphql, panelComponentId, shouldSkipRefresh]);

  loadItemsRef.current = loadItems;

  useEffect(() => {
    onResumeFetch(() => { if (allowed) loadItemsRef.current?.(); });
    return () => onResumeFetch(null);
  }, [allowed, onResumeFetch]);

  useEffect(() => {
    if (!allowed) return;
    loadItems();
  }, [allowed, loadItems]);

  const filterOptions = useMemo(() => ({
    milestones: uniqueSorted(allItems, 'targetVersion'),
    taliaVersions: uniqueSorted(allItems, 'taliaVersion'),
    owners: uniqueSorted(allItems, 'owner'),
  }), [allItems]);

  const items = useMemo(() => {
    const section = sectionFilter && sectionFilter !== 'all' ? sectionFilter : null;
    const status = statusFilter && statusFilter !== 'all' ? statusFilter : null;
    const priority = priorityFilter && priorityFilter !== 'all' ? priorityFilter : null;
    const milestone = versionFilter.trim();
    const taliaVer = taliaVersionFilter.trim();
    const owner = ownerFilter.trim();

    return (allItems || []).filter((row) => {
      if (!includeDone && (row.status === 'done' || row.status === 'cancelled')) return false;
      if (section && row.section !== section) return false;
      if (status && row.status !== status) return false;
      if (priority && row.priority !== priority) return false;
      if (milestone && String(row.targetVersion || '') !== milestone) return false;
      if (taliaVer && String(row.taliaVersion || '') !== taliaVer) return false;
      if (owner && String(row.owner || '') !== owner) return false;
      return true;
    });
  }, [
    allItems,
    includeDone,
    ownerFilter,
    priorityFilter,
    sectionFilter,
    statusFilter,
    taliaVersionFilter,
    versionFilter,
  ]);

  const upsertItem = useCallback(async (input) => {
    setBusy(true);
    setMessage(null);
    try {
      const data = await fetchGraphql({
        query: UPSERT_REQUIREMENT_ITEM_MUTATION,
        variables: { input },
        component: panelComponentId || COMPONENT,
        purpose: 'Upsert Requirements Log item',
        tableName: TABLE,
      });
      setMessage('Saved');
      await loadItems();
      return data?.upsertRequirementItem || null;
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return null;
      setMessage(err?.message || String(err));
      throw err;
    } finally {
      setBusy(false);
    }
  }, [fetchGraphql, loadItems, panelComponentId]);

  const cycleStatus = useCallback(async (item) => {
    if (!item?.id) return;
    const status = nextStatus(item.status);
    setBusy(true);
    setMessage(null);
    try {
      await fetchGraphql({
        query: SET_REQUIREMENT_ITEM_STATUS_MUTATION,
        variables: { id: item.id, status },
        component: panelComponentId || COMPONENT,
        purpose: 'Cycle Requirements Log status',
        tableName: TABLE,
      });
      await loadItems();
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setMessage(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  }, [fetchGraphql, loadItems, panelComponentId]);

  const deleteItem = useCallback(async (id) => {
    if (!id) return;
    if (!window.confirm('Delete this requirement item?')) return;
    setBusy(true);
    setMessage(null);
    try {
      await fetchGraphql({
        query: DELETE_REQUIREMENT_ITEM_MUTATION,
        variables: { id },
        component: panelComponentId || COMPONENT,
        purpose: 'Delete Requirements Log item',
        tableName: TABLE,
      });
      setEditing(false);
      setForm(EMPTY_REQUIREMENT_FORM);
      await loadItems();
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setMessage(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  }, [fetchGraphql, loadItems, panelComponentId]);

  const exportPack = useCallback(() => {
    const pack = buildRequirementsLogExportPack(items);
    downloadRequirementsLogPack(pack);
    setMessage(`Exported ${items.length} item(s)`);
  }, [items]);

  const importPack = useCallback(async (file, mode) => {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const text = await file.text();
      const raw = parseRequirementsLogPackJsonFileText(text);
      const parsed = parseRequirementsLogExportPack(raw);
      if (!parsed.ok) throw new Error(parsed.error);
      const inputs = buildRequirementInputsFromPack(parsed.pack, { mode });
      if (inputs.length === 0) {
        setMessage('Pack contained no items');
        return;
      }
      await fetchGraphql({
        query: UPSERT_REQUIREMENT_ITEMS_MUTATION,
        variables: { inputs },
        component: panelComponentId || COMPONENT,
        purpose: `Import Requirements Log (${mode})`,
        tableName: TABLE,
      });
      setMessage(`Imported ${inputs.length} item(s) (${mode})`);
      await loadItems();
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setMessage(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  }, [fetchGraphql, loadItems, panelComponentId]);

  if (!allowed) {
    return (
      <div className="focus-panel-empty">
        <p>Admin or Super User access required for the Requirements Log.</p>
      </div>
    );
  }

  return (
    <PanelDataState
      loading={loading && allItems.length === 0}
      loadingMessage="Loading Requirements Log..."
      error={error && allItems.length === 0 ? error : null}
      errorTitle="Failed to load Requirements Log"
      empty={false}
      onRetry={loadItems}
    >
      <RequirementsLogPresenter
        items={items}
        filterOptions={filterOptions}
        busy={busy}
        message={message || (error && allItems.length ? error : null)}
        includeDone={includeDone}
        sectionFilter={sectionFilter}
        statusFilter={statusFilter}
        priorityFilter={priorityFilter}
        versionFilter={versionFilter}
        taliaVersionFilter={taliaVersionFilter}
        ownerFilter={ownerFilter}
        editing={editing}
        form={form}
        onFormChange={setForm}
        onEditingChange={setEditing}
        onIncludeDoneChange={setIncludeDone}
        onSectionFilterChange={setSectionFilter}
        onStatusFilterChange={setStatusFilter}
        onPriorityFilterChange={setPriorityFilter}
        onVersionFilterChange={setVersionFilter}
        onTaliaVersionFilterChange={setTaliaVersionFilter}
        onOwnerFilterChange={setOwnerFilter}
        onRefresh={loadItems}
        onUpsert={upsertItem}
        onCycleStatus={cycleStatus}
        onDelete={deleteItem}
        onExport={exportPack}
        onImport={importPack}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId || 'requirements-log'}
      />
    </PanelDataState>
  );
};

export default RequirementsLogContainer;
