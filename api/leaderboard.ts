import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.RunPVP_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.RunPVP_SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, username, color, total_distance_m, total_runs');

  if (!users) return res.status(200).json({ players: [] });

  // Count zones per user
  const { data: zones } = await supabase.from('zones').select('owner_id');
  const zoneMap = new globalThis.Map<string, number>();
  for (const z of zones || []) {
    zoneMap.set(z.owner_id, (zoneMap.get(z.owner_id) || 0) + 1);
  }

  // Calculate distance from track_points for users with active runs
  const { data: activeRuns } = await supabase.from('active_runs').select('id, user_id');
  const activeDistances = new globalThis.Map<string, number>();

  for (const ar of activeRuns || []) {
    const { data: points } = await supabase
      .from('track_points')
      .select('latitude, longitude')
      .eq('run_id', ar.id)
      .order('timestamp', { ascending: true });

    if (points && points.length > 1) {
      let dist = 0;
      for (let i = 1; i < points.length; i++) {
        dist += haversine(points[i - 1].latitude, points[i - 1].longitude, points[i].latitude, points[i].longitude);
      }
      activeDistances.set(ar.user_id, dist);
    }
  }

  // Count completed runs per user
  const { data: runCounts } = await supabase.from('runs').select('user_id');
  const runMap = new globalThis.Map<string, number>();
  for (const r of runCounts || []) {
    runMap.set(r.user_id, (runMap.get(r.user_id) || 0) + 1);
  }

  const players = users
    .map((u) => {
      const completedDist = u.total_distance_m || 0;
      const activeDist = activeDistances.get(u.id) || 0;
      const totalTerritories = zoneMap.get(u.id) || 0;
      const hasActiveRun = activeRuns?.some((ar) => ar.user_id === u.id);
      const totalRuns = (runMap.get(u.id) || 0) + (hasActiveRun ? 1 : 0);

      return {
        id: u.id,
        first_name: u.first_name,
        username: u.username,
        color: u.color,
        total_distance_m: completedDist + activeDist,
        total_runs: totalRuns,
        total_territories: totalTerritories,
      };
    })
    .filter((u) => u.total_territories > 0 || u.total_runs > 0)
    .sort((a, b) => b.total_territories - a.total_territories);

  return res.status(200).json({ players });
}
