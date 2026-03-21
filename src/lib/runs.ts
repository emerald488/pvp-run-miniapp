import type { UserCoordinates } from '../types/location';

export interface SavedRun {
  id: string;
  started_at: string;
  finished_at: string;
  distance_m: number;
  duration_s: number;
  avg_speed_kmh: number;
  track: UserCoordinates[];
  territory: UserCoordinates[] | null;
}

export async function saveRun(
  token: string,
  data: {
    startedAt: string;
    finishedAt: string;
    distanceM: number;
    durationS: number;
    avgSpeedKmh: number;
    track: UserCoordinates[];
    territory: UserCoordinates[] | null;
  },
): Promise<boolean> {
  const res = await fetch('/api/runs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return res.ok;
}

export async function fetchRuns(token: string): Promise<SavedRun[]> {
  const res = await fetch('/api/runs', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const { runs } = await res.json();
  return runs;
}
