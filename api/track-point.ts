import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { latLngToCell } from 'h3-js';

const SUPABASE_URL = process.env.RunPVP_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.RunPVP_SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = process.env.RunPVP_SUPABASE_JWT_SECRET!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const HEX_RESOLUTION = 10;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  let userId: string;
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { sub: string };
    userId = payload.sub;
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { latitude, longitude } = req.body;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({ error: 'Missing lat/lng' });
  }

  // Check active run
  const { data: activeRun } = await supabase
    .from('active_runs')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!activeRun) return res.status(200).json({ ok: false });

  const timestamp = new Date().toISOString();

  // Save track point
  await supabase.from('track_points').insert({
    run_id: activeRun.id,
    user_id: userId,
    latitude,
    longitude,
    timestamp,
  });

  // Capture hex with 30-min cooldown
  const h3Index = latLngToCell(latitude, longitude, HEX_RESOLUTION);
  const COOLDOWN_MS = 30 * 60 * 1000;

  const { data: prevZone } = await supabase
    .from('zones')
    .select('owner_id, captured_at')
    .eq('h3_index', h3Index)
    .single();

  const canCapture = !prevZone?.owner_id
    || prevZone.owner_id === userId
    || (Date.now() - new Date(prevZone.captured_at || 0).getTime()) >= COOLDOWN_MS;

  if (canCapture) {
    const { data: userData } = await supabase
      .from('users')
      .select('color, first_name')
      .eq('id', userId)
      .single();

    await supabase.from('zones').upsert(
      {
        h3_index: h3Index,
        owner_id: userId,
        owner_color: userData?.color || '#4285f4',
        captured_at: timestamp,
      },
      { onConflict: 'h3_index' },
    );

    // Notify previous owner if stolen
    if (prevZone?.owner_id && prevZone.owner_id !== userId) {
      const BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: prevZone.owner_id,
          text: `⚔️ Ваша территория захвачена игроком ${userData?.first_name || 'Игрок'}!`,
          reply_markup: {
            inline_keyboard: [[
              { text: '📍 Открыть карту', web_app: { url: 'https://pvp-run-miniapp.vercel.app' } }
            ]],
          },
        }),
      }).catch(() => {});
    }
  }

  return res.status(200).json({ ok: true });
}
