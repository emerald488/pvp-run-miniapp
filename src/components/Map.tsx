import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { UserCoordinates } from '../types/location';

interface MapProps {
  coordinates: UserCoordinates | null;
}

export function Map({ coordinates }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: coordinates
        ? [coordinates.longitude, coordinates.latitude]
        : [37.6173, 55.7558],
      zoom: 15,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on('load', () => {
      map.resize();
    });

    return () => {
      markerRef.current?.remove();
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (!coordinates || !mapRef.current) return;

    const map = mapRef.current;

    if (!markerRef.current) {
      const el = document.createElement('div');
      el.className = 'user-marker';
      el.innerHTML = `
        <div class="user-marker-pulse"></div>
        <div class="user-marker-dot"></div>
      `;

      markerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([coordinates.longitude, coordinates.latitude])
        .addTo(map);

      map.flyTo({
        center: [coordinates.longitude, coordinates.latitude],
        zoom: 16,
        duration: 1500,
      });
    } else {
      markerRef.current.setLngLat([coordinates.longitude, coordinates.latitude]);
      map.flyTo({
        center: [coordinates.longitude, coordinates.latitude],
        duration: 1000,
      });
    }
  }, [coordinates]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
    />
  );
}
