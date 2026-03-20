import { supabase } from './supabase';
import type { ZoneData } from '../types/zone';

export async function fetchZoneOwnership(h3Indexes: string[]): Promise<Map<string, ZoneData>> {
  const map = new Map<string, ZoneData>();
  if (h3Indexes.length === 0) return map;

  // Batch in chunks of 500 to avoid query size limits
  const chunkSize = 500;
  for (let i = 0; i < h3Indexes.length; i += chunkSize) {
    const chunk = h3Indexes.slice(i, i + chunkSize);
    const { data } = await supabase
      .from('zones')
      .select('h3_index, owner_id, owner_color, captured_at')
      .in('h3_index', chunk);

    if (data) {
      for (const row of data) {
        map.set(row.h3_index, {
          h3Index: row.h3_index,
          ownerId: row.owner_id,
          ownerColor: row.owner_color,
          capturedAt: row.captured_at,
        });
      }
    }
  }

  return map;
}

export async function captureZone(
  h3Index: string,
  lat: number,
  lng: number,
  token: string,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch('/api/capture', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ h3Index, lat, lng }),
  });

  const body = await res.json();
  if (!res.ok) return { success: false, error: body.error };
  return { success: true };
}
