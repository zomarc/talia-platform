/**
 * Dense cabin / GTY hover card — presentational only.
 * Uses the same HoverPreview summary chrome as ReservationHoverSummary / MSE.
 * No customer/PII.
 */

import React from 'react';

const MetaRow = ({ label, children, muted = false }) => (
  <div className={`reservation-hover-summary__row${muted ? ' reservation-hover-summary__row--muted' : ''}`}>
    <span className="reservation-hover-summary__label">{label}</span>
    <span className="reservation-hover-summary__value">{children}</span>
  </div>
);

const ProbabilityMark = ({ pct }) => {
  const value = pct != null && Number.isFinite(Number(pct))
    ? Math.min(100, Math.max(0, Number(pct)))
    : null;
  return (
    <div
      className="reservation-hover-summary__prob"
      title={value != null ? `Probability ${Math.round(value)}%` : 'No probability'}
    >
      <div
        className="reservation-hover-summary__prob-ring"
        style={{ '--prob-pct': `${value != null ? value : 0}%` }}
      >
        <span className="reservation-hover-summary__prob-value">
          {value != null ? `${Math.round(value)}%` : '—'}
        </span>
      </div>
      <span className="reservation-hover-summary__prob-label">Prob</span>
    </div>
  );
};

/**
 * @param {{
 *   item: object | null,
 *   scope?: { referenceSailCode?: string | null, shipName?: string | null, shipCode?: string | null, sailDateFrom?: string | null },
 * }} props
 */
const CabinDeckHoverSummary = ({ item = null, scope = {} }) => {
  if (!item) {
    return (
      <div className="reservation-hover-summary" role="status">
        <p className="reservation-hover-summary__empty">No cabin detail</p>
      </div>
    );
  }

  const title = item.cabin_number
    ? `Cabin ${item.cabin_number}`
    : (item.owner_label || 'GTY hold');
  const category = item.cabin_category || item.link_cabin_category || null;
  const deckLabel = item.deck_number != null ? `Deck ${item.deck_number}` : null;
  const scopeLine = [
    scope.referenceSailCode,
    scope.shipName || scope.shipCode,
    scope.sailDateFrom,
  ].filter(Boolean).join(' · ');

  const ownershipRows = [
    { label: 'Owner', value: item.is_empty ? 'Empty / available' : (item.owner_label || null) },
    { label: 'Owner type', value: item.allocation_owner_type || null },
    { label: 'Owner id', value: item.allocation_owner_id != null ? String(item.allocation_owner_id) : null },
    { label: 'Delegate res', value: item.dlgt_res_id != null ? String(item.dlgt_res_id) : null },
    { label: 'Missing delegate', value: item.missing_dlgt ? 'Yes' : null },
    { label: 'GTY fit preview', value: item.is_gty_fit ? 'Yes (local only)' : null },
  ].filter((row) => row.value != null && String(row.value).trim() !== '');

  const inventoryRows = [
    { label: 'Request type', value: item.inventory_request_type || null },
    { label: 'Result type', value: item.inventory_result_type || null },
    { label: 'Occupancy', value: item.occupancy != null ? String(item.occupancy) : null },
    { label: 'Price category', value: item.price_category || null },
    { label: 'Allocation id', value: item.allocation_id != null ? String(item.allocation_id) : null },
    {
      label: 'Link category',
      value: item.link_cabin_category && item.link_cabin_category !== item.cabin_category
        ? item.link_cabin_category
        : null,
    },
    { label: 'Deck source', value: item.deck_source || null },
  ].filter((row) => row.value != null && String(row.value).trim() !== '');

  const showProb = item.probability != null
    || item.owner_kind === 'group'
    || item.status_key === 'gty'
    || item.status_key === 'gty-fit';

  return (
    <div className="reservation-hover-summary" role="region" aria-label={title}>
      <div className="reservation-hover-summary__header">
        {showProb ? <ProbabilityMark pct={item.probability} /> : null}
        <div className="reservation-hover-summary__header-text">
          <span className="reservation-hover-summary__title">{title}</span>
          <div className="reservation-hover-summary__chips">
            {item.status_label ? (
              <span className="reservation-hover-summary__chip">{item.status_label}</span>
            ) : null}
            {category ? (
              <span className="reservation-hover-summary__chip reservation-hover-summary__chip--muted">
                {category}
              </span>
            ) : null}
            {deckLabel ? (
              <span className="reservation-hover-summary__chip reservation-hover-summary__chip--muted">
                {deckLabel}
              </span>
            ) : null}
          </div>
          {scopeLine ? (
            <span className="reservation-hover-summary__sub">{scopeLine}</span>
          ) : null}
        </div>
      </div>

      {ownershipRows.length > 0 ? (
        <section className="reservation-hover-summary__block" aria-label="Ownership">
          <h4 className="reservation-hover-summary__block-title">Ownership</h4>
          {ownershipRows.map((row) => (
            <MetaRow key={row.label} label={row.label}>{row.value}</MetaRow>
          ))}
        </section>
      ) : null}

      {inventoryRows.length > 0 ? (
        <section className="reservation-hover-summary__block" aria-label="Inventory">
          <h4 className="reservation-hover-summary__block-title">Inventory</h4>
          {inventoryRows.map((row) => (
            <MetaRow key={row.label} label={row.label}>{row.value}</MetaRow>
          ))}
        </section>
      ) : null}
    </div>
  );
};

export default CabinDeckHoverSummary;
