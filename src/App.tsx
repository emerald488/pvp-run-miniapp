import { Map } from './components/Map';
import { useLocation } from './hooks/useLocation';
import { useTelegram } from './hooks/useTelegram';

function App() {
  const { isReady } = useTelegram();
  const location = useLocation();

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

  if (!isReady || !location.coordinates) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p style={{ color: '#888', fontSize: 14 }}>Getting your location...</p>
      </div>
    );
  }

  return <Map coordinates={location.coordinates} />;
}

export default App;
