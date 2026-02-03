import React from 'react';

/**
 * KPICardsPresenter - Presentational KPI card grid
 *
 * @param {Object} props
 * @param {Array} props.data - KPI data array
 */
const KPICardsPresenter = ({ data }) => {
  return (
    <div className="talia-report" role="region" aria-label="Key performance indicators">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Key Metrics</h2>
          <p className="talia-report__subtitle">Daily performance snapshot</p>
        </div>
      </header>
      <main className="talia-report__content">
        <div className="talia-grid talia-grid--4" role="list">
          {data.map((kpi, index) => {
            const trendClass =
              kpi.trend === 'up'
                ? 'talia-metric__change--positive'
                : kpi.trend === 'down'
                  ? 'talia-metric__change--negative'
                  : 'talia-metric__change--neutral';

            return (
              <div className="talia-card talia-card--elevated" role="listitem" key={`${kpi.title}-${index}`}>
                <div className="talia-metric">
                  <span className="talia-metric__label">
                    {kpi.icon} {kpi.title}
                  </span>
                  <span className="talia-metric__value">{kpi.value}</span>
                  <span className={`talia-metric__change ${trendClass}`}>{kpi.change}</span>
                </div>
              </div>
            );
          })}
        </div>
      </main>
      <footer className="talia-report__footer">
        <span>{data.length} metrics</span>
        <span>Updated {new Date().toLocaleDateString()}</span>
      </footer>
    </div>
  );
};

export default KPICardsPresenter;
