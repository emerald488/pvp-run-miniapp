import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.RunPVP_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.RunPVP_SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = process.env.RunPVP_SUPABASE_JWT_SECRET!;
const BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();

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

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatPace(speedKmh: number): string {
  if (speedKmh <= 0) return '--:--';
  const paceMin = 60 / speedKmh;
  const mins = Math.floor(paceMin);
  const secs = Math.round((paceMin - mins) * 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { runId } = req.body;
  if (!runId) return res.status(400).json({ error: 'runId required' });

  // Fetch run data
  const { data: run, error } = await supabase
    .from('runs')
    .select('*')
    .eq('id', runId)
    .eq('user_id', userId)
    .single();

  if (error || !run) {
    return res.status(404).json({ error: 'Run not found' });
  }

  // Fetch user info
  const { data: user } = await supabase
    .from('users')
    .select('first_name, username')
    .eq('id', userId)
    .single();

  // Count zones captured during this run's time window
  const { count: zonesCount } = await supabase
    .from('zones')
    .select('h3_index', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .gte('captured_at', run.started_at)
    .lte('captured_at', run.finished_at);

  const distanceKm = (run.distance_m / 1000).toFixed(2);
  const duration = formatDuration(run.duration_s);
  const pace = formatPace(run.avg_speed_kmh);
  const zones = zonesCount || 0;
  const playerName = user?.first_name || 'Runner';

  // Send share message to user's Telegram chat
  const text = [
    `🏃 ${playerName} just finished a run!`,
    '',
    `📏 Distance: ${distanceKm} km`,
    `⏱ Duration: ${duration}`,
    `⚡ Pace: ${pace} min/km`,
    `🔶 Zones captured: ${zones}`,
    '',
    '🎮 Play PVP Run — capture territory by running!',
  ].join('\n');

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: userId,
      text,
      reply_markup: {
        inline_keyboard: [[
          { text: '🗺 Open PVP Run', web_app: { url: 'https://pvp-run-miniapp.vercel.app' } },
        ]],
      },
    }),
  }).catch(() => {});

  return res.status(200).json({
    success: true,
    shareText: text,
    stats: {
      distanceKm: parseFloat(distanceKm),
      duration,
      pace,
      zones,
    },
  });
}
