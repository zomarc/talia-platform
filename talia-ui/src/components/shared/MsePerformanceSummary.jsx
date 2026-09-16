/**
 * Dense MSE performance hover — nameplate, sellable, booked vs target.
 * Presentational only; used inside HoverPreview as an alternative to DistributionSummary.
 */

import React from 'react';

const formatCount = (value) => {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString();
};

const formatPct = (value) => {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(1)}%`;
};

const Row = ({ label, children }) => (
  <div className="reservation-hover-summary__row">
    <span className="reservation-hover-summary__label">{label}</span>
    <span className="reservation-hover-summary__value">{children}</span>
  </div>
);

const targetLabel = (row) => {
  const status = row?.target_review_status;
  if (!status || status === 'unknown') return '—';
  const gap = row?.target_gap_pp;
  const gapTxt = gap != null && Number.isFinite(Number(gap))
    ? ` ${Number(gap) > 0 ? '+' : ''}${Number(gap).toFixed(0)}pp`
    : '';
  if (status === 'behind') return `Behind${gapTxt}`;
  if (status === 'ahead') return `Ahead${gapTxt}`;
  return `On plan${gapTxt}`;
};

/**
 * @param {{ row: object | null }} props
 */
const MsePerformanceSummary = ({ row = null }) => {
  if (!row) {
    return (
      <div className="reservation-hover-summary" role="status">
        <p className="reservation-hover-summary__empty">No performance detail</p>
      </div>
    );
  }

  const sellable = row.sellable_cabins ?? row.total_cabins;
  const title = row.sail_code || row.row_label || 'Sailing';

  return (
    <div className="reservation-hover-summary" role="region" aria-label={`Performance ${title}`}>
      <div className="reservation-hover-summary__header">
        <div className="reservation-hover-summary__header-text">
          <span className="reservation-hover-summary__title">{title}</span>
          <span className="reservation-hover-summary__sub">
            {[row.package_name, row.route].filter(Boolean).join(' · ') || 'Performance'}
          </span>
        </div>
      </div>
      <div className="reservation-hover-summary__block">
        <Row label="Nameplate">{formatCount(row.total_cabins)}</Row>
        <Row label="Offsale">{formatCount(row.offsale_cabins)}</Row>
        <Row label="Sellable">{formatCount(sellable)}</Row>
        <Row label="Booked C">{formatCount(row.booked_cabins)}</Row>
        <Row label="Bk%">{formatPct(row.actual_booked_pct)}</Row>
        <Row label="Pot%">{formatPct(row.potential_booked_pct)}</Row>
        <Row label="Up%">{formatPct(row.booking_upside_pct)}</Row>
        <Row label="Target">
          {row.target_review_pending
            ? 'Loading…'
            : (row.target_profile_name || 'None assigned')}
        </Row>
        <Row label="Goal LF">{formatPct(row.target_lf_pct)}</Row>
        <Row label="vs Target">{targetLabel(row)}</Row>
      </div>
    </div>
  );
};

export default MsePerformanceSummary;
