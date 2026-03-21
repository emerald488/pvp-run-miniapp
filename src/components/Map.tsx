import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [debugInfo, setDebugInfo] = useState('init');

  const updateHexGrid = useCallback(async () => {
    try {
      const map = mapRef.current;
      if (!map) { setDebugInfo('no map'); return; }

      const zoom = map.getZoom();
      const source = map.getSource(HEX_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (!source) { setDebugInfo(`no source, zoom=${zoom.toFixed(1)}`); return; }

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
        try {
          const fetched = await fetchZoneOwnership(uncached);
          for (const [k, v] of fetched) {
            ownershipCache.current.set(k, v);
          }
        } catch {
          // Supabase fetch failed, continue with cached data
        }
      }

      const geojson = buildHexGeoJSON(hexes, ownershipCache.current);
      source.setData(geojson);
      setDebugInfo(`hexes: ${hexes.length}, features: ${geojson.features.length}`);
    } catch (err) {
      setDebugInfo(`error: ${err}`);
    }
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

      try {
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
            'fill-opacity': 0.3,
          },
        });

        map.addLayer({
          id: 'hex-border',
          type: 'line',
          source: HEX_SOURCE,
          paint: {
            'line-color': 'rgba(255,255,255,0.4)',
            'line-width': 1,
          },
        });

        updateHexGrid();
      } catch (err) {
        console.error('Failed to add hex layers:', err);
      }
    });

    map.on('moveend', debouncedUpdate);
    map.on('zoomend', debouncedUpdate);

    map.on('click', 'hex-fill', async (e) => {
      if (!token || !coordinates || !e.features?.[0]) return;

      const h3Index = e.features[0].properties?.h3Index;
      if (!h3Index) return;

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
    <>
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
      />
      <div style={{
        position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.7)',
        color: '#0f0', padding: '4px 8px', fontSize: 11, borderRadius: 4, zIndex: 999,
      }}>
        {debugInfo}
      </div>
    </>
  );
}
