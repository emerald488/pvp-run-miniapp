import { polygonToCells, cellToBoundary, latLngToCell } from 'h3-js';
import type { UserCoordinates } from '../types/location';

const HEX_RESOLUTION = 10;

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

// Get the hex cell for a coordinate
export function coordToHex(coord: UserCoordinates): string {
  return latLngToCell(coord.latitude, coord.longitude, HEX_RESOLUTION);
}

// Get all hex cells along a track
export function trackToHexes(track: UserCoordinates[]): string[] {
  const hexSet = new Set<string>();
  for (const coord of track) {
    hexSet.add(coordToHex(coord));
  }
  return Array.from(hexSet);
}

// Get all hex cells inside a closed polygon
export function polygonToHexes(polygon: UserCoordinates[]): string[] {
  if (polygon.length < 3) return [];
  const coords: [number, number][] = polygon.map((c) => [c.latitude, c.longitude]);
  // Close the polygon if not closed
  if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
    coords.push(coords[0]);
  }
  return polygonToCells(coords, HEX_RESOLUTION);
}

// Build GeoJSON for hex grid with ownership
export function buildHexGeoJSON(
  hexIndexes: string[],
  ownedHexes: Set<string>,
  ownerColor: string,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const h3Index of hexIndexes) {
    const boundary = cellToBoundary(h3Index);
    const coords = boundary.map(([lat, lng]) => [lng, lat] as [number, number]);
    coords.push(coords[0]);

    const owned = ownedHexes.has(h3Index);

    features.push({
      type: 'Feature',
      properties: {
        h3Index,
        owned,
        color: owned ? ownerColor : '#333344',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [coords],
      },
    });
  }

  return { type: 'FeatureCollection', features };
}
