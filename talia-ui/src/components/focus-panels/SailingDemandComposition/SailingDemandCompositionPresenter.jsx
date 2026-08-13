import React from 'react';

const fmt = (n, digits = 0) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits > 0 ? Math.min(digits, 1) : 0,
  });
};

const fmtEur = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `€${Math.round(v).toLocaleString()}`;
};

const MetricCard = ({ title, subtitle, guests, cabins, revenueEur, rows }) => (
  <div className="sailing-demand__card" role="group" aria-label={title}>
    <h3 className="sailing-demand__card-title">{title}</h3>
    <p className="sailing-demand__card-sub">{subtitle}</p>
    <dl className="sailing-demand__metrics">
      <div>
        <dt>Guests</dt>
        <dd>{fmt(guests, 1)}</dd>
      </div>
      <div>
        <dt>Cabins (≈)</dt>
        <dd>{fmt(cabins, 1)}</dd>
      </div>
      <div>
        <dt>Revenue</dt>
        <dd>{fmtEur(revenueEur)}</dd>
      </div>
      <div>
        <dt>Rows</dt>
        <dd>{fmt(rows)}</dd>
      </div>
    </dl>
  </div>
);

/**
 * Presenter — Booked / Estimated / Contracted for selected sailing.
 */
const SailingDemandCompositionPresenter = ({
  sailCode = '',
  shipName = '',
  composition = null,
  note = null,
}) => {
  const booked = composition?.booked || {};
  const estimated = composition?.estimated || {};
  const contracted = composition?.contracted || {};

  return (
    <div
      className="focus-panel talia-report sailing-demand-panel"
      role="region"
      aria-label="Sailing demand composition"
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Sailing Demand</h2>
          <p className="talia-report__subtitle">
            {[sailCode || 'Select a sailing', shipName].filter(Boolean).join(' · ')}
            {' · '}
            Booked = named BK · Contracted = groups + offers · Estimated = contracted × probability
          </p>
        </div>
      </header>

      {note ? (
        <div className="talia-callout" role="status">{note}</div>
      ) : null}

      {!sailCode ? (
        <div className="talia-callout" role="status">
          Select a sailing in Explorer to load demand composition.
        </div>
      ) : (
        <div className="talia-report__content sailing-demand__grid">
          <MetricCard
            title="Booked"
            subtitle="Named / materialised bookings"
            guests={booked.guests}
            cabins={booked.cabins}
            revenueEur={booked.revenueEur}
            rows={booked.rows}
          />
          <MetricCard
            title="Estimated"
            subtitle="Contracted × delivery probability"
            guests={estimated.guests}
            cabins={estimated.cabins}
            revenueEur={estimated.revenueEur}
            rows={estimated.rows}
          />
          <MetricCard
            title="Contracted"
            subtitle="All groups + offers (face)"
            guests={contracted.guests}
            cabins={contracted.cabins}
            revenueEur={contracted.revenueEur}
            rows={contracted.rows}
          />
        </div>
      )}

      <div className="talia-callout sailing-demand__tomorrow" role="note">
        Tomorrow: group terms (often remain “booked” until ~90 days out), revenue targets,
        and underperforming sailing actions.
      </div>
    </div>
  );
};

export default SailingDemandCompositionPresenter;
