/**
 * Competitor Pricing Filters Component
 * Provides filter controls for competitor pricing data
 */

import React from 'react';

const PPPD_MAX_OPTIONS = [100, 200, 300, 400, 500, 600, 700];

const CompetitorPricingFilters = ({
  data = [],
  filters,
  onFiltersChange,
  chartOptions = { pppdScaleMode: 'AUTO', pppdMax: 200 },
  onChartOptionsChange
}) => {
  // Extract unique values for dropdowns from data
  const currencies = [...new Set(data.map(d => d.currency).filter(Boolean))].sort();
  const durations = [...new Set(data.map(d => d.duration).filter(Boolean))].sort((a, b) => a - b);
  const destinations = [...new Set(data.map(d => d.destination).filter(Boolean))].sort();
  const cruiseLines = [...new Set(data.map(d => d.cruiseLine).filter(Boolean))].sort();

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

  const handleChartOptionChange = (key, value) => {
    if (typeof onChartOptionsChange !== 'function') return;
    onChartOptionsChange({
      ...chartOptions,
      [key]: value
    });
  };

  return (
    <div className="competitor-filters talia-report-filters">
      <div className="competitor-filters__group">
        <label className="competitor-filters__label">Currency</label>
        <select
          value={filters.currency || ''}
          onChange={(e) => handleFilterChange('currency', e.target.value)}
          className="competitor-filters__input"
        >
          <option value="">All currencies</option>
          {currencies.length > 0 ? (
            currencies.map(curr => (
              <option key={curr} value={curr}>{curr}</option>
            ))
          ) : null}
        </select>
      </div>

      <div className="competitor-filters__group">
        <label className="competitor-filters__label">Duration</label>
        <select
          value={filters.duration || ''}
          onChange={(e) => handleFilterChange('duration', e.target.value ? parseFloat(e.target.value) : null)}
          className="competitor-filters__input"
        >
          <option value="">All</option>
          {durations.map(dur => (
            <option key={dur} value={dur}>{dur}</option>
          ))}
        </select>
      </div>

      <div className="competitor-filters__group">
        <label className="competitor-filters__label">Destination</label>
        <select
          value={filters.destination || ''}
          onChange={(e) => handleFilterChange('destination', e.target.value)}
          className="competitor-filters__input"
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

      <div className="competitor-filters__group">
        <label className="competitor-filters__label">Primary</label>
        <select
          value={filters.primaryCruiseLine || ''}
          onChange={(e) => {
            const nextPrimary = e.target.value;
            const nextSecondary = filters.secondaryCruiseLine === nextPrimary ? 'ALL' : filters.secondaryCruiseLine;
            onFiltersChange({
              ...filters,
              primaryCruiseLine: nextPrimary || null,
              secondaryCruiseLine: nextSecondary || 'ALL'
            });
          }}
          className="competitor-filters__input"
        >
          <option value="">None</option>
          {cruiseLines.map(line => (
            <option key={line} value={line}>{line}</option>
          ))}
        </select>
      </div>

      <div className="competitor-filters__group">
        <label className="competitor-filters__label">Secondary</label>
        {(() => {
          const availableSecondaryLines = cruiseLines.filter((line) => !filters.primaryCruiseLine || line !== filters.primaryCruiseLine);
          const secondaryValue = filters.secondaryCruiseLine && (
            filters.secondaryCruiseLine === 'ALL' || availableSecondaryLines.includes(filters.secondaryCruiseLine)
          )
            ? filters.secondaryCruiseLine
            : 'ALL';

          return (
            <select
              value={secondaryValue}
              onChange={(e) => handleFilterChange('secondaryCruiseLine', e.target.value || 'ALL')}
              className="competitor-filters__input"
            >
              <option value="ALL">All</option>
              <option value="NONE">None</option>
              {availableSecondaryLines.map((line) => (
                <option key={line} value={line}>{line}</option>
              ))}
            </select>
          );
        })()}
      </div>

      <div className="competitor-filters__group">
        <label className="competitor-filters__label">Cabin Type</label>
        <select
          value={filters.cabinType || 'ALL'}
          onChange={(e) => handleFilterChange('cabinType', e.target.value)}
          className="competitor-filters__input"
        >
          {cabinTypes.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      <div className="competitor-filters__group">
        <label className="competitor-filters__label">Month</label>
        <select
          value={filters.departureMonth || ''}
          onChange={(e) => handleFilterChange('departureMonth', e.target.value ? parseInt(e.target.value) : null)}
          className="competitor-filters__input"
        >
          {months.map(month => (
            <option key={month.value || 'all'} value={month.value || ''}>{month.label}</option>
          ))}
        </select>
      </div>

      <div className="competitor-filters__group">
        <label className="competitor-filters__label">PPPD</label>
        <select
          value={chartOptions.pppdScaleMode || 'AUTO'}
          onChange={(e) => handleChartOptionChange('pppdScaleMode', e.target.value)}
          className="competitor-filters__input"
        >
          <option value="AUTO">Auto</option>
          <option value="FIXED">Fixed</option>
        </select>
      </div>

      <div className="competitor-filters__group">
        <label className="competitor-filters__label">PPPD Max</label>
        <select
          value={String(chartOptions.pppdMax || 200)}
          onChange={(e) => handleChartOptionChange('pppdMax', Number(e.target.value))}
          className="competitor-filters__input"
          disabled={(chartOptions.pppdScaleMode || 'AUTO') !== 'FIXED'}
        >
          {PPPD_MAX_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div className="competitor-filters__group">
        <label className="competitor-filters__label competitor-filters__label--inline">
          <input
            type="checkbox"
            checked={filters.isLatest !== false}
            onChange={(e) => handleFilterChange('isLatest', e.target.checked)}
            className="competitor-filters__checkbox"
          />
          Latest Only
        </label>
      </div>

    </div>
  );
};

export default CompetitorPricingFilters;

