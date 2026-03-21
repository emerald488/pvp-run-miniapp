import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.RunPVP_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.RunPVP_SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  // Get all active runs with latest position
  const { data: activeRuns } = await supabase
    .from('active_runs')
    .select('user_id');

  if (!activeRuns || activeRuns.length === 0) {
    return res.status(200).json({ players: [] });
  }

  const players = [];
  for (const run of activeRuns) {
    // Get latest track point
    const { data: point } = await supabase
      .from('track_points')
      .select('latitude, longitude, timestamp')
      .eq('user_id', run.user_id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (!point) continue;

    // Only show if point is fresh (last 5 minutes)
    const age = Date.now() - new Date(point.timestamp).getTime();
    if (age > 300000) continue;

    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('first_name, color')
      .eq('id', run.user_id)
      .single();

    players.push({
      userId: run.user_id,
      name: user?.first_name || '?',
      color: user?.color || '#4285f4',
      latitude: point.latitude,
      longitude: point.longitude,
    });
  }

  return res.status(200).json({ players });
}
