import React from 'react';

const OccupancyChart = () => {
  const weeklyData = [
    { day: 'Mon', occupancy: 92, revenue: 18500 },
    { day: 'Tue', occupancy: 88, revenue: 17200 },
    { day: 'Wed', occupancy: 95, revenue: 19800 },
    { day: 'Thu', occupancy: 91, revenue: 18200 },
    { day: 'Fri', occupancy: 89, revenue: 17500 },
    { day: 'Sat', occupancy: 96, revenue: 20100 },
    { day: 'Sun', occupancy: 94, revenue: 19200 }
  ];

  const maxOccupancy = Math.max(...weeklyData.map(d => d.occupancy));

  return (
    <div style={{ 
      padding: '20px',
      background: 'white',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      border: '1px solid #e0e0e0'
    }}>
      <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
        Weekly Occupancy & Revenue
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {weeklyData.map((data, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '40px', 
              fontSize: '12px', 
              fontWeight: '500',
              color: '#666'
            }}>
              {data.day}
            </div>
            
            <div style={{ 
              flex: 1, 
              height: '24px', 
              background: '#e0e0e0', 
              borderRadius: '12px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${(data.occupancy / maxOccupancy) * 100}%`,
                height: '100%',
                background: '#1976d2',
                borderRadius: '12px',
                transition: 'width 0.3s ease'
              }} />
            </div>
            
            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              fontSize: '12px',
              minWidth: '120px'
            }}>
              <span style={{ fontWeight: '500' }}>{data.occupancy}%</span>
              <span style={{ color: '#666' }}>€{data.revenue.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OccupancyChart;
