import { useEffect, useState } from 'react';
import { fetchSettings, updateSettings, type UserSettings } from '../lib/settings';

interface SettingsProps {
  token: string;
  userName: string;
  onClose: () => void;
}

export function Settings({ token, userName, onClose }: SettingsProps) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings(token).then((s) => {
      setSettings(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token]);

  const toggle = async (key: keyof Omit<UserSettings, 'user_id'>) => {
    if (!settings) return;
    const newValue = !settings[key];
    setSettings({ ...settings, [key]: newValue });
    await updateSettings(token, { [key]: newValue }).catch(() => {
      setSettings({ ...settings, [key]: !newValue });
    });
  };

  if (loading) {
    return (
      <div className="settings-screen">
        <div className="settings-header">
          <button className="settings-back" onClick={onClose}>←</button>
          <h2>Settings</h2>
        </div>
        <div className="settings-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="settings-screen">
      <div className="settings-header">
        <button className="settings-back" onClick={onClose}>←</button>
        <h2>Settings</h2>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <div className="settings-section-title">Account</div>
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">{userName}</span>
              <span className="settings-row-sub">Edit Profile</span>
            </div>
            <span className="settings-chevron">›</span>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Notifications</div>
          <div className="settings-row" onClick={() => toggle('notify_zone_attacks')}>
            <span className="settings-row-label">Zone Attacks</span>
            <div className={`settings-toggle ${settings?.notify_zone_attacks ? 'on' : ''}`}>
              <div className="settings-toggle-thumb" />
            </div>
          </div>
          <div className="settings-row" onClick={() => toggle('notify_run_reminders')}>
            <span className="settings-row-label">Run Reminders</span>
            <div className={`settings-toggle ${settings?.notify_run_reminders ? 'on' : ''}`}>
              <div className="settings-toggle-thumb" />
            </div>
          </div>
          <div className="settings-row" onClick={() => toggle('notify_leaderboard')}>
            <span className="settings-row-label">Leaderboard Updates</span>
            <div className={`settings-toggle ${settings?.notify_leaderboard ? 'on' : ''}`}>
              <div className="settings-toggle-thumb" />
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">GPS</div>
          <div className="settings-row" onClick={() => toggle('gps_high_accuracy')}>
            <span className="settings-row-label">High Accuracy GPS</span>
            <div className={`settings-toggle ${settings?.gps_high_accuracy ? 'on' : ''}`}>
              <div className="settings-toggle-thumb" />
            </div>
          </div>
          <div className="settings-row" onClick={() => toggle('gps_background_tracking')}>
            <span className="settings-row-label">Background Tracking</span>
            <div className={`settings-toggle ${settings?.gps_background_tracking ? 'on' : ''}`}>
              <div className="settings-toggle-thumb" />
            </div>
          </div>
          <p className="settings-hint">
            Background tracking uses Telegram Live Location for tracking while app is minimized
          </p>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">About</div>
          <div className="settings-row">
            <span className="settings-row-label">Version</span>
            <span className="settings-row-value">1.0.0</span>
          </div>
          <div className="settings-row">
            <span className="settings-row-label">Privacy Policy</span>
            <span className="settings-chevron">›</span>
          </div>
        </div>
      </div>
    </div>
  );
}
