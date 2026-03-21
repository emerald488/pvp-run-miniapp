import { polygonToCells, cellToBoundary } from 'h3-js';
import type { HexFeatureProperties, ZoneData } from '../types/zone';

const HEX_RESOLUTION = 10;
const NEUTRAL_COLOR = '#333344';

export function getVisibleHexes(bounds: {
  north: number;
  south: number;
  east: number;
  west: number;
}): string[] {
  // H3 default format: [lat, lng]
  const polygon: [number, number][] = [
    [bounds.north, bounds.west],
    [bounds.north, bounds.east],
    [bounds.south, bounds.east],
    [bounds.south, bounds.west],
    [bounds.north, bounds.west],
  ];

  return polygonToCells(polygon, HEX_RESOLUTION);
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
    const owned = !!zone?.ownerId;

    features.push({
      type: 'Feature',
      properties: {
        h3Index,
        ownerId: zone?.ownerId ?? '',
        ownerColor: zone?.ownerColor ?? NEUTRAL_COLOR,
        owned,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [coords],
      },
    });
  }

  return { type: 'FeatureCollection', features };
}
