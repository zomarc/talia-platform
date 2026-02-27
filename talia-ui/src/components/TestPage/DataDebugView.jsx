/**
 * Data Debug View Component
 * Displays comprehensive data debugging information including:
 * - Ship codes, sailing days, year/month breakdown
 * - Total capacity and booked
 * - Table overview with row counts, snapshot dates, and change metrics
 */

import React, { useState } from 'react';
import { useDataDebugInfo } from '../../hooks/data/useDataDebugInfo';
import { LoadingSpinner } from '../shared';

const DataDebugView = () => {
  const { data, loading, error, refetch } = useDataDebugInfo();
  const [selectedShipCode, setSelectedShipCode] = useState(null);

  if (loading) {
    return (
      <div className="data-debug data-debug__state data-debug__state--centered">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="data-debug data-debug__state">
        <div className="data-debug__error-card">
          <h3 className="data-debug__error-title">Error Loading Data</h3>
          <p className="data-debug__error-message">
            {error.message || 'Failed to load data debug information'}
          </p>
          <p className="data-debug__error-note">
            Note: The GraphQL server may need to be restarted to pick up schema changes.
            <br />
            If you see "Cannot query field dataDebugInfo", restart the server with: npm run dev
          </p>
        </div>
        <button
          onClick={refetch}
          className="talia-btn talia-btn--primary"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="data-debug data-debug__state data-debug__state--empty">
        <p className="data-debug__empty-text">No data available</p>
      </div>
    );
  }

  const { overview, tables } = data;
  
  // Filter sailing days by ship code if selected
  const filteredSailingDays = selectedShipCode
    ? overview.sailingDays.filter(day => day.shipCode === selectedShipCode)
    : overview.sailingDays;

  // Filter year/month breakdown by ship code if selected
  const filteredYearMonth = selectedShipCode
    ? overview.yearMonthBreakdown.filter(ym => {
        // Check if any sailing day in this year/month matches the ship code
        return overview.sailingDays.some(day => 
          day.year === ym.year && 
          day.month === ym.month && 
          day.shipCode === selectedShipCode
        );
      })
    : overview.yearMonthBreakdown;

  return (
    <div className="data-debug">
      <div className="data-debug__header">
        <h2 className="data-debug__title">Data Debug View</h2>
        <button
          onClick={refetch}
          className="talia-btn talia-btn--primary data-debug__refresh"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Overview Section */}
      <div className="data-debug__card">
        <h3 className="data-debug__section-title">Overview</h3>

        {/* Ship Code Filter */}
        <div className="data-debug__filter">
          <label className="data-debug__label">
            Filter by Ship Code:
          </label>
          <select
            value={selectedShipCode || ''}
            onChange={(e) => setSelectedShipCode(e.target.value || null)}
            className="data-debug__select"
          >
            <option value="">All Ships</option>
            {overview.shipCodes.map(shipCode => (
              <option key={shipCode} value={shipCode}>{shipCode}</option>
            ))}
          </select>
        </div>

        {/* Summary Cards */}
        <div className="data-debug__summary-grid">
          <div className="data-debug__summary-card">
            <div className="data-debug__summary-label">Total Capacity</div>
            <div className="data-debug__summary-value">
              {overview.totalCapacity.toLocaleString()}
            </div>
          </div>

          <div className="data-debug__summary-card">
            <div className="data-debug__summary-label">Total Booked</div>
            <div className="data-debug__summary-value">
              {overview.totalBooked.toLocaleString()}
            </div>
          </div>

          <div className="data-debug__summary-card">
            <div className="data-debug__summary-label">Available</div>
            <div className="data-debug__summary-value">
              {(overview.totalCapacity - overview.totalBooked).toLocaleString()}
            </div>
          </div>

          <div className="data-debug__summary-card">
            <div className="data-debug__summary-label">Sailing Days</div>
            <div className="data-debug__summary-value">
              {filteredSailingDays.length}
            </div>
          </div>
        </div>

        {/* Year/Month Breakdown */}
        <div className="data-debug__subsection">
          <h4 className="data-debug__subsection-title">Year/Month Breakdown</h4>
          <div className="data-debug__table-scroll data-debug__table-scroll--medium">
            <table className="data-debug__table">
              <thead>
                <tr>
                  <th className="data-debug__th">Year</th>
                  <th className="data-debug__th">Month</th>
                  <th className="data-debug__th">Capacity</th>
                  <th className="data-debug__th">Booked</th>
                  <th className="data-debug__th">Available</th>
                  <th className="data-debug__th">Sailing Days</th>
                </tr>
              </thead>
              <tbody>
                {filteredYearMonth.map((ym) => (
                  <tr key={`${ym.year}-${ym.month}`}>
                    <td className="data-debug__td">{ym.year}</td>
                    <td className="data-debug__td">{ym.month}</td>
                    <td className="data-debug__td">{ym.capacity.toLocaleString()}</td>
                    <td className="data-debug__td">{ym.booked.toLocaleString()}</td>
                    <td className="data-debug__td">{ym.available.toLocaleString()}</td>
                    <td className="data-debug__td">{ym.sailingDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sailing Days (first 20) */}
        <div className="data-debug__subsection">
          <h4 className="data-debug__subsection-title">
            Sailing Days {filteredSailingDays.length > 20 ? `(showing first 20 of ${filteredSailingDays.length})` : ''}
          </h4>
          <div className="data-debug__table-scroll data-debug__table-scroll--large">
            <table className="data-debug__table">
              <thead>
                <tr>
                  <th className="data-debug__th">Date</th>
                  <th className="data-debug__th">Ship</th>
                  <th className="data-debug__th">Sail Code</th>
                  <th className="data-debug__th">Capacity</th>
                  <th className="data-debug__th">Booked</th>
                  <th className="data-debug__th">Available</th>
                </tr>
              </thead>
              <tbody>
                {filteredSailingDays.slice(0, 20).map((day) => (
                  <tr key={`${day.date}-${day.shipCode}-${day.sailCode || 'unknown'}`}>
                    <td className="data-debug__td">{day.date}</td>
                    <td className="data-debug__td">{day.shipCode || 'N/A'}</td>
                    <td className="data-debug__td">{day.sailCode || 'N/A'}</td>
                    <td className="data-debug__td">{day.capacity.toLocaleString()}</td>
                    <td className="data-debug__td">{day.booked.toLocaleString()}</td>
                    <td className="data-debug__td">{day.available.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tables Overview */}
      <div className="data-debug__card">
        <h3 className="data-debug__section-title">Tables Overview</h3>
        <div className="data-debug__table-container">
          <table className="data-debug__table">
            <thead>
              <tr>
                <th className="data-debug__th">Table Name</th>
                <th className="data-debug__th">Row Count</th>
                <th className="data-debug__th">Last Snapshot Date</th>
                <th className="data-debug__th">Changes (Last Sync)</th>
                <th className="data-debug__th">Changes (24 Hours)</th>
                <th className="data-debug__th">Changes (Last Month)</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => (
                <tr key={table.tableName}>
                  <td className="data-debug__td">
                    <strong className="data-debug__table-name">
                      {table.tableName}
                    </strong>
                  </td>
                  <td className="data-debug__td">{table.rowCount.toLocaleString()}</td>
                  <td className="data-debug__td">
                    {table.lastSnapshotDate 
                      ? new Date(table.lastSnapshotDate).toLocaleDateString()
                      : 'N/A'}
                  </td>
                  <td className="data-debug__td">
                    {table.changesLastSync !== null 
                      ? table.changesLastSync.toLocaleString()
                      : 'N/A'}
                  </td>
                  <td className="data-debug__td">{table.changes24Hours.toLocaleString()}</td>
                  <td className="data-debug__td">{table.changesLastMonth.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DataDebugView;

