interface RunPanelProps {
  isRunning: boolean;
  distance: number;
  duration: number;
  speed: number;
  hasTerritory: boolean;
  trackPointCount: number;
  onStart: () => void;
  onStop: () => void;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatSpeed(kmh: number): string {
  return `${kmh.toFixed(1)} km/h`;
}

export function RunPanel({
  isRunning, distance, duration, speed, hasTerritory, trackPointCount, onStart, onStop,
}: RunPanelProps) {
  return (
    <div className="run-panel">
      {isRunning && trackPointCount > 0 && (
        <div className="live-indicator">
          <span className="live-dot" />
          Live tracking
        </div>
      )}

      {isRunning && (
        <div className="run-stats">
          <div className="stat">
            <span className="stat-value">{formatDistance(distance)}</span>
            <span className="stat-label">Distance</span>
          </div>
          <div className="stat">
            <span className="stat-value">{formatDuration(duration)}</span>
            <span className="stat-label">Time</span>
          </div>
          <div className="stat">
            <span className="stat-value">{formatSpeed(speed)}</span>
            <span className="stat-label">Speed</span>
          </div>
        </div>
      )}

      {hasTerritory && !isRunning && (
        <div className="territory-badge">Territory captured!</div>
      )}

      <button
        className={`run-button ${isRunning ? 'running' : ''}`}
        onClick={isRunning ? onStop : onStart}
      >
        {isRunning ? 'STOP' : 'START'}
      </button>
    </div>
  );
}
