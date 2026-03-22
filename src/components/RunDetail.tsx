import { useEffect, useState } from 'react';
import { fetchRunDetail, type RunDetail as RunDetailType } from '../lib/run-detail';
import { shareRun } from '../lib/share';

interface RunDetailProps {
  token: string;
  runId: string;
  onClose: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
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

export function RunDetail({ token, runId, onClose }: RunDetailProps) {
  const [run, setRun] = useState<RunDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    fetchRunDetail(token, runId).then((data) => {
      setRun(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token, runId]);

  const handleShare = async () => {
    setSharing(true);
    try {
      await shareRun(token, runId);
    } catch { /* ignore */ }
    setSharing(false);
  };

  if (loading || !run) {
    return (
      <div className="detail-screen">
        <div className="detail-header">
          <button className="detail-back" onClick={onClose}>←</button>
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-screen">
      <div className="detail-header">
        <button className="detail-back" onClick={onClose}>←</button>
        <h2>{formatDate(run.started_at)}</h2>
      </div>

      <div className="detail-map-preview" />

      <div className="detail-stats">
        <div className="detail-stat">
          <span className="detail-stat-value">{formatDist(run.distance_m)}</span>
          <span className="detail-stat-label">KM</span>
        </div>
        <div className="detail-stat">
          <span className="detail-stat-value">{formatDuration(run.duration_s)}</span>
          <span className="detail-stat-label">TIME</span>
        </div>
        <div className="detail-stat">
          <span className="detail-stat-value">{formatPace(run.avg_speed_kmh)}</span>
          <span className="detail-stat-label">PACE</span>
        </div>
        <div className="detail-stat">
          <span className="detail-stat-value">{run.zones_captured}</span>
          <span className="detail-stat-label">ZONES</span>
        </div>
      </div>

      {run.zones_captured > 0 && (
        <div className="detail-section">
          <h3 className="detail-section-title">Captured Zones</h3>
          <div className="detail-zones-card">
            <span className="detail-zones-icon">◆</span>
            <div>
              <div className="detail-zones-count">{run.zones_captured} zones captured</div>
              <div className="detail-zones-sub">
                Expanded your territory by {(run.zones_captured * 0.04).toFixed(1)} km²
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="detail-section">
        <h3 className="detail-section-title">Route Summary</h3>
        <div className="detail-route-stats">
          <div className="detail-route-stat">
            <span className="detail-route-value">{formatDist(run.distance_m)} km</span>
            <span className="detail-route-label">Total</span>
          </div>
          <div className="detail-route-stat">
            <span className="detail-route-value">{run.avg_speed_kmh.toFixed(1)} km/h</span>
            <span className="detail-route-label">Avg Speed</span>
          </div>
        </div>
      </div>

      <button className="detail-share-btn" onClick={handleShare} disabled={sharing}>
        {sharing ? 'Sharing...' : '⤴ SHARE RUN'}
      </button>
    </div>
  );
}
