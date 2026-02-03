import React, { useMemo } from 'react';
import RevenueBreakdownPresenter from './RevenueBreakdownPresenter';

const RevenueBreakdown = () => {
  const revenueData = useMemo(() => ([
    { category: 'Cabins', amount: 65800, percentage: 51.6 },
    { category: 'Food & Beverage', amount: 28900, percentage: 22.7 },
    { category: 'Entertainment', amount: 15200, percentage: 11.9 },
    { category: 'Spa & Wellness', amount: 9800, percentage: 7.7 },
    { category: 'Excursions', amount: 7750, percentage: 6.1 }
  ]), []);

  return <RevenueBreakdownPresenter data={revenueData} />;
};

export default RevenueBreakdown;
