import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameMap } from './components/Map';
import { RunPanel } from './components/RunPanel';
import { Profile } from './components/Profile';
import { Leaderboard } from './components/Leaderboard';
import { Settings } from './components/Settings';
import { RunSummary } from './components/RunSummary';
import { RunDetail } from './components/RunDetail';
import { RunTab } from './components/RunTab';
import { Onboarding } from './components/Onboarding';
import { TabBar } from './components/TabBar';
import { TerritoryAlert } from './components/TerritoryAlert';
import { ToastContainer, showToast } from './components/Toast';
import { useLocation } from './hooks/useLocation';
import { useTelegram } from './hooks/useTelegram';
import { useAuth } from './contexts/AuthContext';
import { useRun } from './hooks/useRun';
import { trackToHexes, polygonToHexes, type ZoneOwner } from './lib/hexGrid';
import { supabase } from './lib/supabase';
import { fetchSettings, completeOnboarding } from './lib/settings';
import type { OtherPlayer } from './components/Map';

type MainTab = 'map' | 'run' | 'leaderboard' | 'profile';
type SubScreen = null | 'settings' | 'run-summary' | 'run-detail' | 'onboarding';

interface RunSummaryData {
  runId: string | null;
  distanceM: number;
  durationS: number;
  avgSpeedKmh: number;
  zonesCaptured: number;
}

interface AttackAlert {
  attackerName: string;
  zonesLost: number;
}

function App() {
  const { isReady } = useTelegram();
  const { isLoading: authLoading, error: authError, token, user } = useAuth();
  const location = useLocation();
  const run = useRun(token);
  const [activeTab, setActiveTab] = useState<MainTab>('map');
  const [subScreen, setSubScreen] = useState<SubScreen>(null);
  const [serverZones, setServerZones] = useState(new globalThis.Map<string, ZoneOwner>());
  const [otherPlayers, setOtherPlayers] = useState<OtherPlayer[]>([]);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [runSummaryData, setRunSummaryData] = useState<RunSummaryData | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [attackAlert, setAttackAlert] = useState<AttackAlert | null>(null);
  const prevRunning = useRef(false);
  const myZoneCount = useRef(0);

  // Count user's zones
  useEffect(() => {
    if (!user) return;
    let count = 0;
    for (const [, zone] of serverZones) {
      if (zone.ownerId === user.id) count++;
    }
    myZoneCount.current = count;
  }, [serverZones, user]);

  // Check onboarding status
  useEffect(() => {
    if (!token) return;
    fetchSettings(token).then((s) => {
      if (!s.onboarding_completed) {
        setSubScreen('onboarding');
      }
      setOnboardingChecked(true);
    }).catch(() => setOnboardingChecked(true));
  }, [token]);

  const handleOnboardingComplete = async () => {
    if (token) {
      await completeOnboarding(token).catch(() => {});
    }
    setSubScreen(null);
  };

  // Initial load of zones via API
  const loadZones = useCallback(async () => {
    try {
      const res = await fetch('/api/zones');
      const data = await res.json();
      const map = new globalThis.Map<string, ZoneOwner>();
      for (const z of data.zones || []) {
        map.set(z.h3_index, { ownerId: z.owner_id, ownerColor: z.owner_color });
      }
      setServerZones(map);
    } catch { /* ignore */ }
  }, []);

  // Fetch active players
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

    const channel = supabase
      .channel('zones-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'zones' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const z = payload.new as { h3_index: string; owner_id: string; owner_color: string };

            // Detect if our zone was stolen
            setServerZones((prev) => {
              const prevZone = prev.get(z.h3_index);
              if (prevZone && prevZone.ownerId === user?.id && z.owner_id !== user?.id) {
                // Our zone was captured by someone else
                setAttackAlert({ attackerName: `Player`, zonesLost: 1 });
                showToast('error', 'Your territory is under attack!');
              }

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

    const playersInterval = setInterval(loadPlayers, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(playersInterval);
    };
  }, [loadZones, loadPlayers, user?.id]);

  // Detect run stop → show summary
  useEffect(() => {
    if (prevRunning.current && !run.isRunning) {
      const zoneCount = localHexes.size;
      if (run.distance > 0) {
        setRunSummaryData({
          runId: null,
          distanceM: run.distance,
          durationS: run.duration,
          avgSpeedKmh: run.speed,
          zonesCaptured: zoneCount,
        });
        setSubScreen('run-summary');
        if (zoneCount > 0) {
          showToast('success', `${zoneCount} zones captured!`);
        }
      }
      loadZones();
    }
    prevRunning.current = run.isRunning;
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

  // Navigation helpers
  const openRunDetail = (runId: string) => {
    setSelectedRunId(runId);
    setSubScreen('run-detail');
  };

  const handleStartFromTab = () => {
    run.start();
    setActiveTab('map');
  };

  const hasRuns = myZoneCount.current > 0 || serverZones.size > 0;

  if (authError) {
    return (
      <div className="error-screen">
        <p>{authError}</p>
        <p style={{ color: '#8A8A8A', fontSize: 14 }}>Authentication failed</p>
      </div>
    );
  }

  if (location.error) {
    return (
      <div className="error-screen">
        <p>{location.error}</p>
        <p style={{ color: '#8A8A8A', fontSize: 14 }}>Please enable location access</p>
      </div>
    );
  }

  if (!isReady || authLoading || !location.coordinates || !onboardingChecked) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p style={{ color: '#8A8A8A', fontSize: 14 }}>
          {authLoading ? 'Authenticating...' : 'Getting your location...'}
        </p>
      </div>
    );
  }

  // Sub-screens (overlay everything)
  if (subScreen === 'onboarding') {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  if (subScreen === 'run-summary' && token && runSummaryData) {
    return (
      <RunSummary
        token={token}
        runId={runSummaryData.runId}
        distanceM={runSummaryData.distanceM}
        durationS={runSummaryData.durationS}
        avgSpeedKmh={runSummaryData.avgSpeedKmh}
        zonesCaptured={runSummaryData.zonesCaptured}
        onBackToMap={() => { setRunSummaryData(null); setSubScreen(null); setActiveTab('map'); }}
      />
    );
  }

  if (subScreen === 'settings' && token && user) {
    return (
      <Settings
        token={token}
        userName={user.first_name}
        onClose={() => setSubScreen(null)}
      />
    );
  }

  if (subScreen === 'run-detail' && token && selectedRunId) {
    return (
      <RunDetail
        token={token}
        runId={selectedRunId}
        onClose={() => { setSelectedRunId(null); setSubScreen(null); }}
      />
    );
  }

  const trackCoords = run.points.map((p) => p.coordinates);
  const showMap = activeTab === 'map';

  return (
    <>
      <ToastContainer />

      {/* Map — always mounted, hidden when other tabs active */}
      <div style={{ display: showMap ? 'block' : 'none', width: '100%', height: '100%' }}>
        <GameMap
          coordinates={location.coordinates}
          trackPoints={trackCoords}
          ownedHexes={localHexes}
          serverZones={serverZones}
          otherPlayers={otherPlayers}
        />

        {/* Zone counter */}
        <div className="map-zone-counter">
          <span className="map-zone-dot" />
          My Zones: {myZoneCount.current}
        </div>

        {/* Empty state overlay for new users */}
        {!run.isRunning && myZoneCount.current === 0 && !hasRuns && (
          <div className="map-empty-card">
            <span className="map-empty-icon">📍</span>
            <h3 className="map-empty-title">Start Your First Run!</h3>
            <p className="map-empty-sub">Run around your city to capture territory zones</p>
          </div>
        )}

        {/* Territory attack alert */}
        {attackAlert && (
          <TerritoryAlert
            attackerName={attackAlert.attackerName}
            zonesLost={attackAlert.zonesLost}
            onDefend={() => { setAttackAlert(null); }}
            onDismiss={() => setAttackAlert(null)}
          />
        )}

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
      </div>

      {/* Run Tab */}
      {activeTab === 'run' && !run.isRunning && token && (
        <RunTab token={token} onStart={handleStartFromTab} />
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && user && token && (
        <Profile
          user={user}
          token={token}
          onClose={() => setActiveTab('map')}
          onOpenSettings={() => setSubScreen('settings')}
          onOpenRunDetail={openRunDetail}
        />
      )}

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <Leaderboard onClose={() => setActiveTab('map')} />
      )}

      {/* TabBar — always visible on main tabs, hidden during run */}
      {!run.isRunning && !subScreen && (
        <TabBar active={activeTab} onTabChange={setActiveTab} />
      )}
    </>
  );
}

export default App;
