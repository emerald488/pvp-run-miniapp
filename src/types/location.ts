export interface UserCoordinates {
  latitude: number;
  longitude: number;
}

export interface LocationState {
  coordinates: UserCoordinates | null;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  error: string | null;
  isTracking: boolean;
}
