import type { UserCoordinates } from './location';

export interface RunPoint {
  coordinates: UserCoordinates;
  timestamp: number;
}

export interface RunState {
  isRunning: boolean;
  points: RunPoint[];
  distance: number;      // meters
  duration: number;       // seconds
  speed: number;          // km/h
  territory: UserCoordinates[] | null; // closed polygon if loop completed
  liveTracking: boolean;  // true if server has fresh points (bot live location active)
  serverPointCount: number;
}
