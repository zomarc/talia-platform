/**
 * Competitor Pricing Table Component
 * Displays detailed competitor pricing data using Tabulator
 */

import React, { useRef, useEffect, useState } from 'react';
import { initTabulator } from '../../../../lib/tabulatorConfig';

const CompetitorPricingTable = ({ data, theme }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const initTable = async () => {
      try {
        if (!tableRef.current || initialized || cancelled) return;

        const Tabulator = await initTabulator();
        if (!Tabulator || cancelled) return;

        // Destroy existing instance
        if (instanceRef.current) {
          try {
            instanceRef.current.destroy();
          } catch (e) {
            console.warn('Failed to destroy existing table:', e);
          }
        }

        // Define columns
        const columns = [
          {
            title: 'Cruise Line',
            field: 'cruiseLine',
            width: 180,
            headerFilter: 'input',
            headerFilterPlaceholder: 'Filter cruise line...'
          },
          {
            title: 'Currency',
            field: 'currency',
            width: 80,
            headerFilter: 'input'
          },
          {
            title: 'Ship Code',
            field: 'shipCode',
            width: 100,
            headerFilter: 'input'
          },
          {
            title: 'Ship Name',
            field: 'shipName',
            width: 200,
            headerFilter: 'input',
            headerFilterPlaceholder: 'Filter ship...'
          },
          {
            title: 'Cabin Type',
            field: 'cabinType',
            width: 100,
            headerFilter: 'list',
            headerFilterParams: {
              values: {
                '': 'All',
                'INSIDE': 'Inside',
                'OUTSIDE': 'Outside',
                'BALCONY': 'Balcony',
                'SUITE': 'Suite'
              },
              clearable: true
            }
          },
          {
            title: 'Departure Date',
            field: 'departureDate',
            width: 120,
            headerFilter: 'input',
            formatter: (cell) => {
              const date = cell.getValue();
              if (!date) return '';
              return new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              });
            }
          },
          {
            title: 'Departure Port',
            field: 'departurePort',
            width: 150,
            headerFilter: 'input'
          },
          {
            title: 'Destination',
            field: 'destination',
            width: 120,
            headerFilter: 'input'
          },
          {
            title: 'Market',
            field: 'market',
            width: 100,
            headerFilter: 'input'
          },
          {
            title: 'Itinerary Code',
            field: 'itineraryCode',
            width: 150,
            headerFilter: 'input'
          },
          {
            title: 'Available Offer',
            field: 'availableOffer',
            width: 150,
            headerFilter: 'input'
          },
          {
            title: 'Total Rate PP',
            field: 'totalRatePP',
            width: 120,
            hozAlign: 'right',
            formatter: (cell) => {
              const value = cell.getValue();
              return value ? value.toFixed(2) : '';
            }
          },
          {
            title: 'PPPD',
            field: 'pppd',
            width: 100,
            hozAlign: 'right',
            formatter: (cell) => {
              const value = cell.getValue();
              return value ? value.toFixed(2) : '';
            }
          }
        ];

        // Initialize Tabulator
        instanceRef.current = new Tabulator(tableRef.current, {
          data: data || [],
          columns,
          layout: 'fitColumns',
          pagination: true,
          paginationSize: 50,
          paginationSizeSelector: [25, 50, 100, 200],
          movableColumns: true,
          resizableColumns: true,
          initialSort: [
            { column: 'departureDate', dir: 'asc' }
          ],
          height: '400px'
        });

        setInitialized(true);
      } catch (error) {
        console.error('[CompetitorPricingTable] Error initializing table:', error);
      }
    };

    initTable();

    return () => {
      cancelled = true;
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying table:', e);
        }
      }
    };
  }, [data, initialized]);

  const containerStyle = {
    padding: '16px',
    background: theme?.colors?.glass || 'rgba(255, 255, 255, 0.8)',
    borderTop: `1px solid ${theme?.colors?.border || '#e0e0e0'}`
  };

  if (!data || data.length === 0) {
    return (
      <div style={containerStyle}>
        <p style={{ textAlign: 'center', color: theme?.colors?.textSecondary || '#666' }}>
          No competitor pricing data available
        </p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div ref={tableRef} style={{ background: theme?.colors?.background || '#fff' }} />
    </div>
  );
};

export default CompetitorPricingTable;

