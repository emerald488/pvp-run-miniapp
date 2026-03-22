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

type SortBy = 'zones' | 'distance' | 'runs';

interface LeaderboardProps {
  onClose: () => void;
}

function getSortValue(p: Player, sort: SortBy): number {
  if (sort === 'zones') return p.total_territories;
  if (sort === 'distance') return p.total_distance_m;
  return p.total_runs;
}

function formatValue(p: Player, sort: SortBy): string {
  if (sort === 'zones') return p.total_territories.toLocaleString();
  if (sort === 'distance') return `${(p.total_distance_m / 1000).toFixed(1)} km`;
  return String(p.total_runs);
}

function formatSub(p: Player, sort: SortBy): string {
  if (sort === 'zones') return `${p.total_territories} zones captured`;
  if (sort === 'distance') return `${(p.total_distance_m / 1000).toFixed(1)} km total`;
  return `${p.total_runs} runs completed`;
}

export function Leaderboard({ onClose: _onClose }: LeaderboardProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>('zones');

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((d) => { setPlayers(d.players || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const sorted = [...players].sort((a, b) => getSortValue(b, sortBy) - getSortValue(a, sortBy));
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  // Reorder for podium display: 2nd, 1st, 3rd
  const podiumOrder = top3.length >= 3
    ? [top3[1], top3[0], top3[2]]
    : top3;

  return (
    <div className="lb-screen">
      <div className="lb-header">
        <h1 className="lb-title">Leaderboard</h1>
        <p className="lb-subtitle">Top runners this week</p>
      </div>

      <div className="lb-segment">
        {(['zones', 'distance', 'runs'] as SortBy[]).map((s) => (
          <button
            key={s}
            className={`lb-seg-btn ${sortBy === s ? 'active' : ''}`}
            onClick={() => setSortBy(s)}
          >
            {s === 'zones' ? 'Zones' : s === 'distance' ? 'Distance' : 'Runs'}
          </button>
        ))}
      </div>

      {loading && <p className="lb-loading">Loading...</p>}

      {!loading && top3.length > 0 && (
        <div className="lb-podium">
          {podiumOrder.map((p, i) => {
            const rank = i === 1 ? 1 : i === 0 ? 2 : 3;
            const isFirst = rank === 1;
            return (
              <div key={p.id} className={`lb-podium-item ${isFirst ? 'first' : ''}`}>
                {isFirst && <span className="lb-crown">👑</span>}
                <div
                  className="lb-avatar"
                  style={{
                    background: p.color,
                    width: isFirst ? 56 : 44,
                    height: isFirst ? 56 : 44,
                    border: isFirst ? '3px solid #FFD600' : '2px solid #3a3a3a',
                  }}
                >
                  {p.first_name[0]}
                </div>
                <span className="lb-podium-name">{p.first_name.split(' ')[0]}</span>
                <span className={`lb-podium-score ${isFirst ? 'accent' : ''}`}>
                  {formatValue(p, sortBy)}
                </span>
                <span className="lb-podium-rank">{rank === 1 ? '1ST' : rank === 2 ? '2ND' : '3RD'}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="lb-list">
        {rest.map((p, i) => (
          <div key={p.id} className="lb-row">
            <div className="lb-row-rank">
              <span>{i + 4}</span>
            </div>
            <div className="lb-row-info">
              <span className="lb-row-name">{p.first_name}</span>
              <span className="lb-row-sub">{formatSub(p, sortBy)}</span>
            </div>
            <span className="lb-row-score">{formatValue(p, sortBy)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
