import { useEffect, useState } from 'react';
import { fetchRuns, type SavedRun } from '../lib/runs';

interface RunTabProps {
  token: string;
  onStart: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function formatDist(m: number): string {
  return (m / 1000).toFixed(1);
}

function formatDuration(s: number): string {
  const min = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatPace(kmh: number): string {
  if (kmh <= 0) return '--:--';
  const paceMin = 60 / kmh;
  const mins = Math.floor(paceMin);
  const secs = Math.round((paceMin - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function RunTab({ token, onStart }: RunTabProps) {
  const [lastRun, setLastRun] = useState<SavedRun | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRuns(token).then((runs) => {
      setLastRun(runs.length > 0 ? runs[0] : null);
      setLoading(false);
    });
  }, [token]);

  return (
    <div className="runtab-screen">
      <div className="runtab-content">
        <div className="runtab-hero">
          <span className="runtab-hero-icon">👟</span>
          <div className="runtab-hero-sub">
            <span className="runtab-hero-dot" />
            <span className="runtab-hero-text">Your last route preview</span>
          </div>
        </div>

        {!loading && lastRun && (
          <div className="runtab-last-section">
            <div className="runtab-last-header">
              <span className="runtab-last-title">Last Run</span>
              <span className="runtab-last-date">{formatDate(lastRun.started_at)}</span>
            </div>

            <div className="runtab-last-card">
              <span className="runtab-last-card-icon">👟</span>
              <div className="runtab-last-card-info">
                <div className="runtab-last-card-date">{formatDate(lastRun.started_at)}</div>
                <div className="runtab-last-card-stats">
                  {formatDist(lastRun.distance_m)} km · {formatDuration(lastRun.duration_s)} · {formatPace(lastRun.avg_speed_kmh)}/km
                </div>
              </div>
              {lastRun.territory && <span className="runtab-last-card-badge">◆</span>}
            </div>

            <div className="runtab-stats-row">
              <div className="runtab-stat">
                <span className="runtab-stat-value">{formatDist(lastRun.distance_m)}</span>
                <span className="runtab-stat-label">KM</span>
              </div>
              <div className="runtab-stat">
                <span className="runtab-stat-value">{formatDuration(lastRun.duration_s)}</span>
                <span className="runtab-stat-label">TIME</span>
              </div>
              <div className="runtab-stat">
                <span className="runtab-stat-value">{formatPace(lastRun.avg_speed_kmh)}</span>
                <span className="runtab-stat-label">PACE</span>
              </div>
            </div>
          </div>
        )}

        <div className="runtab-motivation">
          <h2 className="runtab-motivation-title">Ready to run?</h2>
          <p className="runtab-motivation-sub">Capture more territory and climb the ranks</p>
        </div>

        <button className="runtab-start-btn" onClick={onStart}>
          ▶ START RUN
        </button>
      </div>
    </div>
  );
}
