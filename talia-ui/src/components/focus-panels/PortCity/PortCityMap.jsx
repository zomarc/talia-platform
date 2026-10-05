/**
 * Canvas markers for every port location that has coordinates.
 */

import React, { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import {
  LEAFLET_ENGLISH_TILE_ATTRIBUTION,
  LEAFLET_ENGLISH_TILE_URL,
  LeafletResizeObserver,
} from '../../shared/maps/LeafletMapDefaults';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const markerStyle = (point, portKind) => {
  if (portKind === 'airport' || (point.isAirport && !point.isCruise && !point.isCelestyal)) {
    return { radius: 4, color: '#5c3d8a', fillColor: '#c4b5fd' };
  }
  if (point.isCelestyal) return { radius: 7, color: '#8a5a00', fillColor: '#f0b429' };
  return { radius: 4, color: '#2f6fad', fillColor: '#7eb6e8' };
};

const PortMarkers = ({ points, portKind }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return undefined;
    const layer = L.layerGroup();
    const renderer = L.canvas({ padding: 0.5 });
    const ordered = [...points].sort((a, b) => Number(a.isCelestyal) - Number(b.isCelestyal));
    ordered.forEach((point) => {
      const title = point.portName || point.addressLabel || point.nearestPortName || point.locationCode || 'Port';
      const code = [point.countryCode, point.locationCode].filter(Boolean).join(' ');
      const style = markerStyle(point, portKind);
      const lines = [
        `<strong>${escapeHtml(title)}</strong>`,
        escapeHtml(code),
        point.wpi ? `WPI ${escapeHtml(point.wpi)}` : '',
        point.isCelestyal ? 'Celestyal' : '',
        point.isAirport ? 'Airport' : '',
        point.addressLabel ? escapeHtml(point.addressLabel) : '',
        point.portAddress ? escapeHtml(point.portAddress) : '',
      ].filter(Boolean);
      L.circleMarker([point.latitude, point.longitude], {
        renderer,
        radius: style.radius,
        color: style.color,
        weight: 1,
        fillColor: style.fillColor,
        fillOpacity: 0.92,
      })
        .bindPopup(lines.join('<br/>'))
        .addTo(layer);
    });
    layer.addTo(map);
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map((point) => [point.latitude, point.longitude]));
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 6, animate: false });
    }
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points, portKind]);

  return null;
};

const PortCityMap = ({ rows = [], portKind = 'cruise' }) => {
  const points = useMemo(
    () => rows.filter((row) => Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude)))
      .map((row) => ({
        ...row,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
      })),
    [rows]
  );

  return (
    <div className="port-locations__map" aria-label="Port map">
      <MapContainer
        center={[30, 20]}
        zoom={2}
        className="port-locations__leaflet"
        zoomControl
        preferCanvas
      >
        <LeafletResizeObserver />
        <TileLayer
          attribution={LEAFLET_ENGLISH_TILE_ATTRIBUTION}
          url={LEAFLET_ENGLISH_TILE_URL}
        />
        <PortMarkers points={points} portKind={portKind} />
      </MapContainer>
      <ul className="port-locations__legend" aria-label="Map key">
        <li><span className="port-locations__swatch port-locations__swatch--celestyal" /> Celestyal</li>
        <li><span className="port-locations__swatch port-locations__swatch--cruise" /> Cruise port</li>
        <li><span className="port-locations__swatch port-locations__swatch--airport" /> Airport</li>
      </ul>
    </div>
  );
};

export default PortCityMap;
