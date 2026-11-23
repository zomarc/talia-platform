/**
 * Place Holder — wireframe ideas canvas for workshop discussions.
 * Blocks persist per dock instance via component option `wireframeDoc`.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSupabaseAuth } from '../../../contexts/SupabaseAuthContext';
import { UPSERT_REQUIREMENT_ITEM_MUTATION } from '../../../graphql/taliaRequirementLogOperations';
import { useComponentOptions } from '../../../hooks/useComponentOptions';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import usePanelTrackedFetch from '../../../hooks/usePanelTrackedFetch';
import {
  addBlockToDoc,
  moveBlockInDoc,
  parseWireframeDoc,
  removeBlockFromDoc,
  serializeWireframeDoc,
  summarizeWireframeBlock,
  summarizeWireframeDoc,
  updateBlockInDoc,
} from '../../../lib/placeholderWireframeDoc';
import { canAccessPrivilegedPanels, normalizeRole } from '../../../utils/roleUtils';
import PlaceHolderPresenter from './PlaceHolderPresenter';

const COMPONENT_ID = 'ui-placeholder';
const WIREFRAME_DOC_VIEW = 'wireframeDoc';

const viewValue = (views, id, fallback) => {
  const entry = (views || []).find((view) => view.id === id);
  if (!entry || entry.value == null) return fallback;
  return entry.value;
};

const PlaceHolderContainer = ({ panelInstanceId = null, panelComponentId = null }) => {
  const componentId = panelComponentId || COMPONENT_ID;
  const { user } = useSupabaseAuth();
  const role = normalizeRole(user?.role || 'USER');
  const canPromote = canAccessPrivilegedPanels(role);

  const { views, setView, viewsState, hydrated } = useComponentOptions(
    componentId,
    null,
    panelInstanceId
  );
  const { showProvenance } = useReportShellOptions(componentId, panelInstanceId);

  const caption = String(viewValue(views, 'caption', 'Place Holder')).trim() || 'Place Holder';
  const showWireframe = viewValue(views, 'wireframe', true) !== false;

  const doc = useMemo(
    () => parseWireframeDoc(viewsState?.[WIREFRAME_DOC_VIEW]),
    [viewsState]
  );

  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [promoting, setPromoting] = useState(false);
  const [promoteMessage, setPromoteMessage] = useState(null);

  const { fetchGraphql } = usePanelTrackedFetch(panelInstanceId, componentId);

  useEffect(() => {
    if (!hydrated) return;
    if (selectedBlockId && doc.blocks.some((b) => b.id === selectedBlockId)) return;
    setSelectedBlockId(doc.blocks[0]?.id || null);
  }, [doc.blocks, hydrated, selectedBlockId]);

  const persistDoc = useCallback((nextDoc) => {
    setView(WIREFRAME_DOC_VIEW, serializeWireframeDoc(nextDoc));
  }, [setView]);

  const onAddBlock = useCallback((type) => {
    const next = addBlockToDoc(doc, type);
    persistDoc(next);
    const added = next.blocks[next.blocks.length - 1];
    if (added) setSelectedBlockId(added.id);
  }, [doc, persistDoc]);

  const onUpdateBlock = useCallback((blockId, patch) => {
    persistDoc(updateBlockInDoc(doc, blockId, patch));
  }, [doc, persistDoc]);

  const onMoveBlock = useCallback((blockId, direction) => {
    persistDoc(moveBlockInDoc(doc, blockId, direction));
  }, [doc, persistDoc]);

  const onRemoveBlock = useCallback((blockId) => {
    const next = removeBlockFromDoc(doc, blockId);
    persistDoc(next);
    if (selectedBlockId === blockId) {
      setSelectedBlockId(next.blocks[0]?.id || null);
    }
  }, [doc, persistDoc, selectedBlockId]);

  const promoteRequirement = useCallback(async ({ title, detail, sourceRef }) => {
    if (!canPromote) return;
    setPromoting(true);
    setPromoteMessage(null);
    try {
      await fetchGraphql({
        query: UPSERT_REQUIREMENT_ITEM_MUTATION,
        variables: {
          input: {
            section: 'deliverable',
            title: String(title || 'Wireframe idea').slice(0, 200),
            detail: String(detail || ''),
            status: 'backlog',
            priority: 'p1',
            area: 'ui',
            source: 'cursor',
            sourceRef: String(sourceRef || '').slice(0, 200),
          },
        },
        component: componentId,
        purpose: 'Promote Place Holder wireframe to requirements',
        tableName: 'talia_requirement_item',
      });
      setPromoteMessage({ ok: true, text: 'Added to Requirements Log (backlog).' });
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') {
        setPromoteMessage({ ok: false, text: 'Panel paused — resume to promote.' });
        return;
      }
      setPromoteMessage({ ok: false, text: err?.message || 'Promote failed.' });
    } finally {
      setPromoting(false);
    }
  }, [canPromote, componentId, fetchGraphql]);

  const onPromotePanel = useCallback(() => {
    const ref = `placeholder:${panelInstanceId || 'panel'}:panel`;
    return promoteRequirement({
      title: caption,
      detail: summarizeWireframeDoc(doc, caption),
      sourceRef: ref,
    });
  }, [caption, doc, panelInstanceId, promoteRequirement]);

  const onPromoteBlock = useCallback((blockId) => {
    const block = doc.blocks.find((b) => b.id === blockId);
    if (!block) return undefined;
    const ref = `placeholder:${panelInstanceId || 'panel'}:${block.id}`;
    return promoteRequirement({
      title: block.title || caption,
      detail: summarizeWireframeBlock(block),
      sourceRef: ref,
    });
  }, [caption, doc.blocks, panelInstanceId, promoteRequirement]);

  return (
    <PlaceHolderPresenter
      panelInstanceId={panelInstanceId}
      panelComponentId={componentId}
      doc={doc}
      selectedBlockId={selectedBlockId}
      showWireframe={showWireframe}
      caption={caption}
      canPromote={canPromote}
      promoteMessage={promoteMessage}
      promoting={promoting}
      onSelectBlock={setSelectedBlockId}
      onAddBlock={onAddBlock}
      onUpdateBlock={onUpdateBlock}
      onMoveBlock={onMoveBlock}
      onRemoveBlock={onRemoveBlock}
      onPromotePanel={onPromotePanel}
      onPromoteBlock={onPromoteBlock}
      showProvenance={showProvenance}
    />
  );
};

export default PlaceHolderContainer;
