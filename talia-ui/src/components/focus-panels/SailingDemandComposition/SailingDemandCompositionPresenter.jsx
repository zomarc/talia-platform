import React from 'react';
import { useGlobalDemandUnit } from '../../../hooks/useGlobalDemandUnit';
import {
  demandUnitShortLabel,
  toDemandVolume,
} from '../../../lib/demandUnit';

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

const MetricCard = ({ title, subtitle, volume, volumeLabel, revenueEur, rows }) => (
  <div className="sailing-demand__card" role="group" aria-label={title}>
    <h3 className="sailing-demand__card-title">{title}</h3>
    <p className="sailing-demand__card-sub">{subtitle}</p>
    <dl className="sailing-demand__metrics">
      <div>
        <dt>{volumeLabel}</dt>
        <dd>{fmt(volume, 1)}</dd>
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
 * Guest totals stay canonical; StatusBar Unit only changes presentation.
 */
const SailingDemandCompositionPresenter = ({
  sailCode = '',
  shipName = '',
  composition = null,
  note = null,
}) => {
  const demandUnit = useGlobalDemandUnit();
  const volumeLabel = demandUnitShortLabel(demandUnit);
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
            {' · '}
            Volume as {volumeLabel} (from guests)
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
            volume={toDemandVolume(booked.guests, demandUnit)}
            volumeLabel={volumeLabel}
            revenueEur={booked.revenueEur}
            rows={booked.rows}
          />
          <MetricCard
            title="Estimated"
            subtitle="Contracted × delivery probability"
            volume={toDemandVolume(estimated.guests, demandUnit)}
            volumeLabel={volumeLabel}
            revenueEur={estimated.revenueEur}
            rows={estimated.rows}
          />
          <MetricCard
            title="Contracted"
            subtitle="All groups + offers (face)"
            volume={toDemandVolume(contracted.guests, demandUnit)}
            volumeLabel={volumeLabel}
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
