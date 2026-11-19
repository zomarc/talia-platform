/**
 * Project documents — ADMIN+ container.
 * Markdown notes and images, linked to requirements, matrix cells, and risks.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import { FUNCTIONALITY_MATRIX_ITEMS_QUERY } from '../../../graphql/functionalityMatrixOperations';
import {
  ADD_PROJECT_DOCUMENT_ASSET_MUTATION,
  DELETE_PROJECT_DOCUMENT_ASSET_MUTATION,
  DELETE_PROJECT_DOCUMENT_MUTATION,
  PROJECT_DOCUMENT_ASSETS_QUERY,
  PROJECT_DOCUMENTS_QUERY,
  RISK_REGISTER_ITEMS_QUERY,
  UPSERT_PROJECT_DOCUMENT_MUTATION,
} from '../../../graphql/projectAdminOperations';
import { REQUIREMENT_ITEMS_QUERY } from '../../../graphql/taliaRequirementLogOperations';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import { VIEW_DETAILS, VIEW_FILTERS, VIEW_PROVENANCE } from '../../../lib/componentOptionsCatalog';
import { importDocumentFile, textToMarkdown } from '../../../lib/documentImport';
import { getPdfJs } from '../../../lib/documentPdf';
import { assetIdsInMarkdown } from '../../../lib/markdownLite';
import { buildProjectDocumentExport, nextDocumentReference } from '../../../lib/projectDocument';
import { downloadJson } from '../../../lib/riskRegister';
import usePanelTrackedFetch from '../../../hooks/usePanelTrackedFetch';
import { canAccessPrivilegedPanels, normalizeRole } from '../../../utils/roleUtils';
import PanelDataState from '../../shared/PanelDataState';
import DocumentRepositoryPresenter from './DocumentRepositoryPresenter';

const DOCUMENT_OPTIONS = {
  views: [
    VIEW_FILTERS,
    { ...VIEW_DETAILS, default: true },
    VIEW_PROVENANCE,
  ],
  operations: [],
};

const COMPONENT = 'DocumentRepository';
const MAX_IMAGE_BYTES = 1_200_000;

export const emptyDocumentForm = (referenceCode = '') => ({
  referenceCode,
  title: '',
  body: '',
  isStarred: false,
  links: [],
});

const formFromItem = (item) => ({
  referenceCode: item?.referenceCode || '',
  title: item?.title || '',
  body: item?.body || '',
  isStarred: Boolean(item?.isStarred),
  links: item?.links || [],
});

const readFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(reader.error || new Error('Could not read the image'));
  reader.readAsDataURL(file);
});

const DocumentRepositoryContainer = ({ panelInstanceId = null, panelComponentId = null }) => {
  const { user } = useSupabaseAuth();
  const role = normalizeRole(user?.role || 'USER');
  const allowed = canAccessPrivilegedPanels(role);
  const {
    viewsState,
    showFilters,
    showDetails,
    showProvenance,
    reportShellClassName,
  } = useReportShellOptions(panelComponentId || 'document-repository', panelInstanceId, DOCUMENT_OPTIONS);
  void viewsState;

  const [items, setItems] = useState([]);
  const [catalogs, setCatalogs] = useState({ requirement: [], matrix: [], risk: [] });
  const [assets, setAssets] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [drafting, setDrafting] = useState(false);
  const [form, setForm] = useState(() => emptyDocumentForm());
  const [titleFilter, setTitleFilter] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
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
      const [docData, logData, matrixData, riskData] = await Promise.all([
        fetchGraphql({
          query: PROJECT_DOCUMENTS_QUERY,
          component: panelComponentId || COMPONENT,
          purpose: 'Load project documents',
          tableName: 'project_document',
        }),
        fetchGraphql({
          query: REQUIREMENT_ITEMS_QUERY,
          variables: { filters: { includeDone: true, limit: 2000 } },
          component: panelComponentId || COMPONENT,
          purpose: 'Load requirements for document links',
          tableName: 'talia_requirement_item',
        }),
        fetchGraphql({
          query: FUNCTIONALITY_MATRIX_ITEMS_QUERY,
          component: panelComponentId || COMPONENT,
          purpose: 'Load matrix cells for document links',
          tableName: 'functionality_matrix_item',
        }),
        fetchGraphql({
          query: RISK_REGISTER_ITEMS_QUERY,
          component: panelComponentId || COMPONENT,
          purpose: 'Load risks for document links',
          tableName: 'risk_register_item',
        }),
      ]);
      setItems(Array.isArray(docData?.projectDocuments) ? docData.projectDocuments : []);
      setCatalogs({
        requirement: (logData?.requirementItems || []).map((item) => ({ id: item.id, label: item.title })),
        matrix: (matrixData?.functionalityMatrixItems || []).map((item) => ({
          id: item.id,
          label: `${item.referenceCode} ${item.shortName}`,
        })),
        risk: (riskData?.riskRegisterItems || []).map((item) => ({
          id: item.id,
          label: `${item.referenceCode} ${item.title}`,
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

  const assetsRef = useRef({});
  assetsRef.current = assets;

  useEffect(() => {
    const ids = assetIdsInMarkdown(selected?.body).filter((id) => !assetsRef.current[id]);
    if (!ids.length) return undefined;
    if (shouldSkipRefresh()) return undefined;
    let cancelled = false;
    fetchGraphql({
      query: PROJECT_DOCUMENT_ASSETS_QUERY,
      variables: { ids },
      component: panelComponentId || COMPONENT,
      purpose: 'Load document images',
      tableName: 'project_document_asset',
    }).then((data) => {
      if (cancelled) return;
      const next = {};
      (data?.projectDocumentAssets || []).forEach((asset) => {
        if (asset?.id && asset.contentBase64) {
          next[asset.id] = `data:${asset.mimeType};base64,${asset.contentBase64}`;
        }
      });
      setAssets((current) => ({ ...current, ...next }));
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fetchGraphql, panelComponentId, selected?.body, shouldSkipRefresh]);

  const visibleItems = useMemo(() => {
    const needle = titleFilter.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => `${item.referenceCode} ${item.title}`.toLowerCase().includes(needle));
  }, [items, titleFilter]);

  const openItem = (item) => {
    setDrafting(false);
    setSelectedId(item.id);
    setForm(formFromItem(item));
    setMessage(null);
  };

  const startDraft = () => {
    setDrafting(true);
    setSelectedId(null);
    setForm(emptyDocumentForm(nextDocumentReference(items)));
    setMessage(null);
  };

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const persistDocument = async (formValues, { id = null, successMessage = 'Saved' } = {}) => {
    const input = {
      ...(id ? { id } : {}),
      referenceCode: formValues.referenceCode,
      title: formValues.title,
      body: formValues.body,
      isStarred: Boolean(formValues.isStarred),
      links: (formValues.links || []).map((link) => ({
        targetKind: link.targetKind,
        targetId: link.targetId,
      })),
    };
    const data = await fetchGraphql({
      query: UPSERT_PROJECT_DOCUMENT_MUTATION,
      variables: { input },
      component: panelComponentId || COMPONENT,
      purpose: 'Save project document',
      tableName: 'project_document',
    });
    const saved = data?.upsertProjectDocument;
    setDrafting(false);
    if (saved?.id) {
      setSelectedId(saved.id);
      setForm(formFromItem(saved));
    } else {
      setForm(formValues);
    }
    setMessage(successMessage);
    await loadItems();
    return saved;
  };

  const applyImportedMarkdown = async (result) => {
    const nextForm = {
      referenceCode: nextDocumentReference(items),
      title: result?.title || 'Imported document',
      body: result?.body || '',
      isStarred: false,
      links: [],
    };
    setPasteOpen(false);
    setPasteText('');
    setForm(nextForm);
    setDrafting(true);
    setSelectedId(null);

    if (result?.emptyExtract) {
      setMessage('No extractable text in that PDF — paste the content instead.');
      return;
    }
    if (!String(result?.body || '').trim()) {
      setMessage('Import produced an empty body — paste the content or try another file.');
      return;
    }

    await persistDocument(nextForm, {
      successMessage: 'Imported and saved as Markdown — selected in the list.',
    });
  };

  const importFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await importDocumentFile(file, getPdfJs());
      await applyImportedMarkdown(result);
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setMessage(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const convertPaste = async () => {
    const raw = pasteText.trim();
    if (!raw) {
      setMessage('Paste some text first.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await applyImportedMarkdown(textToMarkdown(raw));
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setMessage(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const reformatBody = async () => {
    const raw = String(form.body || '').trim();
    if (!raw) {
      setMessage('Nothing to reformat.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const converted = textToMarkdown(raw, { suggestedTitle: form.title });
      const nextForm = {
        ...form,
        title: form.title || converted.title,
        body: converted.body,
      };
      setForm(nextForm);
      if (selected?.id && !drafting) {
        await persistDocument(nextForm, {
          id: selected.id,
          successMessage: 'Reformatted body as Markdown and saved.',
        });
      } else {
        setMessage('Reformatted as Markdown — Save to keep it.');
      }
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setMessage(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await persistDocument(form, {
        id: selected && !drafting ? selected.id : null,
        successMessage: 'Saved',
      });
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setMessage(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleStar = async (item) => {
    if (!item?.id) return;
    const nextStarred = !item.isStarred;
    setBusy(true);
    setMessage(null);
    setItems((current) => current.map((row) => (
      row.id === item.id ? { ...row, isStarred: nextStarred } : row
    )));
    if (selectedId === item.id) {
      setForm((current) => ({ ...current, isStarred: nextStarred }));
    }
    try {
      await fetchGraphql({
        query: UPSERT_PROJECT_DOCUMENT_MUTATION,
        variables: {
          input: {
            id: item.id,
            referenceCode: item.referenceCode,
            title: item.title,
            body: item.body,
            isStarred: nextStarred,
          },
        },
        component: panelComponentId || COMPONENT,
        purpose: nextStarred ? 'Star project document' : 'Unstar project document',
        tableName: 'project_document',
      });
      await loadItems();
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setMessage(err?.message || String(err));
      await loadItems();
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async () => {
    if (!selected?.id) return;
    if (!window.confirm(`Delete ${selected.referenceCode}?`)) return;
    setBusy(true);
    try {
      await fetchGraphql({
        query: DELETE_PROJECT_DOCUMENT_MUTATION,
        variables: { id: selected.id },
        component: panelComponentId || COMPONENT,
        purpose: 'Delete project document',
        tableName: 'project_document',
      });
      setSelectedId(null);
      setDrafting(false);
      setForm(emptyDocumentForm());
      await loadItems();
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setMessage(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const addImage = async (file) => {
    if (!selected?.id || drafting) {
      setMessage('Save the document before adding an image.');
      return;
    }
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setMessage('Image must be under 1.2 MB.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const contentBase64 = await readFile(file);
      const data = await fetchGraphql({
        query: ADD_PROJECT_DOCUMENT_ASSET_MUTATION,
        variables: {
          documentId: selected.id,
          filename: file.name,
          mimeType: file.type,
          contentBase64,
        },
        component: panelComponentId || COMPONENT,
        purpose: 'Add document image',
        tableName: 'project_document_asset',
      });
      const markdown = data?.addProjectDocumentAsset?.markdown;
      if (markdown) {
        const nextBody = `${form.body || ''}${form.body ? '\n\n' : ''}${markdown}\n`;
        updateForm('body', nextBody);
        await fetchGraphql({
          query: UPSERT_PROJECT_DOCUMENT_MUTATION,
          variables: {
            input: {
              id: selected.id,
              referenceCode: form.referenceCode,
              title: form.title,
              body: nextBody,
              links: (form.links || []).map((link) => ({
                targetKind: link.targetKind,
                targetId: link.targetId,
              })),
            },
          },
          component: panelComponentId || COMPONENT,
          purpose: 'Save document image reference',
          tableName: 'project_document',
        });
      }
      await loadItems();
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setMessage(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const removeAsset = async (assetId) => {
    setBusy(true);
    try {
      await fetchGraphql({
        query: DELETE_PROJECT_DOCUMENT_ASSET_MUTATION,
        variables: { id: assetId },
        component: panelComponentId || COMPONENT,
        purpose: 'Delete document image',
        tableName: 'project_document_asset',
      });
      await loadItems();
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setMessage(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!allowed) {
    return (
      <div className="focus-panel-empty">
        <p>Admin or Super User access required for Documents.</p>
      </div>
    );
  }

  return (
    <PanelDataState
      loading={loading && items.length === 0 && !error}
      loadingMessage="Loading documents..."
      error={error && items.length === 0 ? error : null}
      errorTitle="Failed to load documents"
      empty={false}
      onRetry={loadItems}
    >
      <DocumentRepositoryPresenter
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId || 'document-repository'}
        reportShellClassName={reportShellClassName}
        showFilters={showFilters}
        showDetails={showDetails}
        showProvenance={showProvenance}
        items={visibleItems}
        totalCount={items.length}
        titleFilter={titleFilter}
        onTitleFilter={setTitleFilter}
        catalogs={catalogs}
        assets={assets}
        selectedId={selectedId}
        selected={selected}
        drafting={drafting}
        form={form}
        busy={busy}
        message={message}
        onSelect={openItem}
        onToggleStar={toggleStar}
        onNew={startDraft}
        onImportFile={importFile}
        onOpenPaste={() => { setPasteOpen(true); setMessage(null); }}
        pasteOpen={pasteOpen}
        pasteText={pasteText}
        onPasteTextChange={setPasteText}
        onConvertPaste={convertPaste}
        onClosePaste={() => { setPasteOpen(false); setPasteText(''); }}
        onReformatBody={reformatBody}
        onFormChange={updateForm}
        onLinksChange={(links) => updateForm('links', links)}
        onSave={save}
        onDelete={removeItem}
        onAddImage={addImage}
        onDeleteAsset={removeAsset}
        onExportAll={() => downloadJson(
          buildProjectDocumentExport(items),
          `project-documents-${new Date().toISOString().slice(0, 10)}.json`,
        )}
        onRefresh={loadItems}
      />
    </PanelDataState>
  );
};

export default DocumentRepositoryContainer;
