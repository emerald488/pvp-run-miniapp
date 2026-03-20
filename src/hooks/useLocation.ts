import { useEffect, useState } from 'react';
import type { LocationState } from '../types/location';

const initialState: LocationState = {
  coordinates: null,
  heading: null,
  speed: null,
  accuracy: null,
  error: null,
  isTracking: false,
};

export function useLocation(): LocationState {
  const [state, setState] = useState<LocationState>(initialState);

  useEffect(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: 'Geolocation is not supported by your browser',
      }));
      return;
    }

    setState((prev) => ({ ...prev, isTracking: true }));

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setState({
          coordinates: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          heading: position.coords.heading,
          speed: position.coords.speed,
          accuracy: position.coords.accuracy,
          error: null,
          isTracking: true,
        });
      },
      (err) => {
        let message: string;
        switch (err.code) {
          case err.PERMISSION_DENIED:
            message = 'Location permission denied';
            break;
          case err.POSITION_UNAVAILABLE:
            message = 'Location information unavailable';
            break;
          case err.TIMEOUT:
            message = 'Location request timed out';
            break;
          default:
            message = 'An unknown error occurred';
        }
        setState((prev) => ({ ...prev, error: message, isTracking: false }));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return state;
}
