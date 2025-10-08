import React from 'react';

const RevenueBreakdown = () => {
  const revenueData = [
    { category: 'Cabins', amount: 65800, percentage: 51.6, color: '#1976d2' },
    { category: 'Food & Beverage', amount: 28900, percentage: 22.7, color: '#4caf50' },
    { category: 'Entertainment', amount: 15200, percentage: 11.9, color: '#ff9800' },
    { category: 'Spa & Wellness', amount: 9800, percentage: 7.7, color: '#9c27b0' },
    { category: 'Excursions', amount: 7750, percentage: 6.1, color: '#e91e63' }
  ];

  const totalRevenue = revenueData.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div style={{ 
      padding: '20px',
      background: 'white',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      border: '1px solid #e0e0e0'
    }}>
      <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
        Today's Revenue by Category
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {revenueData.map((item, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: item.color,
              flexShrink: 0
            }} />
            
            <div style={{ 
              flex: 1, 
              height: '20px', 
              background: '#e0e0e0', 
              borderRadius: '10px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${item.percentage}%`,
                height: '100%',
                background: item.color,
                borderRadius: '10px',
                transition: 'width 0.3s ease'
              }} />
            </div>
            
            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              fontSize: '12px',
              minWidth: '120px',
              justifyContent: 'flex-end'
            }}>
              <span style={{ fontWeight: '500' }}>€{item.amount.toLocaleString()}</span>
              <span style={{ color: '#666' }}>({item.percentage}%)</span>
            </div>
          </div>
        ))}
      </div>
      
      <div style={{ 
        marginTop: '20px', 
        paddingTop: '16px', 
        borderTop: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '14px', fontWeight: '600' }}>Total Revenue</span>
        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1976d2' }}>
          €{totalRevenue.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

export default RevenueBreakdown;
