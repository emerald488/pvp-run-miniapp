import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { cellToLatLng, isValidCell } from 'h3-js';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.RunPVP_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.RunPVP_SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = process.env.RunPVP_SUPABASE_JWT_SECRET!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MAX_CAPTURE_DISTANCE_M = 100;

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify JWT
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' });
  }

  let userId: string;
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { sub: string };
    userId = payload.sub;
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { h3Index, lat, lng } = req.body;
  if (!h3Index || typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'Missing h3Index, lat, lng' });
  }

  if (!isValidCell(h3Index)) {
    return res.status(400).json({ error: 'Invalid H3 index' });
  }

  // Check proximity
  const [cellLat, cellLng] = cellToLatLng(h3Index);
  const distance = haversineDistance(lat, lng, cellLat, cellLng);
  if (distance > MAX_CAPTURE_DISTANCE_M) {
    return res.status(403).json({ error: 'Too far from zone', distance: Math.round(distance) });
  }

  // Get user color
  const { data: userData } = await supabase
    .from('users')
    .select('color')
    .eq('id', userId)
    .single();

  const color = userData?.color || '#4285f4';

  // Upsert zone
  const { error } = await supabase.from('zones').upsert(
    {
      h3_index: h3Index,
      owner_id: userId,
      owner_color: color,
      captured_at: new Date().toISOString(),
    },
    { onConflict: 'h3_index' },
  );

  if (error) {
    return res.status(500).json({ error: 'Failed to capture zone' });
  }

  return res.status(200).json({ success: true, h3Index, color });
}
