import React from 'react';

const ItineraryList = () => {
  const itineraries = [
    {
      id: 1,
      name: 'Aegean Gems',
      duration: '7 days',
      ship: 'Celestyal Olympia',
      departure: 'Piraeus',
      ports: ['Mykonos', 'Santorini', 'Kusadasi', 'Patmos', 'Heraklion'],
      status: 'Active',
      nextDeparture: '2024-02-15'
    },
    {
      id: 2,
      name: 'Idyllic Aegean',
      duration: '4 days',
      ship: 'Celestyal Crystal',
      departure: 'Lavrion',
      ports: ['Mykonos', 'Santorini', 'Milos'],
      status: 'Active',
      nextDeparture: '2024-02-18'
    },
    {
      id: 3,
      name: 'Three Continents',
      duration: '7 days',
      ship: 'Celestyal Olympia',
      departure: 'Piraeus',
      ports: ['Kusadasi', 'Rhodes', 'Limassol', 'Haifa', 'Santorini'],
      status: 'Planning',
      nextDeparture: '2024-03-01'
    }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return '#4caf50';
      case 'Planning': return '#ff9800';
      case 'Inactive': return '#f44336';
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
        Cruise Itineraries
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {itineraries.map(itinerary => (
          <div
            key={itinerary.id}
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
              marginBottom: '12px'
            }}>
              <div>
                <h4 style={{ 
                  margin: '0 0 4px 0', 
                  fontSize: '16px', 
                  fontWeight: '600' 
                }}>
                  {itinerary.name}
                </h4>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  {itinerary.ship} • {itinerary.duration} • Departure: {itinerary.departure}
                </div>
              </div>
              <span style={{
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '500',
                color: 'white',
                background: getStatusColor(itinerary.status)
              }}>
                {itinerary.status}
              </span>
            </div>
            
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                <strong>Ports of Call:</strong>
              </div>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '6px' 
              }}>
                {itinerary.ports.map((port, index) => (
                  <span
                    key={index}
                    style={{
                      padding: '2px 6px',
                      background: '#e3f2fd',
                      color: '#1976d2',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  >
                    {port}
                  </span>
                ))}
              </div>
            </div>
            
            <div style={{ 
              fontSize: '12px', 
              color: '#666',
              padding: '8px 0',
              borderTop: '1px solid #e0e0e0'
            }}>
              <strong>Next Departure:</strong> {itinerary.nextDeparture}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ItineraryList;
