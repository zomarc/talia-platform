import React, { useMemo } from 'react';
import KPICardsPresenter from './KPICardsPresenter';

const KPICards = () => {
  const kpiData = useMemo(() => ([
    {
      title: 'Total Revenue',
      value: '€127,450',
      change: '+8.2%',
      trend: 'up',
      icon: '💰'
    },
    {
      title: 'Occupancy Rate',
      value: '94.5%',
      change: '+2.1%',
      trend: 'up',
      icon: '👥'
    },
    {
      title: 'Available Cabins',
      value: '1,247',
      change: '12 available',
      trend: 'neutral',
      icon: '🛏️'
    },
    {
      title: 'Voyage Days',
      value: '7',
      change: 'Day 3 of 7',
      trend: 'neutral',
      icon: '📅'
    }
  ]), []);

  return <KPICardsPresenter data={kpiData} />;
};

export default KPICards;
