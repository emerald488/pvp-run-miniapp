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
  // GET — fetch all captured zones (for all players)
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('zones')
      .select('h3_index, owner_id, owner_color')
      .not('owner_id', 'is', null);

    if (error) return res.status(500).json({ error: 'Failed to fetch zones' });
    return res.status(200).json({ zones: data || [] });
  }

  // POST — capture hexes (batch)
  if (req.method === 'POST') {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { hexes } = req.body;
    if (!Array.isArray(hexes) || hexes.length === 0) {
      return res.status(400).json({ error: 'hexes array required' });
    }

    // Get user color
    const { data: userData } = await supabase
      .from('users')
      .select('color')
      .eq('id', userId)
      .single();
    const color = userData?.color || '#4285f4';

    // Batch upsert zones
    const rows = hexes.map((h3Index: string) => ({
      h3_index: h3Index,
      owner_id: userId,
      owner_color: color,
      captured_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('zones').upsert(rows, { onConflict: 'h3_index' });
    if (error) return res.status(500).json({ error: 'Failed to capture zones' });

    // Update user territory count
    const { count } = await supabase
      .from('zones')
      .select('h3_index', { count: 'exact', head: true })
      .eq('owner_id', userId);

    await supabase.from('users').update({ total_territories: count || 0 }).eq('id', userId);

    return res.status(200).json({ captured: hexes.length });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
