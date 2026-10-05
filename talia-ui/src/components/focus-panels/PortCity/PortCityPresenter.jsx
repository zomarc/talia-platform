/**
 * Port City presenter — nearest-port labels from Dim_Port_City.
 */

import React, { useEffect, useRef } from 'react';
import ReportProvenance from '../../shared/ReportProvenance';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import { afterTabulatorDataRefresh } from '../../../hooks/useTabulatorLayoutSync';
import {
  resolveViewValue,
  VIEW_COLUMN_FILTERS,
  VIEW_FILTERS,
  VIEW_PORT_CITY_DISPLAY,
  VIEW_PROVENANCE,
} from '../../../lib/componentOptionsCatalog';
import { captureTableScroll, getTabulatorOptions, initTabulator } from '../../../lib/tabulatorConfig';
import PortCityMap from './PortCityMap';
import './port-city.css';

const REGISTRY_OPTIONS = {
  views: [VIEW_PORT_CITY_DISPLAY, VIEW_FILTERS, VIEW_COLUMN_FILTERS, VIEW_PROVENANCE],
};

const formatCoordinate = (value, axis) => {
  if (value == null || value === '') return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  const hemisphere = axis === 'lat' ? (number >= 0 ? 'N' : 'S') : (number >= 0 ? 'E' : 'W');
  const absolute = Math.abs(number);
  let degrees = Math.floor(absolute + 1e-8);
  let minutes = (absolute - degrees) * 60;
  if (minutes >= 59.995) {
    degrees += 1;
    minutes = 0;
  }
  const degreeWidth = axis === 'lat' ? 2 : 3;
  const minuteText = minutes.toFixed(2).padStart(5, '0');
  return `${String(degrees).padStart(degreeWidth, '0')}° ${minuteText}' ${hemisphere}`;
};

const COLUMNS = [
  { field: 'countryCode', title: 'Country', width: 90, headerFilter: 'input' },
  { field: 'locationCode', title: 'Code', width: 80, headerFilter: 'input' },
  { field: 'portName', title: 'NGA name', minWidth: 160, widthGrow: 2, headerFilter: 'input' },
  {
    field: 'isCelestyal',
    title: 'Celestyal',
    width: 110,
    hozAlign: 'center',
    formatter: (cell) => (cell.getValue() ? 'Yes' : ''),
    accessorDownload: (value) => (value ? 'Yes' : ''),
  },
  { field: 'wpi', title: 'WPI', width: 90, headerFilter: 'input' },
  { field: 'region', title: 'Area', width: 150, headerFilter: 'input' },
  { field: 'addressLabel', title: 'Place', minWidth: 160, widthGrow: 1, headerFilter: 'input' },
  { field: 'portAddress', title: 'Address', minWidth: 220, widthGrow: 2, headerFilter: 'input' },
  { field: 'functionName', title: 'Function', width: 110, headerFilter: 'input' },
  { field: 'latitudeLongitude', title: 'Lat/Lon', width: 130, headerFilter: 'input' },
  {
    field: 'latitude',
    title: 'Latitude',
    width: 124,
    hozAlign: 'left',
    formatter: (cell) => formatCoordinate(cell.getValue(), 'lat'),
    accessorDownload: (value) => formatCoordinate(value, 'lat'),
  },
  {
    field: 'longitude',
    title: 'Longitude',
    width: 132,
    hozAlign: 'left',
    formatter: (cell) => formatCoordinate(cell.getValue(), 'lon'),
    accessorDownload: (value) => formatCoordinate(value, 'lon'),
  },
  { field: 'nearestPortName', title: 'Nearest NGA port', minWidth: 160, widthGrow: 2, headerFilter: 'input' },
  { field: 'nearestPortCode', title: 'Nearest WPI', width: 110, headerFilter: 'input' },
  {
    field: 'nearestDistanceNm',
    title: 'Distance nm',
    width: 120,
    hozAlign: 'right',
    formatter: (cell) => {
      const value = cell.getValue();
      return value == null || value === '' ? '' : Number(value).toFixed(1);
    },
  },
];

const PortCityPresenter = ({
  rows = [],
  summary = null,
  search,
  countryCode,
  portKind,
  region,
  distanceBand,
  onSearch,
  onCountryCode,
  onPortKind,
  onRegion,
  onDistanceBand,
  panelInstanceId,
  panelComponentId,
}) => {
  const { showFilters, showProvenance, reportShellClassName, viewsState } = useReportShellOptions(
    panelComponentId,
    panelInstanceId,
    REGISTRY_OPTIONS
  );
  const showMap = resolveViewValue(viewsState, VIEW_PORT_CITY_DISPLAY) === 'map';
  const tableRef = useRef(null);
  const instanceRef = useRef(null);
  const dataRef = useRef(rows);
  const tableBuiltRef = useRef(false);
  dataRef.current = rows;

  useEffect(() => {
    let cancelled = false;
    const initTable = async () => {
      if (!tableRef.current || cancelled) return;
      const Tabulator = await initTabulator();
      if (cancelled || !tableRef.current) return;
      if (instanceRef.current) {
        try { instanceRef.current.destroy(); } catch { /* noop */ }
        instanceRef.current = null;
      }
      instanceRef.current = new Tabulator(tableRef.current, getTabulatorOptions({
        data: [],
        columns: COLUMNS,
        initialSort: [
          { column: 'isCelestyal', dir: 'desc' },
          { column: 'portName', dir: 'asc' },
        ],
        height: '100%',
        selectableRows: false,
        resizableColumns: true,
        movableColumns: true,
        headerFilterLiveFilter: true,
        headerFilterLiveFilterDelay: 300,
        pagination: false,
        rowFormatter: (row) => {
          const data = row.getData() || {};
          const element = row.getElement();
          element.classList.toggle('port-locations__row--celestyal', data.isCelestyal === true);
          element.classList.toggle('port-locations__row--airport', data.isAirport === true && data.isCelestyal !== true);
        },
        panelComponentId: panelComponentId || 'port-city',
        panelInstanceId: panelInstanceId || null,
      }));
      instanceRef.current.on('tableBuilt', () => {
        tableBuiltRef.current = true;
        const next = Array.isArray(dataRef.current) ? dataRef.current : [];
        const scroll = captureTableScroll(instanceRef.current);
        afterTabulatorDataRefresh(
          instanceRef.current,
          Promise.resolve(instanceRef.current.replaceData(next)),
          scroll
        );
      });
    };
    initTable();
    return () => {
      cancelled = true;
      tableBuiltRef.current = false;
      if (instanceRef.current) {
        try { instanceRef.current.destroy(); } catch { /* noop */ }
        instanceRef.current = null;
      }
    };
  }, [panelComponentId, panelInstanceId]);

  useEffect(() => {
    const table = instanceRef.current;
    if (!table || !tableBuiltRef.current) return;
    const scroll = captureTableScroll(table);
    afterTabulatorDataRefresh(
      table,
      Promise.resolve(table.replaceData(Array.isArray(rows) ? rows : [])),
      scroll
    );
  }, [rows]);

  useEffect(() => {
    if (showMap) return undefined;
    const frame = requestAnimationFrame(() => {
      try { instanceRef.current?.redraw(true); } catch { /* noop */ }
    });
    return () => cancelAnimationFrame(frame);
  }, [showMap]);

  const shown = rows.length;
  const matchCount = summary?.matchCount ?? shown;

  return (
    <div
      className={`focus-panel talia-report port-locations ${reportShellClassName || ''}`}
      role="region"
      aria-label="Port locations"
      data-panel-instance-id={panelInstanceId || undefined}
      data-panel-component-id={panelComponentId || undefined}
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Port locations</h2>
          <p className="talia-report__subtitle">
            {summary
              ? `${summary.cruise.toLocaleString()} cruise ports · ${summary.celestyal.toLocaleString()} Celestyal · ${summary.airports.toLocaleString()} airports`
              : 'Cruise ports, Celestyal calls, and airports'}
            {` · ${shown.toLocaleString()} matching`}
          </p>
        </div>
      </header>

      {showFilters ? (
        <div className="talia-report-filters" aria-label="Port location filters">
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">Search</span>
            <input
              className="talia-report-filters__input"
              value={search}
              placeholder="Piraievs or 3756N 02337E"
              onChange={(event) => onSearch(event.target.value)}
            />
          </label>
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">Country</span>
            <input
              className="talia-report-filters__input"
              value={countryCode}
              placeholder="GR"
              maxLength={3}
              onChange={(event) => onCountryCode(event.target.value.toUpperCase())}
            />
          </label>
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">Area</span>
            <select
              className="talia-report-filters__input"
              value={region}
              onChange={(event) => onRegion(event.target.value)}
            >
              <option value="">All areas</option>
              <option value="Mediterranean">Mediterranean</option>
              <option value="Arabian & Red Sea">Arabian &amp; Red Sea</option>
              <option value="United States">United States</option>
              <option value="Caribbean">Caribbean</option>
              <option value="Northern Europe">Northern Europe</option>
              <option value="Rest of World">Rest of World</option>
            </select>
          </label>
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">Ports</span>
            <select
              className="talia-report-filters__input"
              value={portKind}
              onChange={(event) => onPortKind(event.target.value)}
            >
              <option value="cruise">Cruise ports</option>
              <option value="celestyal">Celestyal</option>
              <option value="port">All ports</option>
              <option value="airport">Airports</option>
              <option value="all">All locations</option>
            </select>
          </label>
          <label className="talia-report-filters__group">
            <span className="talia-report-filters__label">Distance</span>
            <select
              className="talia-report-filters__input"
              value={distanceBand}
              onChange={(event) => onDistanceBand(event.target.value)}
            >
              <option value="all">All</option>
              <option value="near">Within 10 nm</option>
              <option value="review">Over 25 nm</option>
            </select>
          </label>
        </div>
      ) : null}

      <ReportProvenance visible={showProvenance}>
        Coordinates come from dwh.Dim_Port_City. Names and the WPI number come from the NGA World Port Index (Pub 150).
        WPI is the comparison key. Cruise ports are the competitor itinerary ports matched to that index, and the list opens on those ports.
        Celestyal marks embark and regular call ports. The address is the passenger landing for that call: the cruise terminal, or the tender pier when the ship anchors.
        Airports are UN/LOCODE function position 4. This table is the working source; the header export is the CSV that can go back to the warehouse.
      </ReportProvenance>

      <main className="talia-report__content">
        <div ref={tableRef} className="focus-panel__table" hidden={showMap} />
        {showMap ? <PortCityMap rows={rows} portKind={portKind} /> : null}
      </main>
    </div>
  );
};

export default PortCityPresenter;
