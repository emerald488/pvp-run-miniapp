import { useEffect, useState } from 'react';

interface PlayerInfo {
  first_name: string;
  username: string | null;
  color: string;
  total_distance_m: number;
  total_runs: number;
  total_territories: number;
}

interface PlayerPopupProps {
  playerId: string;
  onClose: () => void;
}

function formatDist(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export function PlayerPopup({ playerId, onClose }: PlayerPopupProps) {
  const [player, setPlayer] = useState<PlayerInfo | null>(null);

  useEffect(() => {
    fetch(`/api/player-info?id=${playerId}`)
      .then((r) => r.json())
      .then(setPlayer)
      .catch(() => {});
  }, [playerId]);

  if (!player) return null;

  return (
    <div className="player-popup-overlay" onClick={onClose}>
      <div className="player-popup" onClick={(e) => e.stopPropagation()}>
        <div className="popup-header">
          <div className="popup-avatar" style={{ background: player.color }}>
            {player.first_name[0]}
          </div>
          <div>
            <div className="popup-name">{player.first_name}</div>
            {player.username && <div className="popup-username">@{player.username}</div>}
          </div>
        </div>
        <div className="popup-stats">
          <div className="popup-stat">
            <span className="popup-stat-value">{player.total_territories}</span>
            <span className="popup-stat-label">Зоны</span>
          </div>
          <div className="popup-stat">
            <span className="popup-stat-value">{player.total_runs}</span>
            <span className="popup-stat-label">Забеги</span>
          </div>
          <div className="popup-stat">
            <span className="popup-stat-value">{formatDist(player.total_distance_m || 0)}</span>
            <span className="popup-stat-label">Расстояние</span>
          </div>
        </div>
      </div>
    </div>
  );
}
