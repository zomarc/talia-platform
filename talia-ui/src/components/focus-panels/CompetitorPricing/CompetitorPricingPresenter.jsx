/**
 * Competitor Pricing Presenter Component
 * Main UI component that displays competitor pricing with filters, charts, and table
 */

import React from 'react';
import CompetitorPricingFilters from './components/CompetitorPricingFilters';
import CompetitorScatterChart from './components/CompetitorScatterChart';
import CompetitorPricingTable from './components/CompetitorPricingTable';
import { usePanelDetailsVisibility } from '../../../hooks/usePanelDetailsVisibility';
import { useSubpanelExpansion } from '../../../hooks/useSubpanelExpansion';

const CompetitorPricingPresenter = ({
  data,
  filters,
  onFiltersChange,
  theme,
  panelInstanceId,
  panelComponentId,
}) => {
  const { expandedKey: expandedCabinType, setExpandedKey: setExpandedCabinType } = useSubpanelExpansion();
  const [showTable] = usePanelDetailsVisibility({
    panelInstanceId,
    panelComponentId: panelComponentId || 'competitor-pricing',
  });
  const [chartOptions, setChartOptions] = React.useState({
    pppdScaleMode: 'AUTO',
    pppdMax: 200
  });

  return (
    <div className="talia-report competitor-pricing" role="region" aria-label="Competitor pricing report">
      <header className="talia-report__header competitor-pricing__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Competitor Pricing</h2>
          <span className="talia-report__subtitle">Latest prices by cabin type</span>
        </div>
      </header>

      <CompetitorPricingFilters
        data={data}
        filters={filters}
        onFiltersChange={onFiltersChange}
        chartOptions={chartOptions}
        onChartOptionsChange={setChartOptions}
      />

      <main className="talia-report__content competitor-pricing__content">
        <CompetitorScatterChart
          data={data}
          theme={theme}
          filters={filters}
          expandedCabinType={expandedCabinType}
          onToggleExpand={setExpandedCabinType}
          tableVisible={showTable}
          chartOptions={chartOptions}
        />
        {!expandedCabinType && showTable && <CompetitorPricingTable data={data} />}
      </main>

    </div>
  );
};

export default CompetitorPricingPresenter;

