export interface ShareResult {
  success: boolean;
  shareText: string;
  stats: {
    distanceKm: number;
    duration: string;
    pace: string;
    zones: number;
  };
}

export async function shareRun(token: string, runId: string): Promise<ShareResult> {
  const res = await fetch('/api/share', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ runId }),
  });

  if (!res.ok) {
    throw new Error('Failed to share run');
  }

  return res.json();
}
