/**
 * Functionality Matrix — ADMIN+ container.
 * Loads matrix cells and the Requirements Log catalog used for assignment.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import {
  ADD_FUNCTIONALITY_MATRIX_NOTE_MUTATION,
  DELETE_FUNCTIONALITY_MATRIX_ITEM_MUTATION,
  DELETE_FUNCTIONALITY_MATRIX_NOTE_MUTATION,
  FUNCTIONALITY_MATRIX_ITEMS_QUERY,
  SET_FUNCTIONALITY_MATRIX_LINKS_MUTATION,
  UPSERT_FUNCTIONALITY_MATRIX_ITEM_MUTATION,
} from '../../../graphql/functionalityMatrixOperations';
import { REQUIREMENT_ITEMS_QUERY } from '../../../graphql/taliaRequirementLogOperations';
import usePanelTrackedFetch from '../../../hooks/usePanelTrackedFetch';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import {
  VIEW_AXIS_LABELS,
  VIEW_DETAILS,
  VIEW_FILTERS,
  VIEW_MATRIX_DISPLAY,
  VIEW_PROVENANCE,
} from '../../../lib/componentOptionsCatalog';
import {
  buildFunctionalityMatrixExport,
  downloadFunctionalityMatrixExport,
  nextReferenceCode,
} from '../../../lib/functionalityMatrix';
import { canAccessPrivilegedPanels, normalizeRole } from '../../../utils/roleUtils';
import PanelDataState from '../../shared/PanelDataState';
import FunctionalityMatrixPresenter from './FunctionalityMatrixPresenter';

const MATRIX_OPTIONS = {
  views: [
    VIEW_MATRIX_DISPLAY,
    VIEW_AXIS_LABELS,
    VIEW_FILTERS,
    { ...VIEW_DETAILS, default: true },
    VIEW_PROVENANCE,
  ],
  operations: [],
};

const COMPONENT = 'FunctionalityMatrix';
const TABLE = 'functionality_matrix_item';

export const emptyMatrixForm = (referenceCode = '') => ({
  referenceCode,
  element: '',
  functionName: '',
  shortName: '',
  name: '',
  concept: '',
  rationale: '',
  technicalRequirement: '',
  complexity: 'M',
  size: 'M',
  phase: '0',
  assignedIds: [],
});

const formFromItem = (item) => ({
  referenceCode: item?.referenceCode || '',
  element: item?.element || '',
  functionName: item?.functionName || '',
  shortName: item?.shortName || '',
  name: item?.name || '',
  concept: item?.concept || '',
  rationale: item?.rationale || '',
  technicalRequirement: item?.technicalRequirement || '',
  complexity: item?.complexity || 'M',
  size: item?.size || 'M',
  phase: item?.phase || '0',
  assignedIds: (item?.links || []).map((link) => String(link.requirementItemId)),
});

const FunctionalityMatrixContainer = ({ panelInstanceId = null, panelComponentId = null }) => {
  const { user } = useSupabaseAuth();
  const role = normalizeRole(user?.role || 'USER');
  const allowed = canAccessPrivilegedPanels(role);
  const {
    viewsState,
    showFilters,
    showDetails,
    showProvenance,
    showAxisLabels,
    reportShellClassName,
  } = useReportShellOptions(panelComponentId || 'functionality-matrix', panelInstanceId, MATRIX_OPTIONS);

  const [items, setItems] = useState([]);
  const [logItems, setLogItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [drafting, setDrafting] = useState(false);
  const [form, setForm] = useState(() => emptyMatrixForm());
  const [noteDraft, setNoteDraft] = useState('');
  const [elementFilter, setElementFilter] = useState('all');
  const [phaseFilter, setPhaseFilter] = useState('all');
  const { shouldSkipRefresh, fetchGraphql, onResumeFetch } = usePanelTrackedFetch(
    panelInstanceId,
    panelComponentId
  );
  const loadItemsRef = useRef(null);

  const display = viewsState?.display === 'list' ? 'list' : 'grid';

  const loadItems = useCallback(async () => {
    if (shouldSkipRefresh()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [matrixData, logData] = await Promise.all([
        fetchGraphql({
          query: FUNCTIONALITY_MATRIX_ITEMS_QUERY,
          component: panelComponentId || COMPONENT,
          purpose: 'Load Functionality Matrix',
          tableName: TABLE,
        }),
        fetchGraphql({
          query: REQUIREMENT_ITEMS_QUERY,
          variables: { filters: { includeDone: true, limit: 2000 } },
          component: panelComponentId || COMPONENT,
          purpose: 'Load Requirements Log items for matrix assignment',
          tableName: 'talia_requirement_item',
        }),
      ]);
      setItems(Array.isArray(matrixData?.functionalityMatrixItems) ? matrixData.functionalityMatrixItems : []);
      setLogItems(Array.isArray(logData?.requirementItems) ? logData.requirementItems : []);
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setError(err?.message || String(err));
      setItems([]);
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

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId],
  );

  const elements = useMemo(() => {
    const names = new Set();
    items.forEach((item) => {
      const name = String(item.element || '').trim();
      if (name) names.add(name);
    });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const visibleItems = useMemo(() => items.filter((item) => {
    if (elementFilter !== 'all' && item.element !== elementFilter) return false;
    if (phaseFilter !== 'all' && item.phase !== phaseFilter) return false;
    return true;
  }), [items, elementFilter, phaseFilter]);

  const openItem = (item) => {
    setDrafting(false);
    setSelectedId(item.id);
    setForm(formFromItem(item));
    setNoteDraft('');
    setMessage(null);
  };

  const startDraft = () => {
    setDrafting(true);
    setSelectedId(null);
    setForm(emptyMatrixForm(nextReferenceCode(items)));
    setNoteDraft('');
    setMessage(null);
  };

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleAssignment = (requirementItemId) => {
    const id = String(requirementItemId);
    setForm((current) => {
      const has = current.assignedIds.includes(id);
      return {
        ...current,
        assignedIds: has
          ? current.assignedIds.filter((value) => value !== id)
          : [...current.assignedIds, id],
      };
    });
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const input = {
        referenceCode: form.referenceCode,
        element: form.element,
        functionName: form.functionName,
        shortName: form.shortName,
        name: form.name,
        concept: form.concept,
        rationale: form.rationale,
        technicalRequirement: form.technicalRequirement,
        complexity: form.complexity,
        size: form.size,
        phase: form.phase,
      };
      if (!drafting && selectedId) input.id = selectedId;
      const data = await fetchGraphql({
        query: UPSERT_FUNCTIONALITY_MATRIX_ITEM_MUTATION,
        variables: { input },
        component: panelComponentId || COMPONENT,
        purpose: drafting ? 'Create matrix requirement' : 'Update matrix requirement',
        tableName: TABLE,
      });
      const saved = data?.upsertFunctionalityMatrixItem;
      if (!saved?.id) throw new Error('Save did not return a requirement');
      const linked = await fetchGraphql({
        query: SET_FUNCTIONALITY_MATRIX_LINKS_MUTATION,
        variables: {
          matrixItemId: saved.id,
          requirementItemIds: form.assignedIds,
        },
        component: panelComponentId || COMPONENT,
        purpose: 'Assign Requirements Log items to matrix requirement',
        tableName: 'functionality_matrix_link',
      });
      const stored = linked?.setFunctionalityMatrixLinks || saved;
      setDrafting(false);
      setSelectedId(stored.id);
      setForm(formFromItem(stored));
      setMessage(`Saved ${stored.referenceCode}`);
      await loadItems();
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setMessage(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async () => {
    if (!selectedId) return;
    const label = selected?.referenceCode || 'this requirement';
    if (typeof window !== 'undefined' && !window.confirm(`Delete ${label}? Discussion and assignments on this cell are removed. Requirements Log items stay.`)) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await fetchGraphql({
        query: DELETE_FUNCTIONALITY_MATRIX_ITEM_MUTATION,
        variables: { id: selectedId },
        component: panelComponentId || COMPONENT,
        purpose: 'Delete matrix requirement',
        tableName: TABLE,
      });
      setSelectedId(null);
      setDrafting(false);
      setForm(emptyMatrixForm());
      setMessage('Requirement removed');
      await loadItems();
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setMessage(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const addNote = async () => {
    const body = noteDraft.trim();
    if (!selectedId || !body) return;
    setBusy(true);
    setMessage(null);
    try {
      await fetchGraphql({
        query: ADD_FUNCTIONALITY_MATRIX_NOTE_MUTATION,
        variables: { matrixItemId: selectedId, body },
        component: panelComponentId || COMPONENT,
        purpose: 'Add matrix discussion note',
        tableName: 'functionality_matrix_note',
      });
      setNoteDraft('');
      await loadItems();
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setMessage(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const removeNote = async (noteId) => {
    setBusy(true);
    setMessage(null);
    try {
      await fetchGraphql({
        query: DELETE_FUNCTIONALITY_MATRIX_NOTE_MUTATION,
        variables: { id: noteId },
        component: panelComponentId || COMPONENT,
        purpose: 'Remove matrix discussion note',
        tableName: 'functionality_matrix_note',
      });
      await loadItems();
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setMessage(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const exportItems = (list, filename) => {
    downloadFunctionalityMatrixExport(buildFunctionalityMatrixExport(list), filename);
  };

  if (!allowed) {
    return (
      <div className="focus-panel-empty">
        <p>Admin or Super User access required for the Functionality Matrix.</p>
      </div>
    );
  }

  return (
    <PanelDataState
      loading={loading && items.length === 0 && !error}
      loadingMessage="Loading Functionality Matrix..."
      error={error && items.length === 0 ? error : null}
      errorTitle="Failed to load Functionality Matrix"
      empty={false}
      onRetry={loadItems}
    >
      <FunctionalityMatrixPresenter
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId || 'functionality-matrix'}
        reportShellClassName={reportShellClassName}
        display={display}
        showFilters={showFilters}
        showDetails={showDetails}
        showProvenance={showProvenance}
        showAxisLabels={showAxisLabels}
        items={visibleItems}
        totalCount={items.length}
        elements={elements}
        elementFilter={elementFilter}
        phaseFilter={phaseFilter}
        onElementFilter={setElementFilter}
        onPhaseFilter={setPhaseFilter}
        logItems={logItems}
        selectedId={selectedId}
        selected={selected}
        drafting={drafting}
        form={form}
        noteDraft={noteDraft}
        busy={busy}
        message={message}
        onSelect={openItem}
        onNew={startDraft}
        onFormChange={updateForm}
        onToggleAssignment={toggleAssignment}
        onNoteDraft={setNoteDraft}
        onSave={save}
        onDelete={removeItem}
        onAddNote={addNote}
        onDeleteNote={removeNote}
        onExportAll={() => exportItems(items, `functionality-matrix-${new Date().toISOString().slice(0, 10)}.json`)}
        onExportOne={() => {
          if (!selected) return;
          exportItems([selected], `${selected.referenceCode || 'requirement'}.json`);
        }}
        onRefresh={loadItems}
      />
    </PanelDataState>
  );
};

export default FunctionalityMatrixContainer;
