import { useEffect } from 'react';
import { GameMap } from './components/Map';
import { RunPanel } from './components/RunPanel';
import { useLocation } from './hooks/useLocation';
import { useTelegram } from './hooks/useTelegram';
import { useAuth } from './contexts/AuthContext';
import { useRun } from './hooks/useRun';

function App() {
  const { isReady } = useTelegram();
  const { isLoading: authLoading, error: authError } = useAuth();
  const location = useLocation();
  const run = useRun();

  // Feed GPS points to the run tracker
  useEffect(() => {
    if (location.coordinates && run.isRunning) {
      run.addPoint(location.coordinates);
    }
  }, [location.coordinates]);

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

  const trackCoords = run.points.map((p) => p.coordinates);

  return (
    <>
      <GameMap
        coordinates={location.coordinates}
        trackPoints={trackCoords}
        territory={run.territory}
      />
      <RunPanel
        isRunning={run.isRunning}
        distance={run.distance}
        duration={run.duration}
        speed={run.speed}
        hasTerritory={!!run.territory}
        onStart={run.start}
        onStop={run.stop}
      />
    </>
  );
}

export default App;
