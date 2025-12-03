/**
 * Competitor Pricing Filters Component
 * Provides filter controls for competitor pricing data
 */

import React, { useState, useEffect } from 'react';

const CompetitorPricingFilters = ({ data = [], filters, onFiltersChange, theme }) => {
  // Extract unique values for dropdowns from data
  const currencies = [...new Set(data.map(d => d.currency).filter(Boolean))].sort();
  const durations = [...new Set(data.map(d => d.duration).filter(Boolean))].sort((a, b) => a - b);
  const destinations = [...new Set(data.map(d => d.destination).filter(Boolean))].sort();
  const cruiseLines = [...new Set(data.map(d => d.cruiseLine).filter(Boolean))].sort();
  const markets = [...new Set(data.map(d => d.market).filter(Boolean))].sort();

  const months = [
    { value: null, label: 'All Months' },
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  const cabinTypes = [
    { value: 'ALL', label: 'All' },
    { value: 'INSIDE', label: 'Inside' },
    { value: 'OUTSIDE', label: 'Outside' },
    { value: 'BALCONY', label: 'Balcony' },
    { value: 'SUITE', label: 'Suite' }
  ];

  const handleFilterChange = (key, value) => {
    onFiltersChange({
      ...filters,
      [key]: value === '' ? null : value
    });
  };

  const inputStyle = {
    padding: '6px 8px',
    border: `1px solid ${theme?.colors?.border || '#e0e0e0'}`,
    borderRadius: '4px',
    fontSize: '14px',
    background: theme?.colors?.background || '#fff',
    color: theme?.colors?.foreground || '#333',
    minWidth: '120px',
    boxSizing: 'border-box'
  };

  const labelStyle = {
    fontSize: '12px',
    fontWeight: '600',
    color: theme?.colors?.textSecondary || '#666',
    marginBottom: '4px',
    display: 'block'
  };

  const containerStyle = {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    padding: '16px',
    background: theme?.colors?.glass || 'rgba(255, 255, 255, 0.8)',
    borderBottom: `1px solid ${theme?.colors?.border || '#e0e0e0'}`,
    alignItems: 'flex-end'
  };

  const filterGroupStyle = {
    display: 'flex',
    flexDirection: 'column'
  };

  return (
    <div style={containerStyle}>
      <div style={filterGroupStyle}>
        <label style={labelStyle}>Currency</label>
        <select
          value={filters.currency || ''}
          onChange={(e) => handleFilterChange('currency', e.target.value)}
          style={inputStyle}
        >
          {currencies.length > 0 ? (
            currencies.map(curr => (
              <option key={curr} value={curr}>{curr}</option>
            ))
          ) : (
            <option value="">Loading...</option>
          )}
        </select>
      </div>

      <div style={filterGroupStyle}>
        <label style={labelStyle}>Cruise Duration</label>
        <select
          value={filters.duration || ''}
          onChange={(e) => handleFilterChange('duration', e.target.value ? parseFloat(e.target.value) : null)}
          style={inputStyle}
        >
          <option value="">All</option>
          {durations.map(dur => (
            <option key={dur} value={dur}>{dur}</option>
          ))}
        </select>
      </div>

      <div style={filterGroupStyle}>
        <label style={labelStyle}>Source Destination</label>
        <select
          value={filters.destination || ''}
          onChange={(e) => handleFilterChange('destination', e.target.value)}
          style={inputStyle}
        >
          <option value="">All Destinations</option>
          {destinations.length > 0 ? (
            destinations.map(dest => (
              <option key={dest} value={dest}>{dest}</option>
            ))
          ) : (
            <option value="">Loading...</option>
          )}
        </select>
      </div>

      <div style={filterGroupStyle}>
        <label style={labelStyle}>Cabin Type</label>
        <select
          value={filters.cabinType || 'ALL'}
          onChange={(e) => handleFilterChange('cabinType', e.target.value)}
          style={inputStyle}
        >
          {cabinTypes.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      <div style={filterGroupStyle}>
        <label style={labelStyle}>Departure Month</label>
        <select
          value={filters.departureMonth || ''}
          onChange={(e) => handleFilterChange('departureMonth', e.target.value ? parseInt(e.target.value) : null)}
          style={inputStyle}
        >
          {months.map(month => (
            <option key={month.value || 'all'} value={month.value || ''}>{month.label}</option>
          ))}
        </select>
      </div>

      <div style={filterGroupStyle}>
        <label style={labelStyle}>
          <input
            type="checkbox"
            checked={filters.isLatest !== false}
            onChange={(e) => handleFilterChange('isLatest', e.target.checked)}
            style={{ marginRight: '6px' }}
          />
          Latest Only
        </label>
      </div>
    </div>
  );
};

export default CompetitorPricingFilters;

