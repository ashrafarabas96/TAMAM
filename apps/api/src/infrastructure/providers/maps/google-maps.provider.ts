import { Injectable } from '@nestjs/common';
import type { GeoPoint } from '@tamam/shared-types';

import { AppConfigService } from '../../../config';

import { fetchJson } from './http.util';
import type { DistanceMatrixResult, GeocodeResult, MapsProvider, PlaceSuggestion, RouteResult } from './maps.provider';

interface GDirections { routes: Array<{ overview_polyline: { points: string }; legs: Array<{ distance: { value: number }; duration: { value: number } }> }>; status: string }
interface GMatrix { rows: Array<{ elements: Array<{ status: string; distance?: { value: number }; duration?: { value: number } }> }>; status: string }
interface GGeocode { results: Array<{ formatted_address: string; geometry: { location: { lat: number; lng: number } }; place_id: string; address_components: Array<{ long_name: string; types: string[] }> }>; status: string }
interface GAutocomplete { predictions: Array<{ place_id: string; structured_formatting: { main_text: string; secondary_text: string } }>; status: string }

/** Google Maps Platform adapter (Directions, Distance Matrix, Geocoding, Places Autocomplete). */
@Injectable()
export class GoogleMapsProvider implements MapsProvider {
  readonly name = 'google';
  private readonly key: string;
  constructor(config: AppConfigService) {
    this.key = config.env.GOOGLE_MAPS_API_KEY ?? '';
  }

  async route(origin: GeoPoint, destination: GeoPoint, waypoints: GeoPoint[] = []): Promise<RouteResult> {
    const params = new URLSearchParams({ origin: `${origin.lat},${origin.lng}`, destination: `${destination.lat},${destination.lng}`, key: this.key, mode: 'driving' });
    if (waypoints.length) params.set('waypoints', waypoints.map((w) => `${w.lat},${w.lng}`).join('|'));
    const data = await fetchJson<GDirections>(`https://maps.googleapis.com/maps/api/directions/json?${params}`, { provider: 'google-maps' });
    const r = data.routes[0];
    if (data.status !== 'OK' || !r) throw new Error(`directions ${data.status}`);
    return {
      distanceMeters: r.legs.reduce((s, l) => s + l.distance.value, 0),
      durationSeconds: r.legs.reduce((s, l) => s + l.duration.value, 0),
      polyline: r.overview_polyline.points,
    };
  }

  async distanceMatrix(origins: GeoPoint[], destinations: GeoPoint[]): Promise<DistanceMatrixResult> {
    if (!origins.length || !destinations.length) return { rows: [] };
    const params = new URLSearchParams({ origins: origins.map((p) => `${p.lat},${p.lng}`).join('|'), destinations: destinations.map((p) => `${p.lat},${p.lng}`).join('|'), key: this.key, mode: 'driving' });
    const data = await fetchJson<GMatrix>(`https://maps.googleapis.com/maps/api/distancematrix/json?${params}`, { provider: 'google-maps' });
    return { rows: data.rows.map((row) => row.elements.map((e) => (e.status === 'OK' && e.distance && e.duration ? { distanceMeters: e.distance.value, durationSeconds: e.duration.value } : null))) };
  }

  async geocode(query: string, language: 'ar' | 'en', bias?: GeoPoint): Promise<GeocodeResult[]> {
    const params = new URLSearchParams({ address: query, key: this.key, language });
    if (bias) params.set('bounds', `${bias.lat - 0.3},${bias.lng - 0.3}|${bias.lat + 0.3},${bias.lng + 0.3}`);
    const data = await fetchJson<GGeocode>(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, { provider: 'google-maps' });
    return data.results.map((r) => this.mapGeocode(r));
  }

  async reverseGeocode(point: GeoPoint, language: 'ar' | 'en'): Promise<GeocodeResult | null> {
    const params = new URLSearchParams({ latlng: `${point.lat},${point.lng}`, key: this.key, language });
    const data = await fetchJson<GGeocode>(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, { provider: 'google-maps' });
    const r = data.results[0];
    return r ? this.mapGeocode(r) : null;
  }

  async placeSearch(query: string, language: 'ar' | 'en', bias?: GeoPoint): Promise<PlaceSuggestion[]> {
    const params = new URLSearchParams({ input: query, key: this.key, language });
    if (bias) {
      params.set('location', `${bias.lat},${bias.lng}`);
      params.set('radius', '30000');
    }
    const data = await fetchJson<GAutocomplete>(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`, { provider: 'google-maps' });
    return data.predictions.map((p) => ({ placeId: p.place_id, primaryText: p.structured_formatting.main_text, secondaryText: p.structured_formatting.secondary_text }));
  }

  private mapGeocode(r: GGeocode['results'][number]): GeocodeResult {
    const comp = (type: string) => r.address_components.find((c) => c.types.includes(type))?.long_name;
    return { formatted: r.formatted_address, location: r.geometry.location, city: comp('locality') ?? comp('administrative_area_level_2'), street: comp('route'), placeId: r.place_id };
  }
}
