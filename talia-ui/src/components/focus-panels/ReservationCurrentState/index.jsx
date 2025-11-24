/**
 * Reservation Current State Container Component
 * Handles data fetching and state management
 */

import React, { useState, useEffect } from 'react';
import ReservationCurrentStatePresenter from './ReservationCurrentStatePresenter';
import LoadingSpinner from '../../shared/LoadingSpinner';
import ErrorMessage from '../../shared/ErrorMessage';
import { apolloClient } from '../../../lib/apolloClient';
import { gql } from '@apollo/client';

const GET_RESERVATIONS = gql`
  query GetReservations($filters: ReservationFilters) {
    reservations(filters: $filters) {
      id
      res_id
      res_status
      source_code
      res_probability
      pax_type
      pax_status
      ship
      sail_code
      sail_duration
      sail_from_date
      sail_to_date
      agency_id
      sec_agency_id
      agency_channel
      agency_country_code
      agency_market
      cabin_type
      cabin_category
      ticket_type
      promo_code
      currency
      currency_rate
      guest_count
      foc_guest_count
      gross_published_fare
      gross_selling_fare
      net_selling_fare
      cruise_fare_comm
      published_discount
      promotional_discounts
      total_discounts
      gross_ticket_revenue
      net_ticket_revenue
      net_invoice_revenue
      gross_ticket_revenue_eur
      net_ticket_revenue_eur
      net_invoice_revenue_eur
      total_discounts_eur
      created_at
    }
  }
`;

const GET_USER_PREFERENCES = gql`
  query GetMe {
    me {
      id
      preferences {
        selectedSailCode
      }
    }
  }
`;

const ReservationCurrentStateContainer = ({ filters = {}, theme }) => {
  const [selectedSailCode, setSelectedSailCode] = useState(null);
  const [queryFilters, setQueryFilters] = useState(filters);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);

  // Load user preferences on mount to get stored sail selection
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const result = await apolloClient.query({
          query: GET_USER_PREFERENCES,
          fetchPolicy: 'network-only'
        });
        
        const storedSailCode = result.data?.me?.preferences?.selectedSailCode;
        if (storedSailCode) {
          console.log('[ReservationCurrentState] Loaded stored sail selection:', storedSailCode);
          setSelectedSailCode(storedSailCode);
          setQueryFilters({
            ...filters,
            sail_code: storedSailCode
          });
        }
      } catch (err) {
        console.error('[ReservationCurrentState] Error loading user preferences:', err);
      } finally {
        setInitialLoad(false);
      }
    };

    loadUserPreferences();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apolloClient.query({
        query: GET_RESERVATIONS,
        variables: { filters: queryFilters }
      });
      setData(result.data?.reservations || []);
    } catch (err) {
      setError(err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Listen for sail selection events
  useEffect(() => {
    const handleSailSelect = (event) => {
      const sailCode = event.detail?.sail_code;
      setSelectedSailCode(sailCode);
      setQueryFilters({
        ...filters,
        sail_code: sailCode || undefined
      });
    };

    const handleSailClear = () => {
      setSelectedSailCode(null);
      setQueryFilters(filters);
    };

    window.addEventListener('talia:sail.select', handleSailSelect);
    window.addEventListener('talia:sail.clear', handleSailClear);

    return () => {
      window.removeEventListener('talia:sail.select', handleSailSelect);
      window.removeEventListener('talia:sail.clear', handleSailClear);
    };
  }, [filters]);

  useEffect(() => {
    // Wait for initial load of user preferences before fetching data
    if (!initialLoad) {
      fetchData();
    }
  }, [JSON.stringify(queryFilters), initialLoad]);

  // Handle loading state
  if (loading) {
    return <LoadingSpinner message="Loading reservations..." fullScreen={false} />;
  }

  // Handle error state
  if (error) {
    return (
      <ErrorMessage 
        error={error} 
        title="Failed to load reservations"
        onRetry={fetchData}
      />
    );
  }

  // Handle empty data
  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>No reservations available{selectedSailCode ? ` for sail code: ${selectedSailCode}` : ''}</p>
        <button onClick={fetchData}>Retry</button>
      </div>
    );
  }

  // Render presenter with data
  return (
    <ReservationCurrentStatePresenter 
      data={data} 
      theme={theme}
      onRefresh={fetchData}
    />
  );
};

export default ReservationCurrentStateContainer;
