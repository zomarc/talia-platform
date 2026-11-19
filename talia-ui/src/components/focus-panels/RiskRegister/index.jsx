/**
 * Risk register — ADMIN+ container.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import { FUNCTIONALITY_MATRIX_ITEMS_QUERY } from '../../../graphql/functionalityMatrixOperations';
import {
  DELETE_RISK_REGISTER_ITEM_MUTATION,
  RISK_REGISTER_ITEMS_QUERY,
  UPSERT_RISK_REGISTER_ITEM_MUTATION,
} from '../../../graphql/projectAdminOperations';
import { REQUIREMENT_ITEMS_QUERY } from '../../../graphql/taliaRequirementLogOperations';
import usePanelTrackedFetch from '../../../hooks/usePanelTrackedFetch';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import {
  VIEW_AXIS_LABELS,
  VIEW_DETAILS,
  VIEW_FILTERS,
  VIEW_PROVENANCE,
  VIEW_RISK_DISPLAY,
} from '../../../lib/componentOptionsCatalog';
import {
  buildRiskRegisterExport,
  downloadJson,
  nextRiskReference,
} from '../../../lib/riskRegister';
import { canAccessPrivilegedPanels, normalizeRole } from '../../../utils/roleUtils';
import PanelDataState from '../../shared/PanelDataState';
import RiskRegisterPresenter from './RiskRegisterPresenter';

const RISK_OPTIONS = {
  views: [
    VIEW_RISK_DISPLAY,
    VIEW_AXIS_LABELS,
    VIEW_FILTERS,
    { ...VIEW_DETAILS, default: true },
    VIEW_PROVENANCE,
  ],
  operations: [],
};

const COMPONENT = 'RiskRegister';

export const emptyRiskForm = (referenceCode = '') => ({
  referenceCode,
  title: '',
  statement: '',
  category: 'technical',
  likelihood: 3,
  impact: 3,
  residualLikelihood: '',
  residualImpact: '',
  proximity: 'immediate',
  status: 'open',
  response: 'reduce',
  treatment: '',
  owner: '',
  reviewOn: '',
  links: [],
});

const formFromItem = (item) => ({
  referenceCode: item?.referenceCode || '',
  title: item?.title || '',
  statement: item?.statement || '',
  category: item?.category || 'technical',
  likelihood: item?.likelihood ?? 3,
  impact: item?.impact ?? 3,
  residualLikelihood: item?.residualLikelihood ?? '',
  residualImpact: item?.residualImpact ?? '',
  proximity: item?.proximity || 'immediate',
  status: item?.status || 'open',
  response: item?.response || 'reduce',
  treatment: item?.treatment || '',
  owner: item?.owner || '',
  reviewOn: item?.reviewOn || '',
  links: item?.links || [],
});

const RiskRegisterContainer = ({ panelInstanceId = null, panelComponentId = null }) => {
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
  } = useReportShellOptions(panelComponentId || 'risk-register', panelInstanceId, RISK_OPTIONS);

  const [items, setItems] = useState([]);
  const [catalogs, setCatalogs] = useState({ requirement: [], matrix: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [drafting, setDrafting] = useState(false);
  const [form, setForm] = useState(() => emptyRiskForm());
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const { shouldSkipRefresh, fetchGraphql, onResumeFetch } = usePanelTrackedFetch(
    panelInstanceId,
    panelComponentId
  );
  const loadItemsRef = useRef(null);

  const display = viewsState?.display === 'heat' ? 'heat' : 'list';

  const loadItems = useCallback(async () => {
    if (shouldSkipRefresh()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [riskData, logData, matrixData] = await Promise.all([
        fetchGraphql({
          query: RISK_REGISTER_ITEMS_QUERY,
          component: panelComponentId || COMPONENT,
          purpose: 'Load risk register',
          tableName: 'risk_register_item',
        }),
        fetchGraphql({
          query: REQUIREMENT_ITEMS_QUERY,
          variables: { filters: { includeDone: true, limit: 2000 } },
          component: panelComponentId || COMPONENT,
          purpose: 'Load requirements for risk links',
          tableName: 'talia_requirement_item',
        }),
        fetchGraphql({
          query: FUNCTIONALITY_MATRIX_ITEMS_QUERY,
          component: panelComponentId || COMPONENT,
          purpose: 'Load matrix cells for risk links',
          tableName: 'functionality_matrix_item',
        }),
      ]);
      setItems(Array.isArray(riskData?.riskRegisterItems) ? riskData.riskRegisterItems : []);
      setCatalogs({
        requirement: (logData?.requirementItems || []).map((item) => ({
          id: item.id,
          label: item.title,
        })),
        matrix: (matrixData?.functionalityMatrixItems || []).map((item) => ({
          id: item.id,
          label: `${item.referenceCode} ${item.shortName}`,
        })),
      });
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

  const visibleItems = useMemo(() => items.filter((item) => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    return true;
  }), [items, categoryFilter, statusFilter]);

  const openItem = (item) => {
    setDrafting(false);
    setSelectedId(item.id);
    setForm(formFromItem(item));
    setMessage(null);
  };

  const startDraft = () => {
    setDrafting(true);
    setSelectedId(null);
    setForm(emptyRiskForm(nextRiskReference(items)));
    setMessage(null);
  };

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const input = {
        ...(selected && !drafting ? { id: selected.id } : {}),
        referenceCode: form.referenceCode,
        title: form.title,
        statement: form.statement,
        category: form.category,
        likelihood: Number(form.likelihood),
        impact: Number(form.impact),
        residualLikelihood: form.residualLikelihood === '' ? null : Number(form.residualLikelihood),
        residualImpact: form.residualImpact === '' ? null : Number(form.residualImpact),
        proximity: form.proximity,
        status: form.status,
        response: form.response,
        treatment: form.treatment,
        owner: form.owner,
        reviewOn: form.reviewOn || null,
        links: (form.links || []).map((link) => ({
          targetKind: link.targetKind,
          targetId: link.targetId,
        })),
      };
      const data = await fetchGraphql({
        query: UPSERT_RISK_REGISTER_ITEM_MUTATION,
        variables: { input },
        component: panelComponentId || COMPONENT,
        purpose: 'Save risk',
        tableName: 'risk_register_item',
      });
      const saved = data?.upsertRiskRegisterItem;
      setDrafting(false);
      if (saved?.id) setSelectedId(saved.id);
      setMessage('Saved');
      await loadItems();
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setMessage(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async () => {
    if (!selected?.id) return;
    if (!window.confirm(`Delete ${selected.referenceCode}?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await fetchGraphql({
        query: DELETE_RISK_REGISTER_ITEM_MUTATION,
        variables: { id: selected.id },
        component: panelComponentId || COMPONENT,
        purpose: 'Delete risk',
        tableName: 'risk_register_item',
      });
      setSelectedId(null);
      setDrafting(false);
      setForm(emptyRiskForm());
      await loadItems();
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setMessage(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const exportItems = (list, filename) => {
    downloadJson(buildRiskRegisterExport(list), filename);
  };

  if (!allowed) {
    return (
      <div className="focus-panel-empty">
        <p>Admin or Super User access required for the Risk Register.</p>
      </div>
    );
  }

  return (
    <PanelDataState
      loading={loading && items.length === 0 && !error}
      loadingMessage="Loading risk register..."
      error={error && items.length === 0 ? error : null}
      errorTitle="Failed to load risk register"
      empty={false}
      onRetry={loadItems}
    >
      <RiskRegisterPresenter
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId || 'risk-register'}
        reportShellClassName={reportShellClassName}
        display={display}
        showFilters={showFilters}
        showDetails={showDetails}
        showProvenance={showProvenance}
        showAxisLabels={showAxisLabels}
        items={visibleItems}
        totalCount={items.length}
        categoryFilter={categoryFilter}
        statusFilter={statusFilter}
        onCategoryFilter={setCategoryFilter}
        onStatusFilter={setStatusFilter}
        catalogs={catalogs}
        selectedId={selectedId}
        selected={selected}
        drafting={drafting}
        form={form}
        busy={busy}
        message={message}
        onSelect={openItem}
        onNew={startDraft}
        onFormChange={updateForm}
        onLinksChange={(links) => updateForm('links', links)}
        onSave={save}
        onDelete={removeItem}
        onExportAll={() => exportItems(items, `risk-register-${new Date().toISOString().slice(0, 10)}.json`)}
        onExportOne={() => {
          if (!selected) return;
          exportItems([selected], `${selected.referenceCode || 'risk'}.json`);
        }}
        onRefresh={loadItems}
      />
    </PanelDataState>
  );
};

export default RiskRegisterContainer;
