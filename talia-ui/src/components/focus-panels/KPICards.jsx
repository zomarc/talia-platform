import React from 'react';

const KPICards = () => {
  const kpiData = [
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
      change: '— 12 available',
      trend: 'neutral',
      icon: '🛏️'
    },
    {
      title: 'Voyage Days',
      value: '7',
      change: '— Day 3 of 7',
      trend: 'neutral',
      icon: '📅'
    }
  ];

  return (
    <div style={{ 
      padding: '20px',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '20px'
    }}>
      {kpiData.map((kpi, index) => (
        <div
          key={index}
          style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0'
          }}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            marginBottom: '10px'
          }}>
            <span style={{ fontSize: '24px' }}>{kpi.icon}</span>
            <span style={{ 
              fontSize: '12px', 
              color: kpi.trend === 'up' ? '#4caf50' : kpi.trend === 'down' ? '#f44336' : '#666',
              fontWeight: '500'
            }}>
              {kpi.change}
            </span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '5px' }}>
            {kpi.value}
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            {kpi.title}
          </div>
        </div>
      ))}
    </div>
  );
};

export default KPICards;
