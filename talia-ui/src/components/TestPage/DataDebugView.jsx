/**
 * Data Debug View Component
 * Displays comprehensive data debugging information including:
 * - Ship codes, sailing days, year/month breakdown
 * - Total capacity and booked
 * - Table overview with row counts, snapshot dates, and change metrics
 */

import React, { useState } from 'react';
import { useDataDebugInfo } from '../../hooks/data/useDataDebugInfo';
import { LoadingSpinner, ErrorMessage } from '../shared';

const DataDebugView = ({ theme = {} }) => {
  const { data, loading, error, refetch } = useDataDebugInfo();
  const [selectedShipCode, setSelectedShipCode] = useState(null);

  // Default theme values if not provided
  const defaultTheme = {
    colors: {
      background: '#1a1a1a',
      foreground: '#ffffff',
      cardBackground: '#2a2a2a',
      border: '#3a3a3a',
      tableHeader: '#3a3a3a',
      textSecondary: '#cccccc',
      accent: '#b08d57',
      inputBackground: '#1a1a1a'
    }
  };

  const finalTheme = {
    colors: {
      ...defaultTheme.colors,
      ...(theme?.colors || {})
    }
  };

  if (loading) {
    return (
      <div style={{ 
        padding: '20px', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        minHeight: '400px',
        background: finalTheme.colors.background,
        color: finalTheme.colors.foreground
      }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '20px',
        background: finalTheme.colors.background,
        color: finalTheme.colors.foreground
      }}>
        <div style={{
          padding: '16px',
          background: '#2a1a1a',
          border: '1px solid #d32f2f',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          <h3 style={{ marginTop: 0, color: '#d32f2f' }}>Error Loading Data</h3>
          <p style={{ color: finalTheme.colors.textSecondary }}>
            {error.message || 'Failed to load data debug information'}
          </p>
          <p style={{ 
            fontSize: '12px', 
            color: finalTheme.colors.textSecondary,
            marginTop: '8px',
            fontFamily: 'monospace'
          }}>
            Note: The GraphQL server may need to be restarted to pick up schema changes.
            <br />
            If you see "Cannot query field dataDebugInfo", restart the server with: npm run dev
          </p>
        </div>
        <button
          onClick={refetch}
          style={{
            padding: '8px 16px',
            background: finalTheme.colors.accent,
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ 
        padding: '20px',
        background: theme?.colors?.background || '#1a1a1a',
        color: theme?.colors?.foreground || '#ffffff'
      }}>
        <p>No data available</p>
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

  const cardStyle = {
    background: finalTheme.colors.cardBackground,
    border: `1px solid ${finalTheme.colors.border}`,
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px'
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px'
  };

  const thStyle = {
    background: finalTheme.colors.tableHeader,
    color: finalTheme.colors.foreground,
    padding: '12px',
    textAlign: 'left',
    borderBottom: `2px solid ${finalTheme.colors.border}`,
    fontWeight: '600'
  };

  const tdStyle = {
    padding: '10px 12px',
    borderBottom: `1px solid ${finalTheme.colors.border}`,
    color: finalTheme.colors.textSecondary
  };

  return (
    <div style={{ 
      padding: '20px',
      background: finalTheme.colors.background,
      color: finalTheme.colors.foreground,
      minHeight: '100%'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h2 style={{ 
          margin: 0,
          color: finalTheme.colors.foreground,
          fontSize: '24px',
          fontWeight: '600'
        }}>
          Data Debug View
        </h2>
        <button
          onClick={refetch}
          style={{
            padding: '8px 16px',
            background: finalTheme.colors.accent,
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Overview Section */}
      <div style={cardStyle}>
        <h3 style={{ 
          marginTop: 0,
          marginBottom: '16px',
          color: finalTheme.colors.foreground,
          fontSize: '18px'
        }}>
          Overview
        </h3>
        
        {/* Ship Code Filter */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ 
            display: 'block',
            marginBottom: '8px',
            color: finalTheme.colors.textSecondary,
            fontSize: '14px'
          }}>
            Filter by Ship Code:
          </label>
          <select
            value={selectedShipCode || ''}
            onChange={(e) => setSelectedShipCode(e.target.value || null)}
            style={{
              padding: '8px 12px',
              background: finalTheme.colors.inputBackground,
              color: finalTheme.colors.foreground,
              border: `1px solid ${finalTheme.colors.border}`,
              borderRadius: '4px',
              fontSize: '14px',
              cursor: 'pointer',
              minWidth: '200px'
            }}
          >
            <option value="">All Ships</option>
            {overview.shipCodes.map(shipCode => (
              <option key={shipCode} value={shipCode}>{shipCode}</option>
            ))}
          </select>
        </div>

        {/* Summary Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            ...cardStyle,
            marginBottom: 0,
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: '12px',
              color: finalTheme.colors.textSecondary,
              marginBottom: '8px'
            }}>
              Total Capacity
            </div>
            <div style={{ 
              fontSize: '24px',
              fontWeight: '600',
              color: finalTheme.colors.accent
            }}>
              {overview.totalCapacity.toLocaleString()}
            </div>
          </div>
          
          <div style={{
            ...cardStyle,
            marginBottom: 0,
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: '12px',
              color: finalTheme.colors.textSecondary,
              marginBottom: '8px'
            }}>
              Total Booked
            </div>
            <div style={{ 
              fontSize: '24px',
              fontWeight: '600',
              color: finalTheme.colors.accent
            }}>
              {overview.totalBooked.toLocaleString()}
            </div>
          </div>
          
          <div style={{
            ...cardStyle,
            marginBottom: 0,
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: '12px',
              color: finalTheme.colors.textSecondary,
              marginBottom: '8px'
            }}>
              Available
            </div>
            <div style={{ 
              fontSize: '24px',
              fontWeight: '600',
              color: finalTheme.colors.accent
            }}>
              {(overview.totalCapacity - overview.totalBooked).toLocaleString()}
            </div>
          </div>
          
          <div style={{
            ...cardStyle,
            marginBottom: 0,
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: '12px',
              color: finalTheme.colors.textSecondary,
              marginBottom: '8px'
            }}>
              Sailing Days
            </div>
            <div style={{ 
              fontSize: '24px',
              fontWeight: '600',
              color: finalTheme.colors.accent
            }}>
              {filteredSailingDays.length}
            </div>
          </div>
        </div>

        {/* Year/Month Breakdown */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ 
            marginBottom: '12px',
            color: finalTheme.colors.foreground,
            fontSize: '16px'
          }}>
            Year/Month Breakdown
          </h4>
          <div style={{ 
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Year</th>
                  <th style={thStyle}>Month</th>
                  <th style={thStyle}>Capacity</th>
                  <th style={thStyle}>Booked</th>
                  <th style={thStyle}>Available</th>
                  <th style={thStyle}>Sailing Days</th>
                </tr>
              </thead>
              <tbody>
                {filteredYearMonth.map((ym, idx) => (
                  <tr key={`${ym.year}-${ym.month}`}>
                    <td style={tdStyle}>{ym.year}</td>
                    <td style={tdStyle}>{ym.month}</td>
                    <td style={tdStyle}>{ym.capacity.toLocaleString()}</td>
                    <td style={tdStyle}>{ym.booked.toLocaleString()}</td>
                    <td style={tdStyle}>{ym.available.toLocaleString()}</td>
                    <td style={tdStyle}>{ym.sailingDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sailing Days (first 20) */}
        <div>
          <h4 style={{ 
            marginBottom: '12px',
            color: finalTheme.colors.foreground,
            fontSize: '16px'
          }}>
            Sailing Days {filteredSailingDays.length > 20 ? `(showing first 20 of ${filteredSailingDays.length})` : ''}
          </h4>
          <div style={{ 
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Ship</th>
                  <th style={thStyle}>Sail Code</th>
                  <th style={thStyle}>Capacity</th>
                  <th style={thStyle}>Booked</th>
                  <th style={thStyle}>Available</th>
                </tr>
              </thead>
              <tbody>
                {filteredSailingDays.slice(0, 20).map((day, idx) => (
                  <tr key={`${day.date}-${day.shipCode}-${day.sailCode || 'unknown'}`}>
                    <td style={tdStyle}>{day.date}</td>
                    <td style={tdStyle}>{day.shipCode || 'N/A'}</td>
                    <td style={tdStyle}>{day.sailCode || 'N/A'}</td>
                    <td style={tdStyle}>{day.capacity.toLocaleString()}</td>
                    <td style={tdStyle}>{day.booked.toLocaleString()}</td>
                    <td style={tdStyle}>{day.available.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tables Overview */}
      <div style={cardStyle}>
        <h3 style={{ 
          marginTop: 0,
          marginBottom: '16px',
          color: finalTheme.colors.foreground,
          fontSize: '18px'
        }}>
          Tables Overview
        </h3>
        <div style={{ 
          overflowX: 'auto'
        }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Table Name</th>
                <th style={thStyle}>Row Count</th>
                <th style={thStyle}>Last Snapshot Date</th>
                <th style={thStyle}>Changes (Last Sync)</th>
                <th style={thStyle}>Changes (24 Hours)</th>
                <th style={thStyle}>Changes (Last Month)</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((table, idx) => (
                <tr key={table.tableName}>
                  <td style={tdStyle}>
                    <strong style={{ color: finalTheme.colors.foreground }}>
                      {table.tableName}
                    </strong>
                  </td>
                  <td style={tdStyle}>{table.rowCount.toLocaleString()}</td>
                  <td style={tdStyle}>
                    {table.lastSnapshotDate 
                      ? new Date(table.lastSnapshotDate).toLocaleDateString()
                      : 'N/A'}
                  </td>
                  <td style={tdStyle}>
                    {table.changesLastSync !== null 
                      ? table.changesLastSync.toLocaleString()
                      : 'N/A'}
                  </td>
                  <td style={tdStyle}>{table.changes24Hours.toLocaleString()}</td>
                  <td style={tdStyle}>{table.changesLastMonth.toLocaleString()}</td>
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

