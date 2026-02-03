import React from 'react';

/**
 * ExceptionListPresenter - Exception list UI
 *
 * @param {Object} props
 * @param {Array} props.data - Exception list items
 */
const ExceptionListPresenter = ({ data }) => {
  const severityClass = (severity) => {
    switch (severity) {
      case 'High':
        return 'talia-pill--danger';
      case 'Medium':
        return 'talia-pill--warning';
      case 'Low':
        return 'talia-pill--success';
      default:
        return 'talia-pill--neutral';
    }
  };

  const statusClass = (status) => {
    switch (status) {
      case 'Active':
        return 'talia-pill--danger';
      case 'Pending':
        return 'talia-pill--warning';
      case 'Resolved':
        return 'talia-pill--success';
      default:
        return 'talia-pill--neutral';
    }
  };

  return (
    <div className="talia-report" role="region" aria-label="Active exceptions">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Active Exceptions</h2>
          <p className="talia-report__subtitle">Operational alerts and follow-ups</p>
        </div>
      </header>
      <main className="talia-report__content">
        <div className="talia-list" role="list">
          {data.map((exception) => (
            <div className="talia-card talia-list__item" role="listitem" key={exception.id}>
              <div className="talia-list__header">
                <h3 className="talia-list__title">{exception.type}</h3>
                <span className="talia-meta">{exception.created}</span>
              </div>
              <div className="talia-meta">
                <span className={`talia-pill ${severityClass(exception.severity)}`}>{exception.severity}</span>
                <span className={`talia-pill ${statusClass(exception.status)}`}>{exception.status}</span>
              </div>
              <p className="talia-report__subtitle">{exception.description}</p>
              <div className="talia-meta">
                <span><strong>Ship:</strong> {exception.ship}</span>
                <span><strong>Voyage:</strong> {exception.voyage}</span>
              </div>
            </div>
          ))}
        </div>
      </main>
      <footer className="talia-report__footer">
        <span>{data.length} exceptions</span>
        <span>Last update {new Date().toLocaleDateString()}</span>
      </footer>
    </div>
  );
};

export default ExceptionListPresenter;
