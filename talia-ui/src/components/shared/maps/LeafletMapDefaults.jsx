import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

export const LEAFLET_ENGLISH_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const LEAFLET_ENGLISH_TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const LeafletResizeObserver = () => {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof ResizeObserver === 'undefined') return undefined;
    const mapContainer = map.getContainer?.();
    const observedElement = mapContainer?.parentElement || mapContainer;
    if (!observedElement) return undefined;

    const observer = new ResizeObserver(() => {
      map.invalidateSize({ pan: false, animate: false });
    });

    observer.observe(observedElement);
    return () => observer.disconnect();
  }, [map]);

  return null;
};
