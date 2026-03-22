import type { UserCoordinates } from '../types/location';

export interface RunDetail {
  id: string;
  user_id: string;
  started_at: string;
  finished_at: string;
  distance_m: number;
  duration_s: number;
  avg_speed_kmh: number;
  track: UserCoordinates[];
  territory: UserCoordinates[] | null;
  zones_captured: number;
  track_points: Array<{
    latitude: number;
    longitude: number;
    timestamp: string;
  }>;
}

export async function fetchRunDetail(token: string, runId: string): Promise<RunDetail> {
  const res = await fetch(`/api/run-detail?id=${encodeURIComponent(runId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error('Failed to fetch run detail');
  }

  const { run } = await res.json();
  return run;
}
