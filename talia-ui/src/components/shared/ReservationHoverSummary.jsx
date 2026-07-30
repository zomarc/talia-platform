/**
 * Dense reservation hover card — presentational only.
 * Used inside HoverPreview (same shell as MSE DistributionSummary).
 */

import React from 'react';

const formatCount = (value) => {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString();
};

const formatMoney = (value) => {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const ProbabilityMark = ({ pct }) => {
  const value = pct != null ? Math.min(100, Math.max(0, Number(pct) || 0)) : null;
  return (
    <div
      className="reservation-hover-summary__prob"
      title={value != null ? `Arrival likelihood ${Math.round(value)}%` : 'No probability'}
    >
      <div
        className="reservation-hover-summary__prob-ring"
        style={{ '--prob-pct': `${value != null ? value : 0}%` }}
      >
        <span className="reservation-hover-summary__prob-value">
          {value != null ? `${Math.round(value)}%` : '—'}
        </span>
      </div>
      <span className="reservation-hover-summary__prob-label">Likely</span>
    </div>
  );
};

const MetaRow = ({ label, children, muted = false }) => (
  <div className={`reservation-hover-summary__row${muted ? ' reservation-hover-summary__row--muted' : ''}`}>
    <span className="reservation-hover-summary__label">{label}</span>
    <span className="reservation-hover-summary__value">{children}</span>
  </div>
);

/**
 * @param {{ card: object | null }} props
 */
const ReservationHoverSummary = ({ card = null }) => {
  if (!card) {
    return (
      <div className="reservation-hover-summary" role="status">
        <p className="reservation-hover-summary__empty">No reservation detail</p>
      </div>
    );
  }

  const agencyLabel = card.agencyName
    ? `${card.agencyName}`
    : (card.agencyId ? `Agency ${card.agencyId}` : 'No agency');
  const agencyIdHint = card.agencyName && card.agencyId ? ` · ${card.agencyId}` : '';
  const onSail = card.agencyOnSail || {};
  const otherLine = onSail.otherBookingCount > 0
    ? `~${formatCount(onSail.otherExpectedPax)} pax expected from ${formatCount(onSail.otherBookingCount)} other`
    : 'No other bookings on this sailing';

  const cabinCurrent = [card.cabinCategory, card.cabinType].filter(Boolean).join(' · ') || '—';
  const titleRes = card.resId.includes('.')
    ? card.resId
    : (Number.isFinite(Number(card.resId)) ? String(Math.floor(Number(card.resId))) : card.resId);

  return (
    <div className="reservation-hover-summary" role="region" aria-label={`Reservation ${titleRes}`}>
      <div className="reservation-hover-summary__header">
        <ProbabilityMark pct={card.probabilityPct} />
        <div className="reservation-hover-summary__header-text">
          <span className="reservation-hover-summary__title">{titleRes}</span>
          <div className="reservation-hover-summary__chips">
            {card.status ? (
              <span className="reservation-hover-summary__chip">{card.status}</span>
            ) : null}
            {card.composition ? (
              <span className="reservation-hover-summary__chip reservation-hover-summary__chip--comp">
                {card.composition}
              </span>
            ) : null}
            {card.guestCount != null ? (
              <span className="reservation-hover-summary__chip reservation-hover-summary__chip--muted">
                {formatCount(card.guestCount)} gst
              </span>
            ) : null}
          </div>
          {(card.ship || card.sailCode) ? (
            <span className="reservation-hover-summary__sub">
              {[card.ship, card.sailCode].filter(Boolean).join(' · ')}
            </span>
          ) : null}
        </div>
      </div>

      <section className="reservation-hover-summary__block" aria-label="Agency on this sailing">
        <h4 className="reservation-hover-summary__block-title">Agency</h4>
        <p className="reservation-hover-summary__agency">
          {agencyLabel}
          <span className="reservation-hover-summary__agency-id">{agencyIdHint}</span>
        </p>
        {card.agencyId ? (
          <>
            <p className="reservation-hover-summary__agency-totals">
              On this sailing · {formatCount(onSail.bookingCount)} bk · {formatCount(onSail.guestTotal)} pax · €{formatMoney(onSail.netRevenueEur)}
            </p>
            <p className="reservation-hover-summary__agency-pipeline">{otherLine}</p>
          </>
        ) : null}
      </section>

      <section className="reservation-hover-summary__block" aria-label="Financials">
        <h4 className="reservation-hover-summary__block-title">Financials</h4>
        <MetaRow label="Net EUR">€{formatMoney(card.netTicketRevenueEur)}</MetaRow>
        <MetaRow label="Gross fare">{formatMoney(card.grossSellingFare)}</MetaRow>
        <MetaRow label="Net fare">{formatMoney(card.netSellingFare)}</MetaRow>
        <MetaRow label="Currency">{card.currency || '—'}</MetaRow>
      </section>

      <section className="reservation-hover-summary__block" aria-label="Cabin">
        <h4 className="reservation-hover-summary__block-title">Cabin</h4>
        <MetaRow label="Current">{cabinCurrent}</MetaRow>
        <MetaRow label="Booked → Current" muted>—</MetaRow>
        <MetaRow label="Upgrade value" muted>—</MetaRow>
      </section>
    </div>
  );
};

export default ReservationHoverSummary;
