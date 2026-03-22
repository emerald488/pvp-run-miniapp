-- User settings table for notification preferences, GPS config, onboarding state
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notify_zone_attacks BOOLEAN NOT NULL DEFAULT true,
  notify_run_reminders BOOLEAN NOT NULL DEFAULT true,
  notify_leaderboard BOOLEAN NOT NULL DEFAULT false,
  gps_high_accuracy BOOLEAN NOT NULL DEFAULT true,
  gps_background_tracking BOOLEAN NOT NULL DEFAULT false,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Users can read their own settings
CREATE POLICY "Users can read own settings"
  ON user_settings FOR SELECT
  USING (auth.uid()::text = user_id);

-- Users can update their own settings
CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid()::text = user_id);

-- Users can insert their own settings
CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Service role bypass (for API server)
CREATE POLICY "Service role full access"
  ON user_settings FOR ALL
  USING (current_setting('role') = 'service_role');
