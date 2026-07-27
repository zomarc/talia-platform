/**
 * Capacity Validation Presenter — compact cabins × berths source matrix.
 */

import React from 'react';
import { formatDayMon } from '../../../lib/dateFormat';

const fmt = (value) => {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString();
};

const CapacityValidationPresenter = ({
  ledger,
  hasSailSelection,
  scopeLoading = false,
  selectedSailCodes = [],
  selectedReferenceSailCode = null,
}) => {
  const scope = ledger?.scope || {};
  const sources = ledger?.sources || [];
  const scopeLabel = selectedReferenceSailCode
    || scope.reference_sail_code
    || (selectedSailCodes.length ? selectedSailCodes.join(', ') : null);

  return (
    <div className="focus-panel talia-report capacity-validation" role="region" aria-label="Capacity validation">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Capacity Validation</h2>
          <p className="talia-report__subtitle">
            {hasSailSelection
              ? `${scopeLabel}${scope.ship_code ? ` · ${scope.ship_code}` : ''}${scope.sail_date_from ? ` · ${formatDayMon(scope.sail_date_from, '')}` : ''}`
              : 'Select a sailing in Master Sailing Explorer'}
          </p>
        </div>
      </header>

      <main className="talia-report__content capacity-validation__content">
        {!hasSailSelection && (
          <p className="focus-panel-empty__detail">No sailing selected.</p>
        )}
        {hasSailSelection && scopeLoading && (
          <p className="focus-panel-empty__detail">Loading capacity sources…</p>
        )}
        {hasSailSelection && !scopeLoading && ledger && (
          <>
            <p className="capacity-validation__hint">
              Physical cabins and berths by source. MSE row is what Master Sailing Explorer displays
              (cabins = berths ÷ 2).
            </p>

            <div className="capacity-validation__table-wrap">
              <table className="capacity-validation__table">
                <thead>
                  <tr>
                    <th rowSpan={2} className="capacity-validation__col-source">Source</th>
                    <th colSpan={2}>Capacity</th>
                    <th colSpan={2}>Booked</th>
                    <th colSpan={2}>Available</th>
                  </tr>
                  <tr>
                    <th>Cabins</th>
                    <th>Berths</th>
                    <th>Cabins</th>
                    <th>Berths</th>
                    <th>Cabins</th>
                    <th>Berths</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((src) => (
                    <tr
                      key={src.id}
                      className={[
                        src.highlight ? 'capacity-validation__row--mse' : '',
                        src.kind === 'selling' ? 'capacity-validation__row--selling' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <th scope="row" className="capacity-validation__col-source">
                        <div className="capacity-validation__source-name">{src.name}</div>
                        <div className="capacity-validation__source-table"><code>{src.table}</code></div>
                        <div className="capacity-validation__source-how">{src.how}</div>
                        {src.detail && (
                          <div className="capacity-validation__source-detail">{src.detail}</div>
                        )}
                        {src.warn && (
                          <div className="capacity-validation__source-warn">{src.warn}</div>
                        )}
                      </th>
                      <td>{fmt(src.capacity?.cabins)}</td>
                      <td>{fmt(src.capacity?.berths)}</td>
                      <td>{fmt(src.booked?.cabins)}</td>
                      <td>{fmt(src.booked?.berths)}</td>
                      <td>{fmt(src.available?.cabins)}</td>
                      <td>{fmt(src.available?.berths)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {scope.package_name && (
              <p className="capacity-validation__footer">
                {(scope.sail_codes || []).join(', ')}
                {scope.package_name ? ` · ${scope.package_name}` : ''}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default CapacityValidationPresenter;
