import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.RunPVP_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.RunPVP_SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = req.query.id as string;
  if (!userId) return res.status(400).json({ error: 'Missing id' });

  const { data: user } = await supabase
    .from('users')
    .select('id, first_name, username, color, total_distance_m, total_runs, total_territories')
    .eq('id', userId)
    .single();

  if (!user) return res.status(404).json({ error: 'User not found' });

  // Count actual zones
  const { count } = await supabase
    .from('zones')
    .select('h3_index', { count: 'exact', head: true })
    .eq('owner_id', userId);

  return res.status(200).json({
    ...user,
    total_territories: count || 0,
  });
}
