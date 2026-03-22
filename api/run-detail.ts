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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const runId = req.query.id as string;
  if (!runId) return res.status(400).json({ error: 'Run ID required' });

  // Fetch run
  const { data: run, error } = await supabase
    .from('runs')
    .select('*')
    .eq('id', runId)
    .eq('user_id', userId)
    .single();

  if (error || !run) {
    return res.status(404).json({ error: 'Run not found' });
  }

  // Count zones captured during this run
  const { count: zonesCount } = await supabase
    .from('zones')
    .select('h3_index', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .gte('captured_at', run.started_at)
    .lte('captured_at', run.finished_at);

  // Get track points for detailed route
  const { data: trackPoints } = await supabase
    .from('track_points')
    .select('latitude, longitude, timestamp')
    .eq('run_id', runId)
    .order('timestamp', { ascending: true });

  return res.status(200).json({
    run: {
      ...run,
      zones_captured: zonesCount || 0,
      track_points: trackPoints || [],
    },
  });
}
