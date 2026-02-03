import React, { useMemo } from 'react';
import ExceptionListPresenter from './ExceptionListPresenter';

const ExceptionList = () => {
  const exceptions = useMemo(() => ([
    {
      id: 1,
      type: 'Overbooking',
      severity: 'High',
      description: 'Cabin category A1 overbooked by 2 units',
      ship: 'Celestyal Olympia',
      voyage: 'OLY-2024-001',
      status: 'Active',
      created: '2024-01-15 09:30'
    },
    {
      id: 2,
      type: 'Price Discrepancy',
      severity: 'Medium',
      description: 'Price mismatch between systems for category B2',
      ship: 'Celestyal Crystal',
      voyage: 'CRY-2024-002',
      status: 'Pending',
      created: '2024-01-15 08:15'
    },
    {
      id: 3,
      type: 'Inventory Sync',
      severity: 'Low',
      description: 'Delayed inventory synchronization',
      ship: 'Celestyal Olympia',
      voyage: 'OLY-2024-001',
      status: 'Resolved',
      created: '2024-01-14 16:45'
    }
  ]), []);

  return <ExceptionListPresenter data={exceptions} />;
};

export default ExceptionList;
