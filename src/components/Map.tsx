import { useCallback, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { UserCoordinates } from '../types/location';
import type { ZoneData } from '../types/zone';
import { getVisibleHexes, buildHexGeoJSON } from '../lib/hexGrid';
import { fetchZoneOwnership, captureZone } from '../lib/zones';

const HEX_SOURCE = 'hex-grid';
const MIN_HEX_ZOOM = 13;

interface MapProps {
  coordinates: UserCoordinates | null;
  token: string | null;
  userColor?: string;
  userId?: string;
}

export function GameMap({ coordinates, token, userColor = '#4285f4', userId }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const ownershipCache = useRef(new globalThis.Map<string, ZoneData>());
  const updateTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const firstCenter = useRef(true);

  const updateHexGrid = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    const zoom = map.getZoom();
    const source = map.getSource(HEX_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    if (zoom < MIN_HEX_ZOOM) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const b = map.getBounds();
    const hexes = getVisibleHexes({
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
    });

    // Fetch ownership for uncached hexes
    const uncached = hexes.filter((h) => !ownershipCache.current.has(h));
    if (uncached.length > 0) {
      const fetched = await fetchZoneOwnership(uncached);
      for (const [k, v] of fetched) {
        ownershipCache.current.set(k, v);
      }
    }

    const geojson = buildHexGeoJSON(hexes, ownershipCache.current);
    source.setData(geojson);
  }, []);

  const debouncedUpdate = useCallback(() => {
    clearTimeout(updateTimer.current);
    updateTimer.current = setTimeout(updateHexGrid, 150);
  }, [updateHexGrid]);

  // Init map
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

      // Add hex grid source and layers
      map.addSource(HEX_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'hex-fill',
        type: 'fill',
        source: HEX_SOURCE,
        paint: {
          'fill-color': ['get', 'ownerColor'],
          'fill-opacity': [
            'case',
            ['==', ['get', 'ownerId'], null], 0.06,
            0.35,
          ],
        },
      });

      map.addLayer({
        id: 'hex-border',
        type: 'line',
        source: HEX_SOURCE,
        paint: {
          'line-color': 'rgba(255,255,255,0.15)',
          'line-width': 0.5,
        },
      });

      updateHexGrid();
    });

    map.on('moveend', debouncedUpdate);
    map.on('zoomend', debouncedUpdate);

    // Capture zone on tap
    map.on('click', 'hex-fill', async (e) => {
      if (!token || !coordinates || !e.features?.[0]) return;

      const h3Index = e.features[0].properties?.h3Index;
      if (!h3Index) return;

      // Optimistic update
      ownershipCache.current.set(h3Index, {
        h3Index,
        ownerId: userId || null,
        ownerColor: userColor,
        capturedAt: new Date().toISOString(),
      });
      updateHexGrid();

      const result = await captureZone(
        h3Index,
        coordinates.latitude,
        coordinates.longitude,
        token,
      );

      if (!result.success) {
        // Revert on failure
        ownershipCache.current.delete(h3Index);
        updateHexGrid();
      }
    });

    return () => {
      clearTimeout(updateTimer.current);
      markerRef.current?.remove();
      map.remove();
    };
  }, []);

  // Update user position
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

      if (firstCenter.current) {
        map.flyTo({
          center: [coordinates.longitude, coordinates.latitude],
          zoom: 16,
          duration: 1500,
        });
        firstCenter.current = false;
      }
    } else {
      markerRef.current.setLngLat([coordinates.longitude, coordinates.latitude]);
    }
  }, [coordinates]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
    />
  );
}
