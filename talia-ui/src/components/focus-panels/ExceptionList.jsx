import React from 'react';

const ExceptionList = () => {
  const exceptions = [
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
  ];

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'High': return '#f44336';
      case 'Medium': return '#ff9800';
      case 'Low': return '#4caf50';
      default: return '#666';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return '#f44336';
      case 'Pending': return '#ff9800';
      case 'Resolved': return '#4caf50';
      default: return '#666';
    }
  };

  return (
    <div style={{ 
      padding: '20px',
      background: 'white',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      border: '1px solid #e0e0e0'
    }}>
      <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
        Active Exceptions
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {exceptions.map(exception => (
          <div
            key={exception.id}
            style={{
              padding: '16px',
              border: '1px solid #e0e0e0',
              borderRadius: '6px',
              background: '#fafafa'
            }}
          >
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'flex-start',
              marginBottom: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '500',
                  color: 'white',
                  background: getSeverityColor(exception.severity)
                }}>
                  {exception.severity}
                </span>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '500',
                  color: 'white',
                  background: getStatusColor(exception.status)
                }}>
                  {exception.status}
                </span>
              </div>
              <span style={{ fontSize: '12px', color: '#666' }}>
                {exception.created}
              </span>
            </div>
            
            <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
              {exception.type}
            </div>
            
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
              {exception.description}
            </div>
            
            <div style={{ 
              display: 'flex', 
              gap: '16px', 
              fontSize: '12px', 
              color: '#666' 
            }}>
              <span><strong>Ship:</strong> {exception.ship}</span>
              <span><strong>Voyage:</strong> {exception.voyage}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExceptionList;
