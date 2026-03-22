export interface UserSettings {
  user_id: string;
  notify_zone_attacks: boolean;
  notify_run_reminders: boolean;
  notify_leaderboard: boolean;
  gps_high_accuracy: boolean;
  gps_background_tracking: boolean;
  onboarding_completed: boolean;
}

export async function fetchSettings(token: string): Promise<UserSettings> {
  const res = await fetch('/api/settings', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch settings');
  }
  const { settings } = await res.json();
  return settings;
}

export async function updateSettings(
  token: string,
  updates: Partial<Omit<UserSettings, 'user_id'>>,
): Promise<UserSettings> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    throw new Error('Failed to update settings');
  }
  const { settings } = await res.json();
  return settings;
}

export async function completeOnboarding(token: string): Promise<void> {
  await updateSettings(token, { onboarding_completed: true });
}
