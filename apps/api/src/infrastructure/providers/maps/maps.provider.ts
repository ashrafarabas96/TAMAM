import type { GeoPoint } from '@tamam/shared-types';

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  polyline: string | null; // encoded polyline (precision 5)
}

export interface DistanceMatrixResult {
  /** rows[i][j] = origin i → destination j */
  rows: Array<Array<{ distanceMeters: number; durationSeconds: number } | null>>;
}

export interface GeocodeResult {
  formatted: string;
  location: GeoPoint;
  city?: string;
  street?: string;
  placeId?: string;
}

export interface PlaceSuggestion {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  location?: GeoPoint;
}

/** Maps abstraction (spec §180). Business logic depends on this interface only. */
export interface MapsProvider {
  readonly name: string;
  route(origin: GeoPoint, destination: GeoPoint, waypoints?: GeoPoint[]): Promise<RouteResult>;
  distanceMatrix(origins: GeoPoint[], destinations: GeoPoint[]): Promise<DistanceMatrixResult>;
  geocode(query: string, language: 'ar' | 'en', bias?: GeoPoint): Promise<GeocodeResult[]>;
  reverseGeocode(point: GeoPoint, language: 'ar' | 'en'): Promise<GeocodeResult | null>;
  placeSearch(query: string, language: 'ar' | 'en', bias?: GeoPoint): Promise<PlaceSuggestion[]>;
}

export const MAPS_PROVIDER = Symbol('MAPS_PROVIDER');
