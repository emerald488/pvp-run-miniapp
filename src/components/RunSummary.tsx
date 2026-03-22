import { useState } from 'react';
import { shareRun } from '../lib/share';

interface RunSummaryProps {
  token: string;
  runId: string | null;
  distanceM: number;
  durationS: number;
  avgSpeedKmh: number;
  zonesCaptured: number;
  onBackToMap: () => void;
}

function formatDist(m: number): string {
  return (m / 1000).toFixed(2);
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

export function RunSummary({
  token, runId, distanceM, durationS, avgSpeedKmh, zonesCaptured, onBackToMap,
}: RunSummaryProps) {
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (!runId) return;
    setSharing(true);
    try {
      await shareRun(token, runId);
    } catch { /* ignore */ }
    setSharing(false);
  };

  return (
    <div className="summary-screen">
      <div className="summary-header">
        <span className="summary-check">✓</span>
        <h1 className="summary-title">Run Complete!</h1>
      </div>

      <div className="summary-map-preview" />

      <div className="summary-stats-grid">
        <div className="summary-stat">
          <span className="summary-stat-value">{formatDist(distanceM)}</span>
          <span className="summary-stat-label">Distance km</span>
        </div>
        <div className="summary-stat">
          <span className="summary-stat-value">{formatDuration(durationS)}</span>
          <span className="summary-stat-label">Duration</span>
        </div>
        <div className="summary-stat">
          <span className="summary-stat-value">{formatPace(avgSpeedKmh)}</span>
          <span className="summary-stat-label">Avg Pace</span>
        </div>
        <div className="summary-stat">
          <span className="summary-stat-value">{zonesCaptured}</span>
          <span className="summary-stat-label">Zones</span>
        </div>
      </div>

      {zonesCaptured > 0 && (
        <div className="summary-zones-badge">
          ◆ +{zonesCaptured} zones captured!
        </div>
      )}

      <div className="summary-actions">
        <button className="summary-btn-primary" onClick={handleShare} disabled={sharing || !runId}>
          {sharing ? 'Sharing...' : '⤴ SHARE RESULTS'}
        </button>
        <button className="summary-btn-secondary" onClick={onBackToMap}>
          ⌂ BACK TO MAP
        </button>
      </div>
    </div>
  );
}
