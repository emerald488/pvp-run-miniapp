import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const SUPABASE_URL = process.env.RunPVP_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.RunPVP_SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sendMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true });
  }

  const update = req.body;

  // Handle /start command
  if (update.message?.text === '/start') {
    await sendMessage(update.message.chat.id,
      '🏃 PVP Run — захватывай территорию бегом!\n\nНажми кнопку App внизу, чтобы начать.'
    );
    return res.status(200).json({ ok: true });
  }

  // Handle live location updates
  if (update.edited_message?.location || update.message?.location) {
    const msg = update.edited_message || update.message;
    const userId = String(msg.from.id);
    const { latitude, longitude } = msg.location;
    const timestamp = new Date((msg.edit_date || msg.date) * 1000).toISOString();

    // Check if user has an active run
    const { data: activeRun } = await supabase
      .from('active_runs')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (activeRun) {
      // Check if this is the first point
      const { count } = await supabase
        .from('track_points')
        .select('id', { count: 'exact', head: true })
        .eq('run_id', activeRun.id);

      // Append point to active run track
      await supabase.from('track_points').insert({
        run_id: activeRun.id,
        user_id: userId,
        latitude,
        longitude,
        timestamp,
      });

      // Send confirmation on first point
      if (count === 0) {
        await sendMessage(msg.from.id,
          '📍 Геолокация подключена! Трекинг работает в фоне.\n\nМожете свернуть приложение — маршрут записывается.'
        );
      }
    } else {
      // No active run — let user know
      await sendMessage(msg.from.id,
        '⚠️ Нет активного забега. Сначала нажмите START в приложении.'
      );
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(200).json({ ok: true });
}
