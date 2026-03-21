import { useEffect, useState } from 'react';

interface Player {
  id: string;
  first_name: string;
  username: string | null;
  color: string;
  total_distance_m: number;
  total_runs: number;
  total_territories: number;
}

interface LeaderboardProps {
  onClose: () => void;
}

function formatDist(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export function Leaderboard({ onClose }: LeaderboardProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((d) => { setPlayers(d.players || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="profile-screen">
      <div className="profile-header">
        <button className="profile-close" onClick={onClose}>←</button>
        <h2>Leaderboard</h2>
      </div>

      {loading && <p className="runs-empty">Loading...</p>}
      {!loading && players.length === 0 && <p className="runs-empty">No players yet</p>}

      <div className="runs-list">
        {players.map((p, i) => (
          <div key={p.id} className="run-card">
            <div className="run-card-top">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: p.color || '#4285f4',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                }}>
                  {i + 1}
                </span>
                <span style={{ fontWeight: 600 }}>{p.first_name}</span>
                {p.username && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>@{p.username}</span>}
              </span>
            </div>
            <div className="run-card-stats" style={{ marginTop: 6 }}>
              <span>🔷 {p.total_territories} zones</span>
              <span>🏃 {p.total_runs} runs</span>
              <span>📏 {formatDist(p.total_distance_m || 0)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
