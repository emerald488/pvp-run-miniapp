import { useCallback, useRef, useState } from 'react';
import type { UserCoordinates } from '../types/location';
import type { RunState, RunPoint } from '../types/run';

const CLOSE_DISTANCE_M = 30; // distance to start point to close the loop
const MIN_POINTS_FOR_CLOSE = 20; // minimum points before allowing closure

function haversine(a: UserCoordinates, b: UserCoordinates): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function useRun() {
  const [state, setState] = useState<RunState>({
    isRunning: false,
    points: [],
    distance: 0,
    duration: 0,
    speed: 0,
    territory: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const startTimeRef = useRef(0);

  const start = useCallback(() => {
    startTimeRef.current = Date.now();
    setState({
      isRunning: true,
      points: [],
      distance: 0,
      duration: 0,
      speed: 0,
      territory: null,
    });

    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setState((prev) => ({ ...prev, duration: elapsed }));
    }, 1000);
  }, []);

  const stop = useCallback(() => {
    clearInterval(intervalRef.current);
    setState((prev) => ({ ...prev, isRunning: false }));
  }, []);

  const addPoint = useCallback((coords: UserCoordinates) => {
    setState((prev) => {
      if (!prev.isRunning) return prev;

      const point: RunPoint = { coordinates: coords, timestamp: Date.now() };
      const newPoints = [...prev.points, point];

      // Calculate distance increment
      let newDistance = prev.distance;
      if (prev.points.length > 0) {
        const last = prev.points[prev.points.length - 1].coordinates;
        newDistance += haversine(last, coords);
      }

      // Calculate speed (km/h)
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const speed = elapsed > 0 ? (newDistance / 1000) / (elapsed / 3600) : 0;

      // Check if loop is closed
      let territory: UserCoordinates[] | null = prev.territory;
      if (
        newPoints.length >= MIN_POINTS_FOR_CLOSE &&
        !prev.territory
      ) {
        const startCoord = newPoints[0].coordinates;
        const dist = haversine(startCoord, coords);
        if (dist < CLOSE_DISTANCE_M) {
          // Loop closed! Create territory polygon
          territory = newPoints.map((p) => p.coordinates);
          territory.push(startCoord); // close polygon
        }
      }

      return {
        ...prev,
        points: newPoints,
        distance: newDistance,
        duration: elapsed,
        speed,
        territory,
      };
    });
  }, []);

  return { ...state, start, stop, addPoint };
}
