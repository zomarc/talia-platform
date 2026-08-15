import React from 'react';

/**
 * Pinned KPI strip for report shells — sits above scrollable `talia-report__content`.
 * See COMPONENT-STANDARDS § Report Shell Vocabulary → Snapshot.
 * Visibility: gate with component Options Views → Snapshot (`useComponentOptions`).
 *
 * @param {string} [title='Snapshot']
 * @param {Array<{ key: string, label: string, value: React.ReactNode, hint?: React.ReactNode, tone?: 'positive'|'negative'|'neutral', trend?: 'up'|'down'|'flat'|null }>} items
 * @param {boolean} [visible=true] when false, render nothing (Views toggle)
 * @param {string} [ariaLabel]
 * @param {string} [className]
 */
const TrendIndicator = ({ trend }) => {
  if (trend === 'up') {
    return (
      <span className="talia-report__snapshot-trend talia-report__snapshot-trend--up" aria-label="increasing">
        ▲
      </span>
    );
  }
  if (trend === 'down') {
    return (
      <span className="talia-report__snapshot-trend talia-report__snapshot-trend--down" aria-label="decreasing">
        ▼
      </span>
    );
  }
  return null;
};

const ReportSnapshot = ({
  title = 'Snapshot',
  items = [],
  visible = true,
  ariaLabel,
  className = '',
}) => {
  if (!visible || !items.length) return null;

  const combined = ['talia-report__snapshot', className].filter(Boolean).join(' ');

  return (
    <section className={combined} aria-label={ariaLabel || title || 'Key metrics'}>
      {title ? <h3 className="talia-report__snapshot-title">{title}</h3> : null}
      <div className="talia-report__metrics" aria-label={ariaLabel || 'Key metrics'}>
        {items.map((item) => {
          const toneClass =
            item.tone === 'positive'
              ? ' talia-metric__value--positive'
              : item.tone === 'negative'
                ? ' talia-metric__value--negative'
                : '';
          return (
            <div
              key={item.key}
              className={[
                'talia-metric',
                'talia-report__metric',
                item.concern ? 'talia-report__metric--concern' : '',
              ].filter(Boolean).join(' ')}
            >
              <span className="talia-metric__label">{item.label}</span>
              <span className={`talia-metric__value${toneClass}`}>
                {item.value}
                {item.trend ? <TrendIndicator trend={item.trend} /> : null}
              </span>
              {item.hint != null && item.hint !== '' ? (
                <span className="talia-metric__change">{item.hint}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ReportSnapshot;
