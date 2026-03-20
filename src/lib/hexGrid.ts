import { polygonToCells, cellToBoundary } from 'h3-js';
import type { HexFeatureProperties, ZoneData } from '../types/zone';

const HEX_RESOLUTION = 9;
const NEUTRAL_COLOR = 'rgba(255,255,255,0.08)';

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

  return polygonToCells(polygon, HEX_RESOLUTION, true);
}

export function buildHexGeoJSON(
  hexIndexes: string[],
  ownership: Map<string, ZoneData>,
): GeoJSON.FeatureCollection<GeoJSON.Polygon, HexFeatureProperties> {
  const features: GeoJSON.Feature<GeoJSON.Polygon, HexFeatureProperties>[] = [];

  for (const h3Index of hexIndexes) {
    const boundary = cellToBoundary(h3Index);
    // Convert [lat, lng] to [lng, lat] for GeoJSON
    const coords = boundary.map(([lat, lng]) => [lng, lat] as [number, number]);
    coords.push(coords[0]);

    const zone = ownership.get(h3Index);

    features.push({
      type: 'Feature',
      properties: {
        h3Index,
        ownerId: zone?.ownerId ?? null,
        ownerColor: zone?.ownerColor ?? NEUTRAL_COLOR,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [coords],
      },
    });
  }

  return { type: 'FeatureCollection', features };
}
