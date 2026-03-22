import { useEffect, useState } from 'react';
import { fetchRuns, type SavedRun } from '../lib/runs';
import type { TelegramUser } from '../types/auth';

interface ProfileProps {
  user: TelegramUser;
  token: string;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenRunDetail: (runId: string) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatDist(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
}

function formatTime(s: number): string {
  const min = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function Profile({ user, token, onClose, onOpenSettings, onOpenRunDetail }: ProfileProps) {
  const [runs, setRuns] = useState<SavedRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRuns(token).then((data) => {
      setRuns(data);
      setLoading(false);
    });
  }, [token]);

  const totalDistance = runs.reduce((sum, r) => sum + r.distance_m, 0);
  const totalTerritories = runs.filter((r) => r.territory).length;

  return (
    <div className="profile-screen">
      <div className="profile-header">
        <button className="profile-close" onClick={onClose}>←</button>
        <h2>{user.first_name}</h2>
        {user.username && <p className="profile-username">@{user.username}</p>}
        <button className="profile-settings-btn" onClick={onOpenSettings}>⚙</button>
      </div>

      <div className="profile-stats">
        <div className="stat">
          <span className="stat-value">{totalTerritories}</span>
          <span className="stat-label">Zones</span>
        </div>
        <div className="stat">
          <span className="stat-value">{runs.length}</span>
          <span className="stat-label">Runs</span>
        </div>
        <div className="stat">
          <span className="stat-value">{formatDist(totalDistance)}</span>
          <span className="stat-label">KM</span>
        </div>
      </div>

      <div className="runs-list">
        <h3>Recent Runs</h3>
        {loading && <p className="runs-empty">Loading...</p>}
        {!loading && runs.length === 0 && (
          <div className="runs-empty-card">
            <div className="runs-empty-icon">👟</div>
            <div className="runs-empty-title">No runs yet</div>
            <div className="runs-empty-desc">Complete your first run to see it here</div>
          </div>
        )}
        {runs.map((run) => (
          <div key={run.id} className="run-card" onClick={() => onOpenRunDetail(run.id)}>
            <div className="run-card-top">
              <span className="run-date">{formatDate(run.started_at)}</span>
              {run.territory && <span className="run-territory-badge">◆</span>}
            </div>
            <div className="run-card-stats">
              <span>{formatDist(run.distance_m)}</span>
              <span>{formatTime(run.duration_s)}</span>
              <span>{run.avg_speed_kmh.toFixed(1)} km/h</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
