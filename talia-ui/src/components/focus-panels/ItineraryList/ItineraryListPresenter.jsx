import React from 'react';

/**
 * ItineraryListPresenter - Itinerary list UI
 *
 * @param {Object} props
 * @param {Array} props.data - Itinerary list items
 */
const ItineraryListPresenter = ({ data }) => {
  const statusClass = (status) => {
    switch (status) {
      case 'Active':
        return 'talia-pill--success';
      case 'Planning':
        return 'talia-pill--warning';
      case 'Inactive':
        return 'talia-pill--danger';
      default:
        return 'talia-pill--neutral';
    }
  };

  return (
    <div className="talia-report" role="region" aria-label="Cruise itineraries">
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Cruise Itineraries</h2>
          <p className="talia-report__subtitle">Upcoming routes and departures</p>
        </div>
      </header>
      <main className="talia-report__content">
        <div className="talia-list" role="list">
          {data.map((itinerary) => (
            <div className="talia-card talia-list__item" role="listitem" key={itinerary.id}>
              <div className="talia-list__header">
                <h3 className="talia-list__title">{itinerary.name}</h3>
                <span className={`talia-pill ${statusClass(itinerary.status)}`}>{itinerary.status}</span>
              </div>
              <div className="talia-meta">
                <span>{itinerary.ship}</span>
                <span>{itinerary.duration}</span>
                <span>Departure: {itinerary.departure}</span>
              </div>
              <div className="talia-meta">
                <strong>Ports:</strong>
                {itinerary.ports.map((port) => (
                  <span key={port}>{port}</span>
                ))}
              </div>
              <div className="talia-meta">
                <strong>Next departure:</strong> {itinerary.nextDeparture}
              </div>
            </div>
          ))}
        </div>
      </main>
      <footer className="talia-report__footer">
        <span>{data.length} itineraries</span>
        <span>Updated {new Date().toLocaleDateString()}</span>
      </footer>
    </div>
  );
};

export default ItineraryListPresenter;
