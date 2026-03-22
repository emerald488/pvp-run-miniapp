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

/**
 * Check if a user has notifications enabled for a specific type.
 * Used internally by bot.ts and other APIs.
 */
export async function shouldNotify(
  userId: string,
  type: 'zone_attacks' | 'run_reminders' | 'leaderboard',
): Promise<boolean> {
  const { data } = await supabase
    .from('user_settings')
    .select('notify_zone_attacks, notify_run_reminders, notify_leaderboard')
    .eq('user_id', userId)
    .single();

  // Default: zone_attacks and run_reminders ON, leaderboard OFF
  if (!data) {
    return type !== 'leaderboard';
  }

  const settings = data as Record<string, boolean>;
  const key = `notify_${type}`;
  return Boolean(settings[key]);
}

/**
 * Send a notification to a user via Telegram bot.
 * Respects user notification preferences.
 */
export async function sendNotification(
  userId: string,
  type: 'zone_attacks' | 'run_reminders' | 'leaderboard',
  text: string,
  replyMarkup?: object,
): Promise<boolean> {
  const enabled = await shouldNotify(userId, type);
  if (!enabled) return false;

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: userId,
      text,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  }).catch(() => {});

  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    // Get notification preferences (subset of settings)
    const { data } = await supabase
      .from('user_settings')
      .select('notify_zone_attacks, notify_run_reminders, notify_leaderboard')
      .eq('user_id', userId)
      .single();

    return res.status(200).json({
      notifications: data || {
        notify_zone_attacks: true,
        notify_run_reminders: true,
        notify_leaderboard: false,
      },
    });
  }

  if (req.method === 'POST') {
    // Test notification — send a test message to verify bot connection
    const { type } = req.body;
    if (!type || !['zone_attacks', 'run_reminders', 'leaderboard'].includes(type)) {
      return res.status(400).json({ error: 'Invalid notification type' });
    }

    const messages: Record<string, string> = {
      zone_attacks: '🔔 Test: уведомления об атаках на территорию работают!',
      run_reminders: '🔔 Test: напоминания о забегах работают!',
      leaderboard: '🔔 Test: уведомления лидерборда работают!',
    };

    const sent = await sendNotification(userId, type, messages[type]);
    return res.status(200).json({ sent });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
