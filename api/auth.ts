import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const SUPABASE_URL = process.env.RunPVP_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.RunPVP_SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = process.env.RunPVP_SUPABASE_JWT_SECRET!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function validateInitData(initData: string): Record<string, string> | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  params.delete('hash');

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest();

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (computedHash !== hash) return null;

  const authDate = parseInt(params.get('auth_date') || '0', 10);
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > 300) return null; // 5 minutes

  return Object.fromEntries(params.entries());
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { initData } = req.body;
  if (!initData) {
    return res.status(400).json({ error: 'initData is required' });
  }

  const validated = validateInitData(initData);
  if (!validated) {
    return res.status(401).json({ error: 'Invalid or expired initData' });
  }

  let user;
  try {
    user = JSON.parse(validated.user);
  } catch {
    return res.status(400).json({ error: 'Invalid user data' });
  }

  const { error } = await supabase.from('users').upsert(
    {
      id: String(user.id),
      telegram_id: user.id,
      first_name: user.first_name,
      last_name: user.last_name || null,
      username: user.username || null,
      photo_url: user.photo_url || null,
      language_code: user.language_code || null,
      is_premium: user.is_premium || false,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (error) {
    console.error('Supabase upsert error:', error);
    return res.status(500).json({ error: 'Failed to save user' });
  }

  const token = jwt.sign(
    {
      sub: String(user.id),
      role: 'authenticated',
      user_metadata: {
        telegram_id: user.id,
        first_name: user.first_name,
        username: user.username,
      },
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );

  return res.status(200).json({
    token,
    user: {
      id: String(user.id),
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      photo_url: user.photo_url,
    },
  });
}
