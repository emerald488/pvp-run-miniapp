import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.RunPVP_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.RunPVP_SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const { data, error } = await supabase
    .from('users')
    .select('id, first_name, username, color, total_distance_m, total_runs, total_territories')
    .or('total_runs.gt.0,total_territories.gt.0')
    .order('total_territories', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: 'Failed to fetch leaderboard' });
  return res.status(200).json({ players: data || [] });
}
