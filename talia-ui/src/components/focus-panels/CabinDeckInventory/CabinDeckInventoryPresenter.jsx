/**
 * Cabin Deck Inventory Presenter — deck/category cabin blocks with ownership highlights.
 * Summary + legend under Details (≣). GTY Allocate is a local concept preview only.
 * Cabin/GTY detail uses shared HoverPreview (Appearance delay/opacity) + CabinDeckHoverSummary.
 * No customer/PII display.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReportDataDetails from '../../shared/ReportDataDetails';
import HoverPreview from '../../shared/HoverPreview';
import CabinDeckHoverSummary from '../../shared/CabinDeckHoverSummary';
import { usePanelDetailsVisibility } from '../../../hooks/usePanelDetailsVisibility';
import { clipAnchorRectToViewport } from '../../../lib/clipAnchorRect';
import { ALLOCATE_MODE, allocateGtyPreview } from './cabinDeckAllocate.js';
import { findCabinItemForReservation } from './cabinDeckInventoryTransform.js';
import {
  emitCabinClear,
  emitCabinSelect,
  CABIN_CLEAR_EVENT,
  RESERVATION_CLEAR_EVENT,
  RESERVATION_SELECT_EVENT,
} from '../../../lib/eventBus';
import { isFitOwner, isGroupOwner } from '../../../lib/shipInventoryAlloc.js';

const STATUS_LEGEND = [
  { key: 'fit', label: 'FIT', hint: 'res_id owner' },
  { key: 'group', label: 'Group', hint: 'group_id owner · ring = no delegate' },
  { key: 'gty', label: 'GTY', hint: 'booked, no cabin' },
  { key: 'gty-fit', label: 'GTY fit', hint: 'local allocate preview' },
  { key: 'empty', label: 'Empty', hint: 'physical, unallocated' },
  { key: 'assigned', label: 'Other', hint: 'other owner type' },
];

const probabilityStyle = (item) => {
  if (item?.owner_kind !== 'group' && item?.status_key !== 'gty' && item?.status_key !== 'gty-fit') {
    return undefined;
  }
  if (item?.probability == null || !Number.isFinite(Number(item.probability))) return undefined;
  const p = Math.max(0, Math.min(100, Number(item.probability))) / 100;
  // Softer fill when probability is lower (group holds may not be “real”).
  return { opacity: 0.35 + (p * 0.65) };
};

const cabinItemKey = (item) => {
  if (!item) return null;
  if (item.cabin_number != null && String(item.cabin_number).trim() !== '') {
    return `cabin:${String(item.cabin_number).trim()}`;
  }
  if (item.allocation_id != null) return `alloc:${item.allocation_id}`;
  return `gty:${item.allocation_owner_id ?? ''}:${item.cabin_category ?? ''}:${item.status_key ?? ''}`;
};

const resolveCabinResId = (item) => {
  if (!item || item.is_empty) return null;
  if (item.dlgt_res_id != null) return item.dlgt_res_id;
  if (isFitOwner(item.allocation_owner_type) && item.allocation_owner_id != null) {
    return item.allocation_owner_id;
  }
  return null;
};

const resolveCabinGroupId = (item) => {
  if (!item || item.is_empty) return null;
  if (isGroupOwner(item.allocation_owner_type) && item.allocation_owner_id != null) {
    return item.allocation_owner_id;
  }
  return null;
};

const buildCabinSelectDetail = (item, scope = {}) => {
  const resId = resolveCabinResId(item);
  const groupId = resolveCabinGroupId(item);
  return {
    sail_code: scope.referenceSailCode || null,
    reference_sail_code: scope.referenceSailCode || null,
    ship_code: scope.shipCode || null,
    ship_name: scope.shipName || null,
    sail_date_from: scope.sailDateFrom || null,
    cabin_number: item?.cabin_number || null,
    cabin_category: item?.cabin_category || item?.link_cabin_category || null,
    allocation_id: item?.allocation_id ?? null,
    allocation_owner_type: item?.allocation_owner_type || null,
    allocation_owner_id: item?.allocation_owner_id ?? null,
    dlgt_res_id: item?.dlgt_res_id ?? null,
    res_id: resId,
    group_id: groupId,
    probability: item?.probability ?? null,
    status_key: item?.status_key || null,
    is_empty: Boolean(item?.is_empty),
    is_gty: item?.status_key === 'gty' || Boolean(item?.is_gty),
    row_data: item || null,
    timestamp: new Date().toISOString(),
    source: 'cabin-deck-inventory',
  };
};
const CabinChip = ({
  item,
  compact,
  selected = false,
  itemKey = null,
  onSelect,
  onHoverStart,
  onHoverEnd,
}) => (
  <button
    type="button"
    className={[
      'cabin-deck__chip',
      `cabin-deck__chip--${item.status_key}`,
      compact ? 'cabin-deck__chip--compact' : '',
      item.missing_dlgt ? 'cabin-deck__chip--missing-dlgt' : '',
      selected ? 'cabin-deck__chip--selected' : '',
    ].filter(Boolean).join(' ')}
    style={probabilityStyle(item)}
    data-cabin-key={itemKey || undefined}
    aria-pressed={selected}
    onMouseEnter={(event) => {
      onHoverStart?.(item, event.currentTarget);
    }}
    onMouseLeave={() => {
      onHoverEnd?.();
    }}
    onFocus={(event) => {
      onHoverStart?.(item, event.currentTarget);
    }}
    onBlur={() => {
      onHoverEnd?.();
    }}
    onClick={(event) => {
      event.stopPropagation();
      onSelect?.(item, event.currentTarget);
    }}
    aria-label={item.cabin_number
      ? `Cabin ${item.cabin_number} details`
      : `GTY ${item.owner_label || 'hold'} details`}
  >
    {!compact && (
      <>
        <span className="cabin-deck__chip-cabin">{item.cabin_number || '—'}</span>
        <span className="cabin-deck__chip-owner">
          {item.is_empty ? 'Empty' : item.owner_label}
        </span>
      </>
    )}
  </button>
);

const GtyChip = ({
  item,
  compact,
  selected = false,
  itemKey = null,
  onSelect,
  onHoverStart,
  onHoverEnd,
}) => (
  <button
    type="button"
    className={[
      'cabin-deck__chip',
      'cabin-deck__chip--gty',
      compact ? 'cabin-deck__chip--compact' : '',
      item.missing_dlgt ? 'cabin-deck__chip--missing-dlgt' : '',
      selected ? 'cabin-deck__chip--selected' : '',
    ].filter(Boolean).join(' ')}
    style={probabilityStyle(item)}
    data-cabin-key={itemKey || undefined}
    aria-pressed={selected}
    onMouseEnter={(event) => {
      onHoverStart?.(item, event.currentTarget);
    }}
    onMouseLeave={() => {
      onHoverEnd?.();
    }}
    onFocus={(event) => {
      onHoverStart?.(item, event.currentTarget);
    }}
    onBlur={() => {
      onHoverEnd?.();
    }}
    onClick={(event) => {
      event.stopPropagation();
      onSelect?.(item, event.currentTarget);
    }}
    aria-label={`GTY ${item.owner_label || 'hold'} details`}
  >
    {!compact && (
      <>
        <span className="cabin-deck__chip-cabin">GTY</span>
        <span className="cabin-deck__chip-owner">{item.owner_label}</span>
      </>
    )}
  </button>
);

const CategoryRow = ({
  category,
  cabins,
  compact,
  bookedCount,
  emptyCount,
  overAlloc = 0,
  selectedKey = null,
  onSelectCabin,
  onHoverCabinStart,
  onHoverCabinEnd,
}) => (
  <div className={`cabin-deck__category ${overAlloc > 0 ? 'cabin-deck__category--over-alloc' : ''}`}>
    <div
      className={`cabin-deck__category-label ${compact ? 'cabin-deck__category-label--inline' : ''}`}
      title={`${category}: ${bookedCount} booked, ${emptyCount} empty${overAlloc ? `, ${overAlloc} GTY over` : ''}`}
    >
      {compact ? (
        <span className="cabin-deck__category-inline">
          {category}
          <span className="cabin-deck__category-count"> ({cabins.length}{overAlloc > 0 ? ` · +${overAlloc}` : ''})</span>
        </span>
      ) : (
        <>
          <span className="cabin-deck__category-code">{category}</span>
          <span className="cabin-deck__category-count">
            {cabins.length}
            {overAlloc > 0 ? ` · +${overAlloc} over` : ''}
          </span>
        </>
      )}
    </div>
    <div className="cabin-deck__chips">
      {cabins.map((item) => (
        <CabinChip
          key={`${item.cabin_number}-${item.allocation_id || item.status_key}-${item.is_gty_fit ? 'fit' : 'base'}`}
          item={item}
          compact={compact}
          itemKey={cabinItemKey(item)}
          selected={selectedKey != null && cabinItemKey(item) === selectedKey}
          onSelect={onSelectCabin}
          onHoverStart={onHoverCabinStart}
          onHoverEnd={onHoverCabinEnd}
        />
      ))}
    </div>
  </div>
);

const formatDelta = (delta) => {
  if (delta == null) return '—';
  return `${delta > 0 ? '+' : ''}${delta}`;
};

const CabinDeckInventoryPresenter = ({
  bundle,
  hasSailSelection,
  scopeLoading = false,
  selectedReferenceSailCode = null,
  selectedSailCodes = [],
  shipCode = null,
  shipName = null,
  sailDateFrom = null,
  truncations = [],
  softErrors = [],
  reconciliationLoading = false,
  panelInstanceId = null,
  panelComponentId = null,
}) => {
  const [compactBlocks, setCompactBlocks] = useState(true);
  const [allocateMode, setAllocateMode] = useState(null);
  const [cabinPreview, setCabinPreview] = useState(null);
  const [selectedCabinKey, setSelectedCabinKey] = useState(null);
  const [reservationHighlight, setReservationHighlight] = useState(null); // { resId, cabinLabel, missed }
  const panelRef = useRef(null);
  const contentRef = useRef(null);
  const hadCabinSelectionRef = useRef(false);
  const selectionOriginRef = useRef(null); // 'local' | 'reservation'
  const reservationDetailRef = useRef(null);
  const allocateModeRef = useRef(null);
  const bundleRef = useRef(bundle);
  const cabinScopeRef = useRef(null);
  const selectedCabinKeyRef = useRef(null);
  bundleRef.current = bundle;
  allocateModeRef.current = allocateMode;
  selectedCabinKeyRef.current = selectedCabinKey;
  const [showDetails] = usePanelDetailsVisibility({
    panelInstanceId,
    panelComponentId,
  });

  const allocateResult = useMemo(
    () => (allocateMode && bundle ? allocateGtyPreview(bundle, { mode: allocateMode }) : null),
    [allocateMode, bundle]
  );

  const displayBundle = allocateResult || bundle;
  const displayBundleRef = useRef(displayBundle);
  displayBundleRef.current = displayBundle;

  const cabinScope = {
    referenceSailCode: selectedReferenceSailCode,
    shipCode,
    shipName,
    sailDateFrom,
  };
  cabinScopeRef.current = cabinScope;

  const clearCabinSelection = ({ emitClear = true, clearReservationDetail = true } = {}) => {
    setSelectedCabinKey(null);
    setReservationHighlight(null);
    if (clearReservationDetail) reservationDetailRef.current = null;
    if (hadCabinSelectionRef.current) {
      hadCabinSelectionRef.current = false;
      selectionOriginRef.current = null;
      // User deselect (local or reservation-driven highlight) → cabin.clear cascades to
      // reservation.clear + agency.clear so linked panels revert to sail scope.
      if (emitClear) {
        const scope = cabinScopeRef.current || {};
        emitCabinClear({
          sail_code: scope.referenceSailCode || null,
          reference_sail_code: scope.referenceSailCode || null,
          ship_code: scope.shipCode || null,
          source: 'cabin-deck-inventory',
          timestamp: new Date().toISOString(),
        });
      }
      return;
    }
    selectionOriginRef.current = null;
  };

  const showCabinPreview = (item, chipEl) => {
    const chipRect = chipEl?.getBoundingClientRect?.() || null;
    const rect = clipAnchorRectToViewport(chipRect, panelRef.current);
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      setCabinPreview(null);
      return;
    }
    setCabinPreview({ item, rect });
  };

  const hideCabinPreview = () => {
    setCabinPreview(null);
  };

  const selectCabin = (item, chipEl) => {
    const key = cabinItemKey(item);
    if (key && key === selectedCabinKeyRef.current) {
      clearCabinSelection({ emitClear: true });
      hideCabinPreview();
      return;
    }
    showCabinPreview(item, chipEl);
    setSelectedCabinKey(key);
    setReservationHighlight(null);
    hadCabinSelectionRef.current = true;
    selectionOriginRef.current = 'local';
    reservationDetailRef.current = null;
    emitCabinSelect(buildCabinSelectDetail(item, cabinScopeRef.current || {}));
  };

  const resolveDisplayBundle = () => displayBundleRef.current || bundleRef.current || null;

  const resolveReservationDetail = (detail) => {
    if (detail && typeof detail === 'object') return detail;
    const last = window.lastReservationSelectEvent?.detail;
    if (!last || last.reason === 'cabin-select') return null;
    return last;
  };

  const highlightCabinFromReservation = (rawDetail) => {
    const detail = resolveReservationDetail(rawDetail);
    if (!detail) {
      setReservationHighlight(null);
      return false;
    }
    reservationDetailRef.current = detail;
    const resId = detail.res_id ?? detail.row_data?.res_id ?? null;
    const resLabel = resId != null && String(resId).trim() !== '' ? String(resId).trim() : null;
    const activeBundle = resolveDisplayBundle();
    if (!activeBundle) {
      // Keep pending — allocations may still be loading.
      selectionOriginRef.current = 'reservation';
      setSelectedCabinKey(null);
      setReservationHighlight(resLabel ? { resId: resLabel, cabinLabel: null, missed: false, pending: true } : null);
      return false;
    }
    const match = findCabinItemForReservation(activeBundle, detail);
    if (!match) {
      selectionOriginRef.current = 'reservation';
      hadCabinSelectionRef.current = false;
      setSelectedCabinKey(null);
      setReservationHighlight(resLabel
        ? { resId: resLabel, cabinLabel: null, missed: true, pending: false }
        : null);
      return false;
    }
    const key = cabinItemKey(match);
    setSelectedCabinKey(key);
    hadCabinSelectionRef.current = true;
    selectionOriginRef.current = 'reservation';
    setReservationHighlight({
      resId: resLabel,
      cabinLabel: match.cabin_number || (match.is_gty || match.status_key === 'gty' ? 'GTY' : null),
      missed: false,
      pending: false,
    });
    return true;
  };

  // Stable bus listeners — do not tear down on sailDateFrom / ship code churn.
  useEffect(() => {
    const handleReservationSelect = (event) => {
      // Ignore reservation selects that we just emitted from a cabin click.
      if (event?.detail?.reason === 'cabin-select') return;
      highlightCabinFromReservation(event?.detail || {});
    };
    const clearFromBus = () => {
      clearCabinSelection({ emitClear: false });
      hideCabinPreview();
    };
    const handleReservationClear = () => {
      clearFromBus();
    };
    const handleCabinClear = (event) => {
      if (event?.detail?.source === 'cabin-deck-inventory') return;
      clearFromBus();
    };
    window.addEventListener(RESERVATION_SELECT_EVENT, handleReservationSelect);
    window.addEventListener(RESERVATION_CLEAR_EVENT, handleReservationClear);
    window.addEventListener(CABIN_CLEAR_EVENT, handleCabinClear);
    // Late join: apply whatever reservation is already on the bus.
    if (window.lastReservationSelectEvent?.detail?.reason !== 'cabin-select') {
      highlightCabinFromReservation(window.lastReservationSelectEvent?.detail || null);
    }
    return () => {
      window.removeEventListener(RESERVATION_SELECT_EVENT, handleReservationSelect);
      window.removeEventListener(RESERVATION_CLEAR_EVENT, handleReservationClear);
      window.removeEventListener(CABIN_CLEAR_EVENT, handleCabinClear);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only bus subscription
  }, []);

  // Reset local allocate + cabin selection when sailing identity changes (not date settle).
  useEffect(() => {
    setAllocateMode(null);
    // Sail change already clears cabin/reservation on the bus — only reset local UI.
    clearCabinSelection({ emitClear: false });
    hideCabinPreview();
    if (window.lastReservationSelectEvent?.detail?.reason !== 'cabin-select') {
      highlightCabinFromReservation(window.lastReservationSelectEvent?.detail || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sail/ship identity only
  }, [selectedReferenceSailCode, shipCode]);

  useEffect(() => () => {
    if (!hadCabinSelectionRef.current) return;
    if (selectionOriginRef.current !== 'local') {
      hadCabinSelectionRef.current = false;
      selectionOriginRef.current = null;
      return;
    }
    hadCabinSelectionRef.current = false;
    selectionOriginRef.current = null;
    emitCabinClear({
      source: 'cabin-deck-inventory',
      timestamp: new Date().toISOString(),
    });
  }, []);

  // Re-apply reservation highlight when deck data / allocate preview becomes available.
  useEffect(() => {
    if (selectionOriginRef.current === 'local') return;
    const detail = reservationDetailRef.current
      || (window.lastReservationSelectEvent?.detail?.reason === 'cabin-select'
        ? null
        : window.lastReservationSelectEvent?.detail);
    if (!detail) return;
    highlightCabinFromReservation(detail);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply when inventory payload changes
  }, [displayBundle, sailDateFrom]);

  useEffect(() => {
    if (!selectedCabinKey) return undefined;
    const root = contentRef.current || panelRef.current;
    if (!root) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const el = root.querySelector?.(
        `[data-cabin-key="${CSS.escape(selectedCabinKey)}"]`
      );
      if (!el) return;
      // Center in the cabin-deck scroll container (scrollIntoView often pins to edges
      // when the scrollport is a nested overflow:auto panel, not the window).
      const scrollParent = el.closest?.('.cabin-deck__content') || root;
      if (scrollParent && typeof scrollParent.scrollTop === 'number') {
        const parentRect = scrollParent.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const elCenterY = elRect.top + (elRect.height / 2);
        const parentCenterY = parentRect.top + (parentRect.height / 2);
        const nextTop = scrollParent.scrollTop + (elCenterY - parentCenterY);
        const maxTop = Math.max(0, scrollParent.scrollHeight - scrollParent.clientHeight);
        scrollParent.scrollTo({
          top: Math.max(0, Math.min(maxTop, nextTop)),
          behavior: 'smooth',
        });
        return;
      }
      el.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedCabinKey, compactBlocks, allocateMode, displayBundle]);

  const scopeLabel = selectedReferenceSailCode
    || (selectedSailCodes.length ? selectedSailCodes.join(', ') : null);
  const summary = bundle?.summary || {};
  const allocateActive = Boolean(allocateMode);
  const decks = allocateResult?.decks || bundle?.decks || [];
  const gtyHolds = allocateResult?.gtyHolds || bundle?.gtyHolds || [];
  const limitWarnings = truncations?.length
    ? truncations
    : (summary.truncations || []);
  const empty = hasSailSelection && !scopeLoading
    && summary.allocation_count === 0
    && (summary.physical_cabin_count || 0) === 0;
  const gtyTotal = summary.gty_count || 0;

  return (
    <div
      ref={panelRef}
      className="focus-panel talia-report cabin-deck-panel"
      role="region"
      aria-label="Cabin Deck Inventory"
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Cabin Deck Inventory</h2>
          <p className="talia-report__subtitle">
            {hasSailSelection
              ? [
                scopeLabel,
                shipName || shipCode,
                sailDateFrom,
              ].filter(Boolean).join(' · ')
              : 'Select a sailing in Master Sailing Explorer'}
          </p>
          {reservationHighlight?.resId ? (
            <p className={`cabin-deck__reservation-link ${reservationHighlight.missed ? 'cabin-deck__reservation-link--miss' : ''}`}>
              {reservationHighlight.pending
                ? `Waiting for cabin inventory for res ${reservationHighlight.resId}…`
                : reservationHighlight.missed
                  ? `No cabin allocation found for res ${reservationHighlight.resId}`
                  : `Res ${reservationHighlight.resId}${reservationHighlight.cabinLabel ? ` → cabin ${reservationHighlight.cabinLabel}` : ''}`}
            </p>
          ) : null}
        </div>
      </header>

      {hasSailSelection && (
        <div className="talia-report__actions-bar" aria-label="Cabin deck view">
          <button
            type="button"
            className={`talia-btn ${compactBlocks ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
            onClick={() => setCompactBlocks(true)}
            aria-pressed={compactBlocks}
          >
            Blocks
          </button>
          <button
            type="button"
            className={`talia-btn ${!compactBlocks ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
            onClick={() => setCompactBlocks(false)}
            aria-pressed={!compactBlocks}
          >
            Labels
          </button>
        </div>
      )}

      {hasSailSelection && !scopeLoading && gtyTotal > 0 && (
        <div className="talia-report__actions-bar" aria-label="GTY allocate preview">
          <button
            type="button"
            className={`talia-btn ${allocateMode === ALLOCATE_MODE.PRIORITY ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
            onClick={() => setAllocateMode(ALLOCATE_MODE.PRIORITY)}
            title="Place all GTY that fit — highest probability first (local preview)"
          >
            Allocate GTY
          </button>
          <button
            type="button"
            className={`talia-btn ${allocateMode === ALLOCATE_MODE.EXPECTED ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
            onClick={() => setAllocateMode(ALLOCATE_MODE.EXPECTED)}
            title="Place ~sum(probability) rooms per category — highest probability first (local preview)"
          >
            Allocate by probability
          </button>
          <button
            type="button"
            className="talia-btn talia-btn--secondary"
            onClick={() => setAllocateMode(null)}
            disabled={!allocateActive}
          >
            Clear allocation
          </button>
          {allocateActive && allocateResult && (
            <span className="cabin-deck__allocate-meta">
              {allocateMode === ALLOCATE_MODE.EXPECTED ? 'Expected' : 'Priority'}
              {' · '}
              placed {allocateResult.placementCount}
              {allocateResult.unplacedCount
                ? ` · ${allocateResult.unplacedCount} unplaced`
                : ''}
              {allocateResult.overAllocCategories?.length
                ? ` · over: ${allocateResult.overAllocCategories.join(', ')}`
                : ''}
            </span>
          )}
        </div>
      )}

      <main ref={contentRef} className="talia-report__content cabin-deck__content">
        {!hasSailSelection && (
          <p className="focus-panel-empty__detail">No sailing selected.</p>
        )}
        {hasSailSelection && scopeLoading && (
          <p className="focus-panel-empty__detail">Loading cabin allocations…</p>
        )}
        {hasSailSelection && !scopeLoading && (
          <>
            {limitWarnings.map((warning) => (
              <p
                key={`${warning.limit}-${warning.row_count}-${warning.source || ''}`}
                className="cabin-deck__limit-warning talia-callout"
                role="alert"
              >
                GraphQL limit hit: {warning.message}
              </p>
            ))}

            <ReportDataDetails
              visible={showDetails}
              as="section"
              className="cabin-deck__details"
              aria-label="Cabin deck inventory details"
            >
              <div className="cabin-deck__details-grid">
                <div className="cabin-deck__details-block">
                  <h3 className="cabin-deck__details-heading">Inventory</h3>
                  <dl className="cabin-deck__stats">
                    <div><dt>Assigned</dt><dd>{summary.assigned_count || 0}</dd></div>
                    <div><dt>Empty</dt><dd>{summary.empty_count || 0}</dd></div>
                    <div><dt>GTY holds</dt><dd>{summary.gty_count || 0}</dd></div>
                    <div><dt>Group no delegate</dt><dd>{summary.group_missing_dlgt || 0}</dd></div>
                    <div><dt>Alloc booked</dt><dd>{summary.booked_like_count || 0}</dd></div>
                    <div>
                      <dt>Occupancy</dt>
                      <dd>
                        {summary.occupancy_booked_cabins != null
                          ? `${summary.occupancy_booked_cabins}${summary.occupancy_total_cabins != null ? ` / ${summary.occupancy_total_cabins}` : ''}`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Δ vs occupancy</dt>
                      <dd>{formatDelta(summary.delta_vs_occupancy)}</dd>
                    </div>
                    <div>
                      <dt>Reservations</dt>
                      <dd>
                        {summary.reservation_count != null
                          ? `${summary.reservation_count} / ${Number(summary.reservation_guests || 0).toLocaleString()} guests`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Physical cabins</dt>
                      <dd>{summary.physical_cabin_count || 0}</dd>
                    </div>
                    <div>
                      <dt>Empties linked</dt>
                      <dd>{summary.empties_linked || 0}</dd>
                    </div>
                  </dl>
                  {reconciliationLoading && (
                    <p className="cabin-deck__details-note">Refreshing occupancy / reservation totals…</p>
                  )}
                </div>

                <div className="cabin-deck__details-block">
                  <h3 className="cabin-deck__details-heading">Legend</h3>
                  <ul className="cabin-deck__legend-list">
                    {STATUS_LEGEND.map((entry) => (
                      <li key={entry.key} className="cabin-deck__legend-row">
                        <span className={`cabin-deck__legend-swatch cabin-deck__chip--${entry.key}`} />
                        <span className="cabin-deck__legend-label">{entry.label}</span>
                        <span className="cabin-deck__legend-hint">{entry.hint}</span>
                      </li>
                    ))}
                    <li className="cabin-deck__legend-row">
                      <span className="cabin-deck__legend-swatch cabin-deck__chip--missing-dlgt-swatch" />
                      <span className="cabin-deck__legend-label">No delegate</span>
                      <span className="cabin-deck__legend-hint">inset ring on group without dlgt_res_id</span>
                    </li>
                  </ul>
                </div>

                <div className="cabin-deck__details-block cabin-deck__details-block--wide">
                  <h3 className="cabin-deck__details-heading">Sources</h3>
                  <ul className="cabin-deck__source-list">
                    <li>Physical cabins from <code>fou.SHIP_CABIN</code>.</li>
                    <li>Default category from <code>fou.SHIP_CABIN_CTG_LINK</code> (no customer fields).</li>
                    <li>Ownership from <code>stg.RES_CABIN_ALLOCATION_DETAIL</code> (FIT/Group/GTY · probability).</li>
                    <li>
                      GTY Allocate is local only — Priority fills highest probability first;
                      By probability places ~sum(p/100) rooms per category.
                    </li>
                    <li>PPD / upgrade recommendation and named-passenger signals are future work (no PII).</li>
                  </ul>
                  {softErrors.map((err, index) => (
                    <p key={`soft-${index}`} className="cabin-deck__soft-warning">
                      Reconciliation warning: {err?.message || String(err)}
                    </p>
                  ))}
                </div>
              </div>
            </ReportDataDetails>

            {empty && (
              <p className="focus-panel-empty__detail">
                No ship_cabin / ship_inventory_alloc rows for this ship
                {sailDateFrom ? ` / ${sailDateFrom}` : ''}.
              </p>
            )}

            {gtyHolds.length > 0 && (
              <section className="cabin-deck__gty" aria-label="GTY unassigned holds">
                <div className="cabin-deck__section-title">
                  {allocateActive ? 'GTY UNPLACED' : 'GTY ONLY'}
                  <span className="cabin-deck__deck-count">
                    {gtyHolds.reduce((sum, g) => sum + g.items.length, 0)} holds
                    {allocateActive ? ' · still unplaced' : ' · no cabin assigned'}
                  </span>
                </div>
                {gtyHolds.map((group) => (
                  <div key={group.category} className="cabin-deck__category">
                    <div className={`cabin-deck__category-label ${compactBlocks ? 'cabin-deck__category-label--inline' : ''}`}>
                      {compactBlocks ? (
                        <span className="cabin-deck__category-inline">
                          {group.category}
                          <span className="cabin-deck__category-count"> ({group.items.length})</span>
                        </span>
                      ) : (
                        <>
                          <span className="cabin-deck__category-code">{group.category}</span>
                          <span className="cabin-deck__category-count">{group.items.length}</span>
                        </>
                      )}
                    </div>
                    <div className="cabin-deck__chips">
                      {group.items.map((item, index) => (
                        <GtyChip
                          key={`${item.allocation_id || item.allocation_owner_id || index}-${index}`}
                          item={item}
                          compact={compactBlocks}
                          itemKey={cabinItemKey(item)}
                          selected={selectedCabinKey != null && cabinItemKey(item) === selectedCabinKey}
                          onSelect={selectCabin}
                          onHoverStart={showCabinPreview}
                          onHoverEnd={hideCabinPreview}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}

            <div className={`cabin-deck__decks ${compactBlocks ? 'cabin-deck__decks--compact' : ''}`}>
              {decks.map((deck) => (
                <section key={String(deck.deck)} className="cabin-deck__deck" aria-label={`Deck ${deck.deck}`}>
                  <div className="cabin-deck__section-title">
                    Deck {deck.deck}
                    <span className="cabin-deck__deck-count">
                      {deck.booked_count}/{deck.cabin_count}
                      {deck.empty_count ? ` · ${deck.empty_count} empty` : ''}
                    </span>
                  </div>
                  {deck.categories.map((cat) => (
                    <CategoryRow
                      key={cat.category}
                      category={cat.category}
                      cabins={cat.cabins}
                      compact={compactBlocks}
                      bookedCount={cat.booked_count}
                      emptyCount={cat.empty_count}
                      overAlloc={cat.over_alloc || 0}
                      selectedKey={selectedCabinKey}
                      onSelectCabin={selectCabin}
                      onHoverCabinStart={showCabinPreview}
                      onHoverCabinEnd={hideCabinPreview}
                    />
                  ))}
                </section>
              ))}
            </div>
          </>
        )}
      </main>

      <HoverPreview
        open={Boolean(cabinPreview?.item)}
        anchorRect={cabinPreview?.rect || null}
        placement="right"
        onRequestClose={hideCabinPreview}
      >
        {cabinPreview?.item ? (
          <CabinDeckHoverSummary item={cabinPreview.item} scope={cabinScope} />
        ) : null}
      </HoverPreview>
    </div>
  );
};

export default CabinDeckInventoryPresenter;
