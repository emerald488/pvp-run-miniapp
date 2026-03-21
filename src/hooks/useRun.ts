import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserCoordinates } from '../types/location';
import type { RunState, RunPoint } from '../types/run';
import { trackToHexes, polygonToHexes } from '../lib/hexGrid';

const CLOSE_DISTANCE_M = 30;
const MIN_POINTS_FOR_CLOSE = 20;
const POLL_INTERVAL_MS = 3000;

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

export function useRun(token: string | null) {
  const [state, setState] = useState<RunState>({
    isRunning: false,
    points: [],
    distance: 0,
    duration: 0,
    speed: 0,
    territory: null,
    liveTracking: false,
    serverPointCount: 0,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const startTimeRef = useRef(0);

  // Poll server for track points (from bot live location)
  const pollTrack = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/active-run', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.active || !data.points) return;

      const points: RunPoint[] = data.points.map((p: { latitude: number; longitude: number; timestamp: string }) => ({
        coordinates: { latitude: p.latitude, longitude: p.longitude },
        timestamp: new Date(p.timestamp).getTime(),
      }));

      // Calculate distance
      let distance = 0;
      for (let i = 1; i < points.length; i++) {
        distance += haversine(points[i - 1].coordinates, points[i].coordinates);
      }

      const elapsed = (Date.now() - new Date(data.startedAt).getTime()) / 1000;
      const speed = elapsed > 0 ? (distance / 1000) / (elapsed / 3600) : 0;

      // Check for loop closure
      let territory: UserCoordinates[] | null = null;
      if (points.length >= MIN_POINTS_FOR_CLOSE) {
        const startCoord = points[0].coordinates;
        const lastCoord = points[points.length - 1].coordinates;
        if (haversine(startCoord, lastCoord) < CLOSE_DISTANCE_M) {
          territory = points.map((p) => p.coordinates);
          territory.push(startCoord);
        }
      }

      // Check if server has fresh points (within last 30s)
      const lastServerPoint = points.length > 0 ? points[points.length - 1].timestamp : 0;
      const isLive = Date.now() - lastServerPoint < 30000;

      setState((prev) => ({
        ...prev,
        points: points.length > 0 ? points : prev.points,
        distance: points.length > 0 ? distance : prev.distance,
        duration: elapsed,
        speed: points.length > 0 ? speed : prev.speed,
        territory: territory || prev.territory,
        liveTracking: isLive,
        serverPointCount: points.length,
      }));
    } catch {
      // Poll failed, ignore
    }
  }, [token]);

  const start = useCallback(async () => {
    if (!token) return;

    // Create active run on server
    try {
      const res = await fetch('/api/active-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      startTimeRef.current = new Date(data.startedAt).getTime();
    } catch {
      startTimeRef.current = Date.now();
    }

    setState({
      isRunning: true,
      points: [],
      distance: 0,
      duration: 0,
      speed: 0,
      territory: null,
      liveTracking: false,
      serverPointCount: 0,
    });

    // Timer for duration
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setState((prev) => ({ ...prev, duration: elapsed }));
    }, 1000);

    // Poll for track points from bot
    pollRef.current = setInterval(pollTrack, POLL_INTERVAL_MS);
  }, [token, pollTrack]);

  const stop = useCallback(async () => {
    clearInterval(timerRef.current);
    clearInterval(pollRef.current);

    if (token) {
      try {
        await fetch('/api/active-run', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // ignore
      }

      // Capture hexes from track + territory
      setState((prev) => {
        const hexSet = new Set<string>();
        const trackCoords = prev.points.map((p) => p.coordinates);
        for (const h of trackToHexes(trackCoords)) hexSet.add(h);
        if (prev.territory) {
          for (const h of polygonToHexes(prev.territory)) hexSet.add(h);
        }

        if (hexSet.size > 0) {
          fetch('/api/zones', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ hexes: Array.from(hexSet) }),
          }).catch(() => {});
        }

        return { ...prev, isRunning: false };
      });
      return;
    }

    setState((prev) => ({ ...prev, isRunning: false }));
  }, [token]);

  // Also feed GPS points locally (as backup when bot location isn't available)
  const addPoint = useCallback((coords: UserCoordinates) => {
    setState((prev) => {
      if (!prev.isRunning) return prev;

      const point: RunPoint = { coordinates: coords, timestamp: Date.now() };
      const newPoints = [...prev.points, point];

      let newDistance = prev.distance;
      if (prev.points.length > 0) {
        const last = prev.points[prev.points.length - 1].coordinates;
        newDistance += haversine(last, coords);
      }

      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const speed = elapsed > 0 ? (newDistance / 1000) / (elapsed / 3600) : 0;

      let territory: UserCoordinates[] | null = prev.territory;
      if (newPoints.length >= MIN_POINTS_FOR_CLOSE && !prev.territory) {
        const startCoord = newPoints[0].coordinates;
        if (haversine(startCoord, coords) < CLOSE_DISTANCE_M) {
          territory = newPoints.map((p) => p.coordinates);
          territory.push(startCoord);
        }
      }

      return { ...prev, points: newPoints, distance: newDistance, duration: elapsed, speed, territory };
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearInterval(pollRef.current);
    };
  }, []);

  return { ...state, start, stop, addPoint };
}
