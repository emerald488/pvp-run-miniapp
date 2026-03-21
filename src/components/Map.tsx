import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { UserCoordinates } from '../types/location';
import { getVisibleHexes, buildHexGeoJSON, type ZoneOwner } from '../lib/hexGrid';

const HEX_SOURCE = 'hex-grid';
const GRID_ZOOM = 14;  // Show full grid at this zoom and above

export interface OtherPlayer {
  userId: string;
  name: string;
  color: string;
  latitude: number;
  longitude: number;
}

interface MapProps {
  coordinates: UserCoordinates | null;
  trackPoints: UserCoordinates[];
  ownedHexes: Set<string>;
  serverZones: globalThis.Map<string, ZoneOwner>;
  otherPlayers: OtherPlayer[];
  userColor?: string;
  onHexTap?: (ownerId: string) => void;
}

export function GameMap({ coordinates, trackPoints, ownedHexes, serverZones, otherPlayers, userColor = '#4285f4', onHexTap }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const playerMarkersRef = useRef(new globalThis.Map<string, maplibregl.Marker>());
  const firstCenter = useRef(true);

  // Init map
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: coordinates
        ? [coordinates.longitude, coordinates.latitude]
        : [37.6173, 55.7558],
      zoom: 16,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on('load', () => {
      map.resize();

      // Track line
      map.addSource('track', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} },
      });

      map.addLayer({
        id: 'track-line',
        type: 'line',
        source: 'track',
        paint: {
          'line-color': '#4285f4',
          'line-width': 4,
          'line-opacity': 0.9,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      // Hex grid
      map.addSource(HEX_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'hex-fill',
        type: 'fill',
        source: HEX_SOURCE,
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['case', ['get', 'owned'], 0.4, 0.06],
        },
      });

      map.addLayer({
        id: 'hex-border',
        type: 'line',
        source: HEX_SOURCE,
        paint: {
          'line-color': 'rgba(255,255,255,0.2)',
          'line-width': 0.5,
        },
      });
    });

    // Tap on owned hex → show player info
    map.on('click', 'hex-fill', (e) => {
      const props = e.features?.[0]?.properties;
      if (!props?.owned || !props?.h3Index) return;

      // Find owner from serverZones
      const zone = serverZones.get(props.h3Index);
      if (zone?.ownerId && onHexTap) {
        onHexTap(zone.ownerId);
      }
    });

    return () => {
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
      el.innerHTML = '<div class="user-marker-pulse"></div><div class="user-marker-dot"></div>';
      markerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([coordinates.longitude, coordinates.latitude])
        .addTo(map);

      if (firstCenter.current) {
        map.flyTo({ center: [coordinates.longitude, coordinates.latitude], zoom: 16, duration: 1500 });
        firstCenter.current = false;
      }
    } else {
      markerRef.current.setLngLat([coordinates.longitude, coordinates.latitude]);
    }
  }, [coordinates]);

  // Update track line
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('track') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    source.setData({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: trackPoints.map((p) => [p.longitude, p.latitude]) },
      properties: {},
    });
  }, [trackPoints]);

  // Update hex grid
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource(HEX_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    try {
      const zoom = map.getZoom();
      const b = map.getBounds();

      if (zoom >= GRID_ZOOM) {
        // High zoom: show full grid + owned hexes
        const visibleHexes = getVisibleHexes({
          north: b.getNorth(), south: b.getSouth(),
          east: b.getEast(), west: b.getWest(),
        });
        const geojson = buildHexGeoJSON(visibleHexes, serverZones, ownedHexes, userColor);
        source.setData(geojson);
      } else {
        // Low zoom: show only owned/captured hexes (no empty grid)
        const allOwned = new Set([...ownedHexes, ...serverZones.keys()]);
        if (allOwned.size > 0) {
          const geojson = buildHexGeoJSON(Array.from(allOwned), serverZones, ownedHexes, userColor);
          source.setData(geojson);
        } else {
          source.setData({ type: 'FeatureCollection', features: [] });
        }
      }
    } catch {
      // ignore
    }
  }, [ownedHexes, serverZones, userColor, coordinates]);

  // Also update hexes on map move
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let timer: ReturnType<typeof setTimeout>;
    const onMove = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!map.isStyleLoaded()) return;
        const source = map.getSource(HEX_SOURCE) as maplibregl.GeoJSONSource | undefined;
        if (!source) return;
        try {
          const zoom = map.getZoom();
          const b = map.getBounds();
          if (zoom >= GRID_ZOOM) {
            const visibleHexes = getVisibleHexes({
              north: b.getNorth(), south: b.getSouth(),
              east: b.getEast(), west: b.getWest(),
            });
            const geojson = buildHexGeoJSON(visibleHexes, serverZones, ownedHexes, userColor);
            source.setData(geojson);
          } else {
            const allOwned = new Set([...ownedHexes, ...serverZones.keys()]);
            if (allOwned.size > 0) {
              const geojson = buildHexGeoJSON(Array.from(allOwned), serverZones, ownedHexes, userColor);
              source.setData(geojson);
            } else {
              source.setData({ type: 'FeatureCollection', features: [] });
            }
          }
        } catch { /* ignore */ }
      }, 150);
    };

    map.on('moveend', onMove);
    return () => { map.off('moveend', onMove); clearTimeout(timer); };
  }, [ownedHexes, serverZones, userColor]);

  // Update other players markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(otherPlayers.map((p) => p.userId));

    // Remove markers for players no longer active
    for (const [id, marker] of playerMarkersRef.current) {
      if (!currentIds.has(id)) {
        marker.remove();
        playerMarkersRef.current.delete(id);
      }
    }

    // Add/update markers
    for (const player of otherPlayers) {
      let marker = playerMarkersRef.current.get(player.userId);
      if (!marker) {
        const el = document.createElement('div');
        el.className = 'player-marker';
        el.style.background = player.color;
        el.title = player.name;
        el.innerHTML = `<span>${player.name[0]}</span>`;

        marker = new maplibregl.Marker({ element: el })
          .setLngLat([player.longitude, player.latitude])
          .addTo(map);
        playerMarkersRef.current.set(player.userId, marker);
      } else {
        marker.setLngLat([player.longitude, player.latitude]);
      }
    }
  }, [otherPlayers]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
    />
  );
}
