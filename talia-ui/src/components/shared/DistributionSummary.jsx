/**
 * Compact distribution summary — LF header + Channel / Market / Group·FIT meters.
 * Presentational only; no Chart.js.
 */

import React from 'react';
import { colorForDimensionKey } from '../../lib/reservationDimensions';

const AVAILABLE_LABEL = 'Available';

const CapacityBadge = ({ meta }) => {
  const capacity = meta?.capacityBerths;
  const guests = meta?.guestTotal;
  const lf = meta?.loadFactorPct;
  if (capacity == null) {
    return (
      <span className="distribution-summary__cap-badge distribution-summary__cap-badge--muted">
        No capacity
      </span>
    );
  }
  return (
    <span
      className="distribution-summary__cap-badge"
      title={meta?.capacitySourceSail
        ? `Capacity · ${meta.capacitySourceSail}`
        : 'Berth capacity'}
    >
      {Number(guests || 0).toLocaleString()}/{Number(capacity).toLocaleString()}
      {lf != null ? ` · ${lf}% LF` : ''}
    </span>
  );
};

const BreakdownCapacityMeter = ({ slices, capacityBerths }) => {
  if (capacityBerths == null || !(capacityBerths > 0)) return null;
  const items = (slices || [])
    .filter((s) => s && Number(s.value) > 0 && s.capacityPct != null)
    .slice(0, 6);
  if (!items.length) return null;
  return (
    <ul className="distribution-summary__cap-meter" aria-label="Capacity share by segment">
      {items.map((slice) => (
        <li key={slice.label} className="distribution-summary__cap-meter-row">
          <span className="distribution-summary__cap-meter-label">{slice.label}</span>
          <span className="distribution-summary__cap-meter-track" aria-hidden="true">
            <span
              className="distribution-summary__cap-meter-fill"
              style={{
                width: `${Math.min(100, Math.max(0, Number(slice.capacityPct) || 0))}%`,
                background: colorForDimensionKey(slice.label),
              }}
            />
          </span>
          <span className="distribution-summary__cap-meter-pct">{slice.capacityPct}%</span>
        </li>
      ))}
    </ul>
  );
};

/** Single stacked capacity bar — graphical hover / dense mode. */
const StackedMixBar = ({ title, slices, capacityBerths, guestTotal }) => {
  const items = (slices || []).filter((s) => s && Number(s.value) > 0);
  if (!items.length) return null;

  const capacity = capacityBerths != null && capacityBerths > 0 ? capacityBerths : null;
  const sold = items.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  const scale = capacity != null ? capacity : Math.max(sold, 1);
  const available = capacity != null ? Math.max(0, capacity - sold) : 0;

  const segments = [
    ...items.map((slice) => ({
      label: slice.label,
      value: Number(slice.value) || 0,
      pct: Math.round(((Number(slice.value) || 0) / scale) * 1000) / 10,
      color: colorForDimensionKey(slice.label),
    })),
  ];
  if (available > 0) {
    segments.push({
      label: AVAILABLE_LABEL,
      value: available,
      pct: Math.round((available / scale) * 1000) / 10,
      color: 'rgba(128,128,128,0.28)',
      muted: true,
    });
  }

  const tip = segments
    .filter((s) => !s.muted)
    .map((s) => `${s.label}: ${s.value.toLocaleString()} (${s.pct}%)`)
    .join(' · ');

  return (
    <section className="distribution-summary__stack" aria-label={title} title={tip}>
      <div className="distribution-summary__stack-head">
        <h4 className="distribution-summary__block-title">{title}</h4>
        <span className="distribution-summary__stack-total">
          {Number(guestTotal ?? sold).toLocaleString()}
        </span>
      </div>
      <div className="distribution-summary__stack-track" aria-hidden="true">
        {segments.map((seg) => (
          <span
            key={seg.label}
            className={`distribution-summary__stack-seg${seg.muted ? ' distribution-summary__stack-seg--muted' : ''}`}
            style={{
              flexGrow: Math.max(seg.value, 0.0001),
              flexBasis: 0,
              background: seg.color,
            }}
            title={`${seg.label}: ${seg.value.toLocaleString()}`}
          />
        ))}
      </div>
      <div className="distribution-summary__stack-legend">
        {items.slice(0, 4).map((slice) => (
          <span key={slice.label} className="distribution-summary__stack-chip">
            <i
              className="distribution-summary__stack-swatch"
              style={{ background: colorForDimensionKey(slice.label) }}
              aria-hidden="true"
            />
            <span className="distribution-summary__stack-chip-label">{slice.label}</span>
          </span>
        ))}
        {items.length > 4 ? (
          <span className="distribution-summary__stack-chip distribution-summary__stack-chip--more">
            +{items.length - 4}
          </span>
        ) : null}
      </div>
    </section>
  );
};

const MeterBlock = ({ title, slices, capacityBerths }) => (
  <section className="distribution-summary__block" aria-label={title}>
    <h4 className="distribution-summary__block-title">{title}</h4>
    <BreakdownCapacityMeter slices={slices} capacityBerths={capacityBerths} />
  </section>
);

const LoadFactorMark = ({ lf, guests, capacity }) => {
  const pct = lf != null ? Math.min(100, Math.max(0, Number(lf) || 0)) : 0;
  return (
    <div
      className="distribution-summary__lf"
      title={capacity != null
        ? `${Number(guests || 0).toLocaleString()} / ${Number(capacity).toLocaleString()} berths`
        : undefined}
    >
      <div className="distribution-summary__lf-ring" style={{ '--lf-pct': `${pct}%` }}>
        <span className="distribution-summary__lf-value">
          {lf != null ? `${Math.round(lf)}%` : '—'}
        </span>
      </div>
      <span className="distribution-summary__lf-label">LF</span>
    </div>
  );
};

/**
 * @param {{ bundle: object, dense?: boolean, title?: string, marketDimension?: string }} props
 */
const DistributionSummary = ({
  bundle,
  dense = false,
  title = null,
  marketDimension = 'market_group',
  bookedComposition = null,
}) => {
  const meta = bundle?.meta || {};
  const capacityBerths = meta.capacityBerths ?? null;
  const marketTitle = marketDimension === 'market' || meta.marketDimension === 'market'
    ? 'Market'
    : 'Market group';
  const groupFitTitle = meta.groupFitLabel
    || (bookedComposition === 'three_way'
      ? 'FIT / Group / Held'
      : bookedComposition === 'booked_only'
        ? 'Group / FIT'
        : 'Group / FIT (incl. held)');

  const hasGuests = Number(meta.guestTotal || 0) > 0
    || (bundle?.channelSlices || []).some((s) => Number(s?.value) > 0)
    || (bundle?.groupFitSlices || []).some((s) => Number(s?.value) > 0);

  const rootClass = [
    'distribution-summary',
    dense ? 'distribution-summary--dense' : '',
    dense ? 'distribution-summary--graphical' : '',
  ].filter(Boolean).join(' ');

  if (!bundle || !hasGuests) {
    return (
      <div className={rootClass} role="status">
        {title ? <p className="distribution-summary__title">{title}</p> : null}
        <p className="distribution-summary__empty">No booking mix</p>
      </div>
    );
  }

  if (dense) {
    return (
      <div className={rootClass} role="region" aria-label={title || 'Distribution summary'}>
        <div className="distribution-summary__header distribution-summary__header--graphical">
          <LoadFactorMark
            lf={meta.loadFactorPct}
            guests={meta.guestTotal}
            capacity={capacityBerths}
          />
          <div className="distribution-summary__header-text">
            {title ? <span className="distribution-summary__title">{title}</span> : null}
            <CapacityBadge meta={meta} />
            {meta.bookingCount != null ? (
              <span className="distribution-summary__bk">{meta.bookingCount} bk</span>
            ) : null}
          </div>
        </div>
        <div className="distribution-summary__stacks">
          <StackedMixBar
            title="Channel"
            slices={bundle?.channelSlices}
            capacityBerths={capacityBerths}
            guestTotal={meta.guestTotal}
          />
          <StackedMixBar
            title={marketTitle}
            slices={bundle?.marketSlices}
            capacityBerths={capacityBerths}
            guestTotal={meta.guestTotal}
          />
          <StackedMixBar
            title={groupFitTitle}
            slices={bundle?.groupFitSlices}
            capacityBerths={capacityBerths}
            guestTotal={meta.guestTotal}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={rootClass} role="region" aria-label={title || 'Distribution summary'}>
      <div className="distribution-summary__header">
        {title ? <span className="distribution-summary__title">{title}</span> : null}
        <CapacityBadge meta={meta} />
        {meta.bookingCount != null ? (
          <span className="distribution-summary__bk">{meta.bookingCount} bk</span>
        ) : null}
      </div>
      <div className="distribution-summary__meters">
        <MeterBlock
          title="Channel"
          slices={bundle?.channelSlices}
          capacityBerths={capacityBerths}
        />
        <MeterBlock
          title={marketTitle}
          slices={bundle?.marketSlices}
          capacityBerths={capacityBerths}
        />
        <MeterBlock
          title={groupFitTitle}
          slices={bundle?.groupFitSlices}
          capacityBerths={capacityBerths}
        />
      </div>
    </div>
  );
};

export default DistributionSummary;
export { CapacityBadge, BreakdownCapacityMeter };
