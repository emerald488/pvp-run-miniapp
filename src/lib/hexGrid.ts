import { polygonToCells, cellToBoundary, latLngToCell } from 'h3-js';
import type { UserCoordinates } from '../types/location';

const HEX_RESOLUTION = 10;

export interface ZoneOwner {
  ownerId: string;
  ownerColor: string;
}

export function getVisibleHexes(bounds: {
  north: number;
  south: number;
  east: number;
  west: number;
}): string[] {
  const polygon: [number, number][] = [
    [bounds.north, bounds.west],
    [bounds.north, bounds.east],
    [bounds.south, bounds.east],
    [bounds.south, bounds.west],
    [bounds.north, bounds.west],
  ];
  return polygonToCells(polygon, HEX_RESOLUTION);
}

export function coordToHex(coord: UserCoordinates): string {
  return latLngToCell(coord.latitude, coord.longitude, HEX_RESOLUTION);
}

export function trackToHexes(track: UserCoordinates[]): string[] {
  const hexSet = new Set<string>();
  for (const coord of track) {
    hexSet.add(coordToHex(coord));
  }
  return Array.from(hexSet);
}

export function polygonToHexes(polygon: UserCoordinates[]): string[] {
  if (polygon.length < 3) return [];
  const coords: [number, number][] = polygon.map((c) => [c.latitude, c.longitude]);
  if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
    coords.push(coords[0]);
  }
  return polygonToCells(coords, HEX_RESOLUTION);
}

// Build GeoJSON with support for multiple owners + local (current run) hexes
export function buildHexGeoJSON(
  hexIndexes: string[],
  serverZones: globalThis.Map<string, ZoneOwner>,
  localHexes: Set<string>,
  localColor: string,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const h3Index of hexIndexes) {
    const boundary = cellToBoundary(h3Index);
    const coords = boundary.map(([lat, lng]) => [lng, lat] as [number, number]);
    coords.push(coords[0]);

    const serverOwner = serverZones.get(h3Index);
    const isLocal = localHexes.has(h3Index);
    const owned = !!serverOwner || isLocal;
    const neutralColor = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches
      ? '#dde0e6' : '#333344';
    const color = serverOwner ? serverOwner.ownerColor : isLocal ? localColor : neutralColor;

    features.push({
      type: 'Feature',
      properties: { h3Index, owned, color },
      geometry: { type: 'Polygon', coordinates: [coords] },
    });
  }

  return { type: 'FeatureCollection', features };
}
