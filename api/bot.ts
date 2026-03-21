import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { latLngToCell } from 'h3-js';

const BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const SUPABASE_URL = process.env.RunPVP_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.RunPVP_SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const HEX_RESOLUTION = 10;

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

      // Capture hex in real-time
      const h3Index = latLngToCell(latitude, longitude, HEX_RESOLUTION);

      // Check previous owner + cooldown
      const { data: prevZone } = await supabase
        .from('zones')
        .select('owner_id, captured_at')
        .eq('h3_index', h3Index)
        .single();

      const prevOwnerId = prevZone?.owner_id;
      const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

      // Skip if zone belongs to another player and cooldown hasn't expired
      if (prevOwnerId && prevOwnerId !== userId && prevZone?.captured_at) {
        const elapsed = Date.now() - new Date(prevZone.captured_at).getTime();
        if (elapsed < COOLDOWN_MS) {
          // Cooldown active — skip capture
        } else {
          // Cooldown expired — allow capture
          const { data: userData } = await supabase
            .from('users')
            .select('color, first_name')
            .eq('id', userId)
            .single();
          const color = userData?.color || '#4285f4';

          await supabase.from('zones').upsert(
            { h3_index: h3Index, owner_id: userId, owner_color: color, captured_at: timestamp },
            { onConflict: 'h3_index' },
          );

          // Notify
          const attackerName = userData?.first_name || 'Игрок';
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: prevOwnerId,
              text: `⚔️ Ваша территория захвачена игроком ${attackerName}!`,
              reply_markup: {
                inline_keyboard: [[
                  { text: '📍 Открыть карту', web_app: { url: 'https://pvp-run-miniapp.vercel.app' } }
                ]],
              },
            }),
          }).catch(() => {});
        }
      } else if (!prevOwnerId || prevOwnerId === userId) {
        // Unclaimed or own zone — always capture
        const { data: userData } = await supabase
          .from('users')
          .select('color, first_name')
          .eq('id', userId)
          .single();
        const color = userData?.color || '#4285f4';

        await supabase.from('zones').upsert(
          { h3_index: h3Index, owner_id: userId, owner_color: color, captured_at: timestamp },
          { onConflict: 'h3_index' },
        );
      }

      // Send confirmation on first point
      if (count === 0) {
        await sendMessage(msg.from.id,
          '📍 Геолокация подключена! Трекинг и захват территории работают в фоне.'
        );
      }
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(200).json({ ok: true });
}
