import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.RunPVP_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.RunPVP_SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  // Get all users who have at least 1 zone or 1 run
  const { data: users } = await supabase
    .from('users')
    .select('id, first_name, username, color, total_distance_m, total_runs');

  if (!users) return res.status(200).json({ players: [] });

  // Count zones per user from zones table (real-time accurate)
  const { data: zoneCounts } = await supabase
    .from('zones')
    .select('owner_id');

  const zoneMap = new Map<string, number>();
  for (const z of zoneCounts || []) {
    zoneMap.set(z.owner_id, (zoneMap.get(z.owner_id) || 0) + 1);
  }

  const players = users
    .map((u) => ({
      ...u,
      total_territories: zoneMap.get(u.id) || 0,
    }))
    .filter((u) => u.total_territories > 0 || (u.total_runs || 0) > 0)
    .sort((a, b) => b.total_territories - a.total_territories);

  return res.status(200).json({ players });
}
