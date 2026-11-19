/**
 * Port City — container for dwh.Dim_Port_City nearest-port labels.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import usePanelTrackedFetch from '../../../hooks/usePanelTrackedFetch';
import PanelDataState from '../../shared/PanelDataState';
import PortCityPresenter from './PortCityPresenter';

const PAGE_SIZE = 20000;

const PAGE_QUERY = `
  query PortCityPage($filters: PortCityFilters) {
    portCityPage(filters: $filters) {
      total
      withCoordinates
      ports
      labeled
      cruise
      celestyal
      airports
      matchCount
      rows {
        countryLocation
        countryCode
        locationCode
        portName
        portCity
        functionName
        latitudeLongitude
        latitude
        longitude
        nearestPortCode
        nearestPortName
        nearestDistanceNm
        isPort
        wpi
        isCruise
        isAirport
        isCelestyal
        region
        portAddress
        addressLabel
      }
    }
  }
`;

const PortCityContainer = ({ panelInstanceId, panelComponentId }) => {
  const [search, setSearch] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [portKind, setPortKind] = useState('cruise');
  const [region, setRegion] = useState('');
  const [distanceBand, setDistanceBand] = useState('all');
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { shouldSkipRefresh, fetchGraphql, onResumeFetch } = usePanelTrackedFetch(
    panelInstanceId,
    panelComponentId
  );
  const loadRef = useRef(null);

  const filtersFor = useCallback((extra = {}) => {
    const filters = {
      search: search.trim() || null,
      countryCode: countryCode.trim() || null,
      kind: portKind || null,
      region: region || null,
      limit: PAGE_SIZE,
      offset: 0,
      ...extra,
    };
    if (distanceBand === 'near') filters.maxDistanceNm = 10;
    if (distanceBand === 'review') filters.minDistanceNm = 25;
    return filters;
  }, [countryCode, distanceBand, portKind, region, search]);

  const load = useCallback(async () => {
    if (shouldSkipRefresh()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = [];
      let summary = null;
      for (let offset = 0; offset < 200000; offset += PAGE_SIZE) {
        const data = await fetchGraphql({
          query: PAGE_QUERY,
          variables: { filters: filtersFor({ limit: PAGE_SIZE, offset }) },
          component: 'PortCity',
          purpose: 'Load port city labels',
          tableName: 'port_city',
        });
        const nextPage = data?.portCityPage;
        if (!summary && nextPage) {
          summary = nextPage;
        }
        const batch = nextPage?.rows || [];
        rows.push(...batch);
        if (batch.length < PAGE_SIZE) break;
      }
      setPage(summary ? { ...summary, rows } : null);
    } catch (err) {
      if (err?.code === 'PANEL_PAUSED') return;
      setError(err?.message || 'Failed to load port cities');
    } finally {
      setLoading(false);
    }
  }, [fetchGraphql, filtersFor, shouldSkipRefresh]);

  loadRef.current = load;

  useEffect(() => {
    onResumeFetch(() => { loadRef.current?.(); });
    return () => onResumeFetch(null);
  }, [onResumeFetch]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const rows = page?.rows || [];

  return (
    <PanelDataState
      loading={loading && rows.length === 0}
      error={error}
      empty={!loading && rows.length === 0}
      loadingMessage="Loading port locations..."
    >
      <PortCityPresenter
        rows={rows}
        summary={page}
        search={search}
        countryCode={countryCode}
        portKind={portKind}
        region={region}
        distanceBand={distanceBand}
        onSearch={setSearch}
        onCountryCode={setCountryCode}
        onPortKind={setPortKind}
        onRegion={setRegion}
        onDistanceBand={setDistanceBand}
        panelInstanceId={panelInstanceId}
        panelComponentId={panelComponentId}
      />
    </PanelDataState>
  );
};

export default PortCityContainer;
