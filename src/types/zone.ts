export interface ZoneData {
  h3Index: string;
  ownerId: string | null;
  ownerColor: string | null;
  capturedAt: string | null;
}

export interface HexFeatureProperties {
  h3Index: string;
  ownerId: string | null;
  ownerColor: string;
}
