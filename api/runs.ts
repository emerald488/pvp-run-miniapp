import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.RunPVP_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.RunPVP_SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = process.env.RunPVP_SUPABASE_JWT_SECRET!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function getUserId(req: VercelRequest): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { sub: string };
    return payload.sub;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('runs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: 'Failed to fetch runs' });
    return res.status(200).json({ runs: data });
  }

  if (req.method === 'POST') {
    const { startedAt, finishedAt, distanceM, durationS, avgSpeedKmh, track, territory } = req.body;

    const { error } = await supabase.from('runs').insert({
      user_id: userId,
      started_at: startedAt,
      finished_at: finishedAt,
      distance_m: distanceM,
      duration_s: durationS,
      avg_speed_kmh: avgSpeedKmh,
      track,
      territory,
    });

    if (error) return res.status(500).json({ error: 'Failed to save run' });

    // Update user stats
    const { data: userData } = await supabase
      .from('users')
      .select('total_distance_m, total_runs, total_territories')
      .eq('id', userId)
      .single();

    if (userData) {
      await supabase.from('users').update({
        total_distance_m: (userData.total_distance_m || 0) + distanceM,
        total_runs: (userData.total_runs || 0) + 1,
        total_territories: (userData.total_territories || 0) + (territory ? 1 : 0),
      }).eq('id', userId);
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
