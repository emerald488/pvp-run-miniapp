interface RunPanelProps {
  isRunning: boolean;
  distance: number;
  duration: number;
  speed: number;
  hasTerritory: boolean;
  liveTracking: boolean;
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
  isRunning, distance, duration, speed, hasTerritory, liveTracking, onStart, onStop,
}: RunPanelProps) {
  return (
    <div className="run-panel">
      {isRunning && (
        <div className={`live-indicator ${liveTracking ? '' : 'inactive'}`}>
          <span className="live-dot" />
          {liveTracking ? 'Live tracking' : 'Waiting for location...'}
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
