/**
 * Competitor Pricing Presenter Component
 * Main UI component that displays competitor pricing with filters, charts, and table
 */

import React from 'react';
import CompetitorPricingFilters from './components/CompetitorPricingFilters';
import CompetitorScatterChart from './components/CompetitorScatterChart';
import CompetitorPricingTable from './components/CompetitorPricingTable';

const CompetitorPricingPresenter = ({ data, filters, onFiltersChange, theme }) => {
  return (
    <div className="competitor-pricing">
      {/* Title */}
      <div className="competitor-pricing__title">
        Competitor Pricing | Latest Prices By Cabin Type
      </div>

      {/* Filters */}
      <CompetitorPricingFilters
        data={data}
        filters={filters}
        onFiltersChange={onFiltersChange}
      />

      {/* Main Content */}
      <div className="competitor-pricing__content">
        {/* Left Column: Charts */}
        <div className="competitor-pricing__left">
          <CompetitorScatterChart data={data} theme={theme} />
        </div>

        {/* Right Column: Filter Pane */}
        <div className="competitor-pricing__right">
          <div className="competitor-pricing__filter-pane">
            <div className="competitor-pricing__filter-title">Filters</div>
            <div className="competitor-pricing__filter-row">
              <label className="competitor-pricing__filter-label">
                <input
                  type="checkbox"
                  checked={filters.isLatest !== false}
                  onChange={(e) => onFiltersChange({
                    ...filters,
                    isLatest: e.target.checked
                  })}
                  className="competitor-pricing__filter-checkbox"
                />
                Is Latest
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <CompetitorPricingTable data={data} />
    </div>
  );
};

export default CompetitorPricingPresenter;

