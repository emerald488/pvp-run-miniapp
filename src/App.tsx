import { Map } from './components/Map';
import { useLocation } from './hooks/useLocation';
import { useTelegram } from './hooks/useTelegram';
import { useAuth } from './contexts/AuthContext';

function App() {
  const { isReady } = useTelegram();
  const { isLoading: authLoading, error: authError } = useAuth();
  const location = useLocation();

  if (authError) {
    return (
      <div className="error-screen">
        <p>{authError}</p>
        <p style={{ color: '#888', fontSize: 14 }}>
          Authentication failed
        </p>
      </div>
    );
  }

  if (location.error) {
    return (
      <div className="error-screen">
        <p>{location.error}</p>
        <p style={{ color: '#888', fontSize: 14 }}>
          Please enable location access to use PVP Run
        </p>
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

  return <Map coordinates={location.coordinates} />;
}

export default App;
