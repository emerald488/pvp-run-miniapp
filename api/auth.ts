import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const SUPABASE_URL = process.env.RunPVP_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.RunPVP_SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = process.env.RunPVP_SUPABASE_JWT_SECRET!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function parseInitData(initData: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const pair of initData.split('&')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    map.set(decodeURIComponent(pair.slice(0, idx)), decodeURIComponent(pair.slice(idx + 1)));
  }
  return map;
}

function validateInitData(initData: string): boolean {
  const fields = parseInitData(initData);
  const hash = fields.get('hash');
  if (!hash) return false;

  const checkPairs: string[] = [];
  for (const [key, value] of fields) {
    if (key === 'hash') continue;
    checkPairs.push(`${key}=${value}`);
  }
  checkPairs.sort();

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const computed = crypto.createHmac('sha256', secretKey).update(checkPairs.join('\n')).digest('hex');

  if (computed !== hash) return false;

  const authDate = parseInt(fields.get('auth_date') || '0', 10);
  const now = Math.floor(Date.now() / 1000);
  return now - authDate <= 86400;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { initData } = req.body;
  if (!initData || !BOT_TOKEN) {
    return res.status(400).json({ error: 'Missing data' });
  }

  if (!validateInitData(initData)) {
    return res.status(401).json({ error: 'Invalid or expired initData' });
  }

  const fields = parseInitData(initData);
  let user;
  try {
    user = JSON.parse(fields.get('user') || '{}');
  } catch {
    return res.status(400).json({ error: 'Invalid user data' });
  }

  // Generate a unique contrasting color using golden angle on HSL
  function generateColor(id: number): string {
    const goldenAngle = 137.508;
    const hue = (id * goldenAngle) % 360;
    const saturation = 70 + (id % 3) * 10; // 70-90%
    const lightness = 50 + (id % 2) * 10;  // 50-60%
    // Convert HSL to hex
    const h = hue / 360;
    const s = saturation / 100;
    const l = lightness / 100;
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
    const g = Math.round(hue2rgb(p, q, h) * 255);
    const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  // Check if user already exists (don't overwrite color)
  const { data: existingUser } = await supabase
    .from('users')
    .select('color')
    .eq('id', String(user.id))
    .single();

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
      color: existingUser?.color || generateColor(user.id),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (error) {
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
