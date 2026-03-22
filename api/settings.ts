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

const DEFAULT_SETTINGS = {
  notify_zone_attacks: true,
  notify_run_reminders: true,
  notify_leaderboard: false,
  gps_high_accuracy: true,
  gps_background_tracking: false,
  onboarding_completed: false,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Return defaults if no settings saved yet
      return res.status(200).json({ settings: { user_id: userId, ...DEFAULT_SETTINGS } });
    }

    return res.status(200).json({ settings: data });
  }

  if (req.method === 'PUT') {
    const updates = req.body;

    // Only allow known setting keys
    const allowed = Object.keys(DEFAULT_SETTINGS);
    const filtered: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in updates) {
        filtered[key] = updates[key];
      }
    }

    if (Object.keys(filtered).length === 0) {
      return res.status(400).json({ error: 'No valid settings provided' });
    }

    const { data, error } = await supabase
      .from('user_settings')
      .upsert(
        { user_id: userId, ...filtered, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'Failed to update settings' });
    return res.status(200).json({ settings: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
