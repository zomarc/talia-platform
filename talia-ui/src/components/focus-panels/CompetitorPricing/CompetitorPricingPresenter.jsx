/**
 * Competitor Pricing Presenter Component
 * Main UI component that displays competitor pricing with filters, charts, and table
 */

import React from 'react';
import CompetitorPricingFilters from './components/CompetitorPricingFilters';
import CompetitorScatterChart from './components/CompetitorScatterChart';
import CompetitorPricingTable from './components/CompetitorPricingTable';

const CompetitorPricingPresenter = ({ data, filters, onFiltersChange, theme, onRefresh }) => {
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: theme?.colors?.background || '#fff',
    color: theme?.colors?.foreground || '#2b2b2b'
  };

  const titleStyle = {
    padding: '16px',
    fontSize: '20px',
    fontWeight: 'bold',
    borderBottom: `1px solid ${theme?.colors?.border || '#e0e0e0'}`,
    background: theme?.colors?.glass || 'rgba(255, 255, 255, 0.8)'
  };

  const mainContentStyle = {
    display: 'flex',
    flex: 1,
    overflow: 'hidden'
  };

  const leftColumnStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto'
  };

  const rightColumnStyle = {
    width: '250px',
    padding: '16px',
    borderLeft: `1px solid ${theme?.colors?.border || '#e0e0e0'}`,
    background: theme?.colors?.sidebar || '#f5f5f5',
    overflow: 'auto'
  };

  const filterPaneStyle = {
    marginBottom: '16px'
  };

  const filterPaneTitleStyle = {
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '12px',
    color: theme?.colors?.foreground || '#2b2b2b'
  };

  return (
    <div style={containerStyle}>
      {/* Title */}
      <div style={titleStyle}>
        Competitor Pricing | Latest Prices By Cabin Type
      </div>

      {/* Filters */}
      <CompetitorPricingFilters
        data={data}
        filters={filters}
        onFiltersChange={onFiltersChange}
        theme={theme}
      />

      {/* Main Content */}
      <div style={mainContentStyle}>
        {/* Left Column: Charts */}
        <div style={leftColumnStyle}>
          <CompetitorScatterChart data={data} theme={theme} />
        </div>

        {/* Right Column: Filter Pane */}
        <div style={rightColumnStyle}>
          <div style={filterPaneStyle}>
            <div style={filterPaneTitleStyle}>Filters</div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>
                <input
                  type="checkbox"
                  checked={filters.isLatest !== false}
                  onChange={(e) => onFiltersChange({
                    ...filters,
                    isLatest: e.target.checked
                  })}
                  style={{ marginRight: '8px' }}
                />
                Is Latest
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <CompetitorPricingTable data={data} theme={theme} />
    </div>
  );
};

export default CompetitorPricingPresenter;

