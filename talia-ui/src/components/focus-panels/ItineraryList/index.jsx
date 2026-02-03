import React, { useMemo } from 'react';
import ItineraryListPresenter from './ItineraryListPresenter';

const ItineraryList = () => {
  const itineraries = useMemo(() => ([
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
  ]), []);

  return <ItineraryListPresenter data={itineraries} />;
};

export default ItineraryList;
