import { useCallback, useEffect, useMemo, useState } from 'react';
import { GameMap } from './components/Map';
import { RunPanel } from './components/RunPanel';
import { Profile } from './components/Profile';
import { Leaderboard } from './components/Leaderboard';
import { useLocation } from './hooks/useLocation';
import { useTelegram } from './hooks/useTelegram';
import { useAuth } from './contexts/AuthContext';
import { useRun } from './hooks/useRun';
import { trackToHexes, polygonToHexes, type ZoneOwner } from './lib/hexGrid';
import { supabase } from './lib/supabase';
import type { OtherPlayer } from './components/Map';

function App() {
  const { isReady } = useTelegram();
  const { isLoading: authLoading, error: authError, token, user } = useAuth();
  const location = useLocation();
  const run = useRun(token);
  const [screen, setScreen] = useState<'map' | 'profile' | 'leaderboard'>('map');
  const [serverZones, setServerZones] = useState(new globalThis.Map<string, ZoneOwner>());
  const [otherPlayers, setOtherPlayers] = useState<OtherPlayer[]>([]);

  // Initial load of zones
  const loadZones = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('zones')
        .select('h3_index, owner_id, owner_color')
        .not('owner_id', 'is', null);

      const map = new globalThis.Map<string, ZoneOwner>();
      for (const z of data || []) {
        map.set(z.h3_index, { ownerId: z.owner_id, ownerColor: z.owner_color });
      }
      setServerZones(map);
    } catch { /* ignore */ }
  }, []);

  // Fetch active players (still polling — small load)
  const loadPlayers = useCallback(async () => {
    try {
      const res = await fetch('/api/players');
      const data = await res.json();
      setOtherPlayers(data.players || []);
    } catch { /* ignore */ }
  }, []);

  // Load zones on mount + subscribe to realtime changes
  useEffect(() => {
    loadZones();
    loadPlayers();

    // Supabase Realtime subscription for zones
    const channel = supabase
      .channel('zones-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'zones' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const z = payload.new as { h3_index: string; owner_id: string; owner_color: string };
            setServerZones((prev) => {
              const next = new globalThis.Map(prev);
              next.set(z.h3_index, { ownerId: z.owner_id, ownerColor: z.owner_color });
              return next;
            });
          } else if (payload.eventType === 'DELETE') {
            const z = payload.old as { h3_index: string };
            setServerZones((prev) => {
              const next = new globalThis.Map(prev);
              next.delete(z.h3_index);
              return next;
            });
          }
        },
      )
      .subscribe();

    // Players polling at 30s (lightweight)
    const playersInterval = setInterval(loadPlayers, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(playersInterval);
    };
  }, [loadZones, loadPlayers]);

  // Reload zones when run stops
  useEffect(() => {
    if (!run.isRunning) loadZones();
  }, [run.isRunning]);

  // Feed GPS points to the run tracker
  useEffect(() => {
    if (location.coordinates && run.isRunning) {
      run.addPoint(location.coordinates);
    }
  }, [location.coordinates]);

  // Local hexes from current run
  const localHexes = useMemo(() => {
    const hexSet = new Set<string>();
    if (run.points.length > 0) {
      for (const hex of trackToHexes(run.points.map((p) => p.coordinates))) {
        hexSet.add(hex);
      }
    }
    if (run.territory) {
      for (const hex of polygonToHexes(run.territory)) {
        hexSet.add(hex);
      }
    }
    return hexSet;
  }, [run.points, run.territory]);

  if (authError) {
    return (
      <div className="error-screen">
        <p>{authError}</p>
        <p style={{ color: '#888', fontSize: 14 }}>Authentication failed</p>
      </div>
    );
  }

  if (location.error) {
    return (
      <div className="error-screen">
        <p>{location.error}</p>
        <p style={{ color: '#888', fontSize: 14 }}>Please enable location access</p>
      </div>
    );
  }

  if (!isReady || authLoading || !location.coordinates) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p style={{ color: '#888', fontSize: 14 }}>
          {authLoading ? 'Authenticating...' : 'Getting your location...'}
        </p>
      </div>
    );
  }

  if (screen === 'profile' && user && token) {
    return <Profile user={user} token={token} onClose={() => setScreen('map')} />;
  }

  if (screen === 'leaderboard') {
    return <Leaderboard onClose={() => setScreen('map')} />;
  }

  const trackCoords = run.points.map((p) => p.coordinates);

  return (
    <>
      <GameMap
        coordinates={location.coordinates}
        trackPoints={trackCoords}
        ownedHexes={localHexes}
        serverZones={serverZones}
        otherPlayers={otherPlayers}
      />
      <div className="top-buttons">
        <button className="top-btn" onClick={() => setScreen('leaderboard')}>🏆</button>
        <button className="top-btn" onClick={() => setScreen('profile')}>
          {user?.first_name?.[0] || '?'}
        </button>
      </div>
      <RunPanel
        isRunning={run.isRunning}
        distance={run.distance}
        duration={run.duration}
        speed={run.speed}
        hasTerritory={!!run.territory}
        liveTracking={run.liveTracking}
        onStart={run.start}
        onStop={run.stop}
      />
    </>
  );
}

export default App;
