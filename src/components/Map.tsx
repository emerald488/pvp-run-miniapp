import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { UserCoordinates } from '../types/location';
import { getVisibleHexes, type ZoneOwner } from '../lib/hexGrid';
import { cellToBoundary } from 'h3-js';

const GRID_SOURCE = 'hex-grid';
const OWNED_SOURCE = 'owned-zones';
const GRID_ZOOM = 14;

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
}

function buildOwnedGeoJSON(
  serverZones: globalThis.Map<string, ZoneOwner>,
  localHexes: Set<string>,
  localColor: string,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  const allKeys = new Set([...serverZones.keys(), ...localHexes]);

  for (const h3Index of allKeys) {
    const boundary = cellToBoundary(h3Index);
    const coords = boundary.map(([lat, lng]) => [lng, lat] as [number, number]);
    coords.push(coords[0]);

    const server = serverZones.get(h3Index);
    const color = server ? server.ownerColor : localColor;

    features.push({
      type: 'Feature',
      properties: { h3Index, color },
      geometry: { type: 'Polygon', coordinates: [coords] },
    });
  }

  return { type: 'FeatureCollection', features };
}

export function GameMap({ coordinates, trackPoints, ownedHexes, serverZones, otherPlayers, userColor = '#4285f4' }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const playerMarkersRef = useRef(new globalThis.Map<string, maplibregl.Marker>());
  const firstCenter = useRef(true);

  // Init map
  useEffect(() => {
    if (!containerRef.current) return;

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const mapStyle = isDark
      ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
      : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
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
        id: 'track-line', type: 'line', source: 'track',
        paint: { 'line-color': '#4285f4', 'line-width': 4, 'line-opacity': 0.9 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      // Owned zones — always visible, independent of viewport
      map.addSource(OWNED_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'owned-fill', type: 'fill', source: OWNED_SOURCE,
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.4 },
      });
      map.addLayer({
        id: 'owned-border', type: 'line', source: OWNED_SOURCE,
        paint: { 'line-color': isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)', 'line-width': 1 },
      });

      // Empty grid — only at high zoom
      map.addSource(GRID_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'grid-fill', type: 'fill', source: GRID_SOURCE,
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.06 },
      });
      map.addLayer({
        id: 'grid-border', type: 'line', source: GRID_SOURCE,
        paint: { 'line-color': isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', 'line-width': 0.5 },
      });
    });

    // Tap on owned zone → show player info popup
    map.on('click', 'owned-fill', async (e) => {
      const props = e.features?.[0]?.properties;
      if (!props?.h3Index) return;

      const zone = serverZones.get(props.h3Index);
      if (!zone?.ownerId) return;

      try {
        const res = await fetch(`/api/player-info?id=${zone.ownerId}`);
        const player = await res.json();
        if (!player.first_name) return;

        const distStr = (player.total_distance_m || 0) < 1000
          ? `${Math.round(player.total_distance_m || 0)} m`
          : `${((player.total_distance_m || 0) / 1000).toFixed(1)} km`;

        const photoHtml = player.photo_url
          ? `<img src="${player.photo_url}" class="popup-photo" />`
          : `<div class="popup-photo-placeholder" style="background:${zone.ownerColor}">${player.first_name[0]}</div>`;

        new maplibregl.Popup({ closeButton: true, maxWidth: '220px' })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div class="map-popup">
              ${photoHtml}
              <div class="map-popup-name">${player.first_name}</div>
              ${player.username ? `<div class="map-popup-user">@${player.username}</div>` : ''}
              <div class="map-popup-stats">
                <span>🔷 ${player.total_territories} зон</span>
                <span>🏃 ${player.total_runs} заб.</span>
                <span>📏 ${distStr}</span>
              </div>
            </div>
          `)
          .addTo(map);
      } catch { /* ignore */ }
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

  // Update owned zones — always visible
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const update = () => {
      const source = map.getSource(OWNED_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (!source) return;
      try {
        const geojson = buildOwnedGeoJSON(serverZones, ownedHexes, userColor);
        source.setData(geojson);
      } catch { /* ignore */ }
    };

    if (map.isStyleLoaded()) {
      update();
    } else {
      map.once('load', update);
    }
  }, [serverZones, ownedHexes, userColor]);

  // Update empty grid on map move (only at high zoom)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let timer: ReturnType<typeof setTimeout>;
    const updateGrid = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!map.isStyleLoaded()) return;
        const source = map.getSource(GRID_SOURCE) as maplibregl.GeoJSONSource | undefined;
        if (!source) return;

        const zoom = map.getZoom();
        if (zoom < GRID_ZOOM) {
          source.setData({ type: 'FeatureCollection', features: [] });
          return;
        }

        try {
          const b = map.getBounds();
          const allOwned = new Set([...ownedHexes, ...serverZones.keys()]);
          const visibleHexes = getVisibleHexes({
            north: b.getNorth(), south: b.getSouth(),
            east: b.getEast(), west: b.getWest(),
          });
          // Only show unowned hexes in grid
          const emptyHexes = visibleHexes.filter((h) => !allOwned.has(h));
          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          const neutralColor = isDark ? '#333344' : '#dde0e6';

          const features: GeoJSON.Feature[] = emptyHexes.map((h3Index) => {
            const boundary = cellToBoundary(h3Index);
            const coords = boundary.map(([lat, lng]) => [lng, lat] as [number, number]);
            coords.push(coords[0]);
            return {
              type: 'Feature' as const,
              properties: { h3Index, color: neutralColor },
              geometry: { type: 'Polygon' as const, coordinates: [coords] },
            };
          });

          source.setData({ type: 'FeatureCollection', features });
        } catch { /* ignore */ }
      }, 200);
    };

    map.on('moveend', updateGrid);
    map.on('zoomend', updateGrid);
    updateGrid();

    return () => {
      map.off('moveend', updateGrid);
      map.off('zoomend', updateGrid);
      clearTimeout(timer);
    };
  }, [ownedHexes, serverZones]);

  // Update other players markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(otherPlayers.map((p) => p.userId));
    for (const [id, marker] of playerMarkersRef.current) {
      if (!currentIds.has(id)) { marker.remove(); playerMarkersRef.current.delete(id); }
    }

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
