import React, { useMemo } from 'react';
import OccupancyChartPresenter from './OccupancyChartPresenter';

const OccupancyChart = () => {
  const weeklyData = useMemo(() => ([
    { day: 'Mon', occupancy: 92, revenue: 18500 },
    { day: 'Tue', occupancy: 88, revenue: 17200 },
    { day: 'Wed', occupancy: 95, revenue: 19800 },
    { day: 'Thu', occupancy: 91, revenue: 18200 },
    { day: 'Fri', occupancy: 89, revenue: 17500 },
    { day: 'Sat', occupancy: 96, revenue: 20100 },
    { day: 'Sun', occupancy: 94, revenue: 19200 }
  ]), []);

  return <OccupancyChartPresenter data={weeklyData} />;
};

export default OccupancyChart;
