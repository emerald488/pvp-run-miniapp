import { useEffect, useMemo, useState } from 'react';
import { GameMap } from './components/Map';
import { RunPanel } from './components/RunPanel';
import { Profile } from './components/Profile';
import { useLocation } from './hooks/useLocation';
import { useTelegram } from './hooks/useTelegram';
import { useAuth } from './contexts/AuthContext';
import { useRun } from './hooks/useRun';
import { trackToHexes, polygonToHexes } from './lib/hexGrid';

function App() {
  const { isReady } = useTelegram();
  const { isLoading: authLoading, error: authError, token, user } = useAuth();
  const location = useLocation();
  const run = useRun(token);
  const [showProfile, setShowProfile] = useState(false);

  // Feed GPS points to the run tracker
  useEffect(() => {
    if (location.coordinates && run.isRunning) {
      run.addPoint(location.coordinates);
    }
  }, [location.coordinates]);

  // Calculate owned hexes from track + territory
  const ownedHexes = useMemo(() => {
    const hexSet = new Set<string>();

    // Hexes along the track
    if (run.points.length > 0) {
      const trackCoords = run.points.map((p) => p.coordinates);
      for (const hex of trackToHexes(trackCoords)) {
        hexSet.add(hex);
      }
    }

    // Hexes inside closed territory
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

  if (showProfile && user && token) {
    return <Profile user={user} token={token} onClose={() => setShowProfile(false)} />;
  }

  const trackCoords = run.points.map((p) => p.coordinates);

  return (
    <>
      <GameMap
        coordinates={location.coordinates}
        trackPoints={trackCoords}
        ownedHexes={ownedHexes}
      />
      <button className="profile-btn" onClick={() => setShowProfile(true)}>
        {user?.first_name?.[0] || '?'}
      </button>
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
