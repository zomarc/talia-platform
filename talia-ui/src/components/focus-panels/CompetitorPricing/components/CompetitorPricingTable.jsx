/**
 * Competitor Pricing Table Component
 * Displays detailed competitor pricing data using Tabulator
 */

import React, { useRef, useEffect } from 'react';
import { initTabulator, getTabulatorOptions } from '../../../../lib/tabulatorConfig';
import { formatDayMon } from '../../../../lib/dateFormat';

const CompetitorPricingTable = ({ data }) => {
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const initialDataRef = useRef(data || []);

  useEffect(() => {
    let cancelled = false;

    const initTable = async () => {
      try {
        if (!tableRef.current || cancelled) return;

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
              return formatDayMon(date, '');
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

        // Clone data to avoid read-only property errors (GraphQL may return frozen objects)
        const clonedData = (initialDataRef.current || []).map(item => ({ ...item }));

        instanceRef.current = new Tabulator(
          tableRef.current,
          getTabulatorOptions({
            data: clonedData,
            columns,
            pagination: true,
            paginationSize: 50,
            paginationSizeSelector: [25, 50, 100, 200],
            movableColumns: true,
            resizableColumns: true,
            initialSort: [{ column: 'departureDate', dir: 'asc' }],
            height: '100%',
            selectableRows: false,
          })
        );
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
  }, []);

  useEffect(() => {
    if (!instanceRef.current) return;
    try {
      const clonedData = (data || []).map(item => ({ ...item }));
      instanceRef.current.replaceData(clonedData);
    } catch (error) {
      console.warn('[CompetitorPricingTable] Failed to update table data:', error);
    }
  }, [data]);

  return (
    <div className="competitor-table">
      <div ref={tableRef} className="competitor-table__host" />
    </div>
  );
};

export default CompetitorPricingTable;

