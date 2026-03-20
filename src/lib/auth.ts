import type { AuthResponse } from '../types/auth';

export async function authenticate(initDataRaw: string): Promise<AuthResponse> {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: initDataRaw }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Authentication failed');
  }

  return res.json();
}
