import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
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

  // GET — get active run + track points
  if (req.method === 'GET') {
    const { data: activeRun } = await supabase
      .from('active_runs')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!activeRun) {
      return res.status(200).json({ active: false });
    }

    const { data: points } = await supabase
      .from('track_points')
      .select('latitude, longitude, timestamp')
      .eq('run_id', activeRun.id)
      .order('timestamp', { ascending: true });

    return res.status(200).json({
      active: true,
      runId: activeRun.id,
      startedAt: activeRun.started_at,
      points: points || [],
    });
  }

  // POST — start a new run
  if (req.method === 'POST') {
    // Delete any existing active run
    await supabase.from('active_runs').delete().eq('user_id', userId);

    const { data, error } = await supabase
      .from('active_runs')
      .insert({ user_id: userId })
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'Failed to start run' });

    // Send instruction message via bot
    const telegramId = userId; // user.id is telegram_id as string
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramId,
        text: '🏃 Забег начат!\n\nДля фонового трекинга:\n1. Нажмите 📎 внизу\n2. Location → Share Live Location\n3. Выберите время (1 час)\n\nТрек будет записываться даже при свёрнутом приложении.',
      }),
    }).catch(() => {});

    return res.status(200).json({ runId: data.id, startedAt: data.started_at });
  }

  // DELETE — stop the run, save to runs history
  if (req.method === 'DELETE') {
    const { data: activeRun } = await supabase
      .from('active_runs')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!activeRun) return res.status(200).json({ ok: true });

    // Get all track points
    const { data: points } = await supabase
      .from('track_points')
      .select('latitude, longitude, timestamp')
      .eq('run_id', activeRun.id)
      .order('timestamp', { ascending: true });

    const track = (points || []).map((p: { latitude: number; longitude: number }) => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }));

    // Calculate stats
    let distance = 0;
    for (let i = 1; i < track.length; i++) {
      distance += haversine(track[i - 1], track[i]);
    }

    const startedAt = new Date(activeRun.started_at);
    const finishedAt = new Date();
    const durationS = (finishedAt.getTime() - startedAt.getTime()) / 1000;
    const avgSpeed = durationS > 0 ? (distance / 1000) / (durationS / 3600) : 0;

    // Save to runs history
    if (track.length > 1) {
      await supabase.from('runs').insert({
        user_id: userId,
        started_at: activeRun.started_at,
        finished_at: finishedAt.toISOString(),
        distance_m: distance,
        duration_s: durationS,
        avg_speed_kmh: avgSpeed,
        track,
        territory: null,
      });

      // Update user stats
      const { data: userData } = await supabase
        .from('users')
        .select('total_distance_m, total_runs')
        .eq('id', userId)
        .single();

      if (userData) {
        await supabase.from('users').update({
          total_distance_m: (userData.total_distance_m || 0) + distance,
          total_runs: (userData.total_runs || 0) + 1,
        }).eq('id', userId);
      }
    }

    // Clean up
    await supabase.from('active_runs').delete().eq('user_id', userId);

    return res.status(200).json({ ok: true, distance, durationS, avgSpeed });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

function haversine(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
