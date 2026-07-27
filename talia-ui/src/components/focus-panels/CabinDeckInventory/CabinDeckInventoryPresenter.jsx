/**
 * Cabin Deck Inventory Presenter — deck/category cabin blocks with ownership highlights.
 * Summary + legend under Details (≣). GTY Allocate is a local concept preview only.
 * No customer/PII display.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReportDataDetails from '../../shared/ReportDataDetails';
import { usePanelDetailsVisibility } from '../../../hooks/usePanelDetailsVisibility';
import { allocateGtyPreview } from './cabinDeckAllocate.js';

const DETAIL_PANEL_WIDTH = 280;
const DETAIL_PANEL_EST_HEIGHT = 320;
const DETAIL_GAP = 8;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const resolveDetailPosition = (panelRect, chipRect) => {
  if (!panelRect || !chipRect) {
    return { top: DETAIL_GAP, left: DETAIL_GAP };
  }
  const maxLeft = Math.max(DETAIL_GAP, panelRect.width - DETAIL_PANEL_WIDTH - DETAIL_GAP);
  const maxTop = Math.max(DETAIL_GAP, panelRect.height - DETAIL_PANEL_EST_HEIGHT - DETAIL_GAP);
  const chipLeft = chipRect.left - panelRect.left;
  const chipTop = chipRect.top - panelRect.top;
  const chipRight = chipRect.right - panelRect.left;
  const chipBottom = chipRect.bottom - panelRect.top;

  // Prefer to the right of the chip; flip left if near the right edge.
  let left = chipRight + DETAIL_GAP;
  if (left > maxLeft) {
    left = chipLeft - DETAIL_PANEL_WIDTH - DETAIL_GAP;
  }
  left = clamp(left, DETAIL_GAP, maxLeft);

  // Prefer aligned to chip top; keep inside panel.
  const top = clamp(chipTop, DETAIL_GAP, maxTop);
  // If chip is near bottom and panel would clip, nudge above chip when possible.
  if (chipBottom + DETAIL_PANEL_EST_HEIGHT > panelRect.height && chipTop > DETAIL_PANEL_EST_HEIGHT) {
    return {
      top: clamp(chipBottom - DETAIL_PANEL_EST_HEIGHT, DETAIL_GAP, maxTop),
      left,
    };
  }
  return { top, left };
};

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

const buildDetailRows = (item) => ([
  { label: 'Cabin', value: item.cabin_number || '— (GTY / unassigned)' },
  { label: 'Category', value: item.cabin_category || null },
  {
    label: 'Link category',
    value: item.link_cabin_category && item.link_cabin_category !== item.cabin_category
      ? item.link_cabin_category
      : null,
  },
  { label: 'Deck', value: item.deck_number != null ? String(item.deck_number) : 'Unknown' },
  { label: 'Deck source', value: item.deck_source || null },
  { label: 'Status', value: item.status_label || null },
  { label: 'Owner', value: item.is_empty ? 'Empty / available' : (item.owner_label || null) },
  { label: 'Owner type', value: item.allocation_owner_type || null },
  { label: 'Owner id', value: item.allocation_owner_id != null ? String(item.allocation_owner_id) : null },
  { label: 'Probability', value: item.probability != null ? `${item.probability}%` : null },
  { label: 'Delegate res', value: item.dlgt_res_id != null ? String(item.dlgt_res_id) : null },
  { label: 'Missing delegate', value: item.missing_dlgt ? 'Yes' : null },
  { label: 'GTY fit preview', value: item.is_gty_fit ? 'Yes (local only)' : null },
  { label: 'Request type', value: item.inventory_request_type || null },
  { label: 'Result type', value: item.inventory_result_type || null },
  { label: 'Occupancy', value: item.occupancy != null ? String(item.occupancy) : null },
  { label: 'Price category', value: item.price_category || null },
  { label: 'Allocation id', value: item.allocation_id != null ? String(item.allocation_id) : null },
].filter((row) => row.value != null && String(row.value).trim() !== ''));

const CabinChip = ({ item, compact, onSelect }) => (
  <button
    type="button"
    className={[
      'cabin-deck__chip',
      `cabin-deck__chip--${item.status_key}`,
      compact ? 'cabin-deck__chip--compact' : '',
      item.missing_dlgt ? 'cabin-deck__chip--missing-dlgt' : '',
    ].filter(Boolean).join(' ')}
    style={probabilityStyle(item)}
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

const GtyChip = ({ item, compact, onSelect }) => (
  <button
    type="button"
    className={[
      'cabin-deck__chip',
      'cabin-deck__chip--gty',
      compact ? 'cabin-deck__chip--compact' : '',
      item.missing_dlgt ? 'cabin-deck__chip--missing-dlgt' : '',
    ].filter(Boolean).join(' ')}
    style={probabilityStyle(item)}
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
  onSelectCabin,
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
          onSelect={onSelectCabin}
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
  emptyCategoryMode = 'by_category',
  onEmptyCategoryModeChange = null,
  panelInstanceId = null,
  panelComponentId = null,
}) => {
  const [compactBlocks, setCompactBlocks] = useState(true);
  const [allocateActive, setAllocateActive] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailPosition, setDetailPosition] = useState({ top: 8, left: 8 });
  const panelRef = useRef(null);
  const detailPanelRef = useRef(null);
  const pendingChipRectRef = useRef(null);
  const [showDetails] = usePanelDetailsVisibility({
    panelInstanceId,
    panelComponentId,
  });

  const openCabinDetail = (item, chipEl) => {
    const panelRect = panelRef.current?.getBoundingClientRect?.() || null;
    const chipRect = chipEl?.getBoundingClientRect?.() || null;
    pendingChipRectRef.current = chipRect;
    setDetailPosition(resolveDetailPosition(panelRect, chipRect));
    setSelectedDetail(item);
  };

  useEffect(() => {
    if (!selectedDetail || !detailPanelRef.current || !panelRef.current) return undefined;
    const panelRect = panelRef.current.getBoundingClientRect();
    const chipRect = pendingChipRectRef.current;
    if (!chipRect) return undefined;
    const detailRect = detailPanelRef.current.getBoundingClientRect();
    const maxLeft = Math.max(DETAIL_GAP, panelRect.width - detailRect.width - DETAIL_GAP);
    const maxTop = Math.max(DETAIL_GAP, panelRect.height - detailRect.height - DETAIL_GAP);
    const chipLeft = chipRect.left - panelRect.left;
    const chipTop = chipRect.top - panelRect.top;
    const chipRight = chipRect.right - panelRect.left;
    let left = chipRight + DETAIL_GAP;
    if (left > maxLeft) left = chipLeft - detailRect.width - DETAIL_GAP;
    left = clamp(left, DETAIL_GAP, maxLeft);
    const top = clamp(chipTop, DETAIL_GAP, maxTop);
    setDetailPosition((prev) => (
      Math.abs(prev.top - top) < 1 && Math.abs(prev.left - left) < 1
        ? prev
        : { top, left }
    ));
    return undefined;
  }, [selectedDetail]);

  useEffect(() => {
    setAllocateActive(false);
    setSelectedDetail(null);
  }, [selectedReferenceSailCode, shipCode, sailDateFrom, emptyCategoryMode]);

  useEffect(() => {
    if (!selectedDetail) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedDetail(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedDetail]);

  const scopeLabel = selectedReferenceSailCode
    || (selectedSailCodes.length ? selectedSailCodes.join(', ') : null);
  const summary = bundle?.summary || {};
  const allocateResult = useMemo(
    () => (allocateActive && bundle ? allocateGtyPreview(bundle) : null),
    [allocateActive, bundle]
  );
  const decks = allocateResult?.decks || bundle?.decks || [];
  const gtyHolds = allocateResult?.gtyHolds || bundle?.gtyHolds || [];
  const limitWarnings = truncations?.length
    ? truncations
    : (summary.truncations || []);
  const empty = hasSailSelection && !scopeLoading
    && summary.allocation_count === 0
    && (summary.physical_cabin_count || 0) === 0;
  const gtyTotal = summary.gty_count || 0;
  const detailRows = selectedDetail ? buildDetailRows(selectedDetail) : [];

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
        </div>
      </header>

      {hasSailSelection && (
        <div className="talia-report__controls" aria-label="Cabin deck inventory controls">
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
          <button
            type="button"
            className={`talia-btn ${emptyCategoryMode === 'by_category' ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
            onClick={() => onEmptyCategoryModeChange?.('by_category')}
            aria-pressed={emptyCategoryMode === 'by_category'}
            title="Place empty cabins under ship_cabin_ctg_link category"
          >
            By category
          </button>
          <button
            type="button"
            className={`talia-btn ${emptyCategoryMode === 'open_bucket' ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
            onClick={() => onEmptyCategoryModeChange?.('open_bucket')}
            aria-pressed={emptyCategoryMode === 'open_bucket'}
            title="Keep empty cabins in a separate Open bucket"
          >
            Open bucket
          </button>
        </div>
      )}

      {hasSailSelection && !scopeLoading && gtyTotal > 0 && (
        <div className="talia-report__actions-bar" aria-label="GTY allocate preview">
          <button
            type="button"
            className={`talia-btn ${allocateActive ? 'talia-btn--primary' : 'talia-btn--secondary'}`}
            onClick={() => setAllocateActive(true)}
            disabled={allocateActive}
            title="Local preview only — does not write to Synapse"
          >
            Allocate GTY
          </button>
          <button
            type="button"
            className="talia-btn talia-btn--secondary"
            onClick={() => setAllocateActive(false)}
            disabled={!allocateActive}
          >
            Clear allocation
          </button>
          {allocateActive && allocateResult && (
            <span className="cabin-deck__allocate-meta">
              Preview · placed {allocateResult.placementCount}
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

      <main className="talia-report__content cabin-deck__content">
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
                    <li>Ownership from <code>stg.SHIP_INVENTORY_ALLOC</code> (FIT/Group/GTY · probability).</li>
                    <li>GTY Allocate is a local preview only — not written back.</li>
                    <li>Named-passenger star deferred — reservation/customer PII stays out of Talia.</li>
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
                          onSelect={openCabinDetail}
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
                      onSelectCabin={openCabinDetail}
                    />
                  ))}
                </section>
              ))}
            </div>
          </>
        )}
      </main>

      {selectedDetail && (
        <div className="cabin-deck__detail-overlay" role="presentation">
          <button
            type="button"
            className="cabin-deck__detail-backdrop"
            aria-label="Close cabin details"
            onClick={() => setSelectedDetail(null)}
          />
          <aside
            ref={detailPanelRef}
            className="cabin-deck__detail-panel talia-card"
            role="dialog"
            aria-modal="true"
            aria-label="Cabin allocation details"
            style={{
              top: `${Math.round(detailPosition.top)}px`,
              left: `${Math.round(detailPosition.left)}px`,
            }}
          >
            <div className="cabin-deck__detail-header">
              <h3 className="cabin-deck__detail-title">
                {selectedDetail.cabin_number
                  ? `Cabin ${selectedDetail.cabin_number}`
                  : (selectedDetail.owner_label || 'GTY hold')}
              </h3>
              <button
                type="button"
                className="talia-btn talia-btn--secondary cabin-deck__detail-close"
                onClick={() => setSelectedDetail(null)}
              >
                Close
              </button>
            </div>
            <dl className="cabin-deck__detail-list">
              {detailRows.map((row) => (
                <div key={row.label} className="cabin-deck__detail-row">
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      )}
    </div>
  );
};

export default CabinDeckInventoryPresenter;
