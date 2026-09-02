import { Injectable } from '@nestjs/common';
import type { GeoPoint } from '@tamam/shared-types';
import { Logger } from 'nestjs-pino';

import { estimateEtaSeconds, haversineMeters } from '../../../common/utils/geo';
import { AppConfigService } from '../../../config';
import { fetchJson, withRetry } from './http.util';
import type { DistanceMatrixResult, GeocodeResult, MapsProvider, PlaceSuggestion, RouteResult } from './maps.provider';

interface OsrmRoute { routes?: Array<{ distance: number; duration: number; geometry: string }>; code: string }
interface OsrmTable { durations?: Array<Array<number | null>>; distances?: Array<Array<number | null>>; code: string }
interface NominatimResult { display_name: string; lat: string; lon: string; place_id: number; address?: { city?: string; town?: string; village?: string; road?: string } }

/**
 * OSRM (routing/table) + Nominatim (geocoding) — works with public or self-hosted instances.
 * Falls back to haversine estimates if routing is unreachable so a job can still be created;
 * the fallback is flagged in logs and metrics.
 */
@Injectable()
export class OsrmMapsProvider implements MapsProvider {
  readonly name = 'osrm';
  constructor(
    private readonly config: AppConfigService,
    private readonly logger: Logger,
  ) {}

  async route(origin: GeoPoint, destination: GeoPoint, waypoints: GeoPoint[] = []): Promise<RouteResult> {
    const coords = [origin, ...waypoints, destination].map((p) => `${p.lng},${p.lat}`).join(';');
    const url = `${this.config.env.OSRM_BASE_URL}/route/v1/driving/${coords}?overview=full&geometries=polyline`;
    try {
      const data = await withRetry(() => fetchJson<OsrmRoute>(url, { provider: 'osrm', timeoutMs: 6000 }));
      const r = data.routes?.[0];
      if (!r) throw new Error('no route');
      return { distanceMeters: Math.round(r.distance), durationSeconds: Math.round(r.duration), polyline: r.geometry };
    } catch (err) {
      this.logger.warn({ err }, 'OSRM route failed — using haversine fallback');
      const d = haversineMeters(origin, destination) * 1.3;
      return { distanceMeters: Math.round(d), durationSeconds: estimateEtaSeconds(d), polyline: null };
    }
  }

  async distanceMatrix(origins: GeoPoint[], destinations: GeoPoint[]): Promise<DistanceMatrixResult> {
    if (!origins.length || !destinations.length) return { rows: [] };
    const all = [...origins, ...destinations];
    const coords = all.map((p) => `${p.lng},${p.lat}`).join(';');
    const src = origins.map((_, i) => i).join(';');
    const dst = destinations.map((_, i) => origins.length + i).join(';');
    const url = `${this.config.env.OSRM_BASE_URL}/table/v1/driving/${coords}?sources=${src}&destinations=${dst}&annotations=duration,distance`;
    try {
      const data = await fetchJson<OsrmTable>(url, { provider: 'osrm', timeoutMs: 6000 });
      const rows = origins.map((_, i) =>
        destinations.map((_, j) => {
          const dur = data.durations?.[i]?.[j];
          const dist = data.distances?.[i]?.[j];
          return dur === null || dur === undefined ? null : { distanceMeters: Math.round(dist ?? 0), durationSeconds: Math.round(dur) };
        }),
      );
      return { rows };
    } catch (err) {
      this.logger.warn({ err }, 'OSRM table failed — using haversine fallback');
      return {
        rows: origins.map((o) =>
          destinations.map((d) => {
            const m = haversineMeters(o, d) * 1.3;
            return { distanceMeters: Math.round(m), durationSeconds: estimateEtaSeconds(m) };
          }),
        ),
      };
    }
  }

  async geocode(query: string, language: 'ar' | 'en', bias?: GeoPoint): Promise<GeocodeResult[]> {
    const params = new URLSearchParams({ q: query, format: 'jsonv2', addressdetails: '1', limit: '6', 'accept-language': language });
    if (bias) {
      params.set('viewbox', `${bias.lng - 0.3},${bias.lat + 0.3},${bias.lng + 0.3},${bias.lat - 0.3}`);
      params.set('bounded', '0');
    }
    const url = `${this.config.env.NOMINATIM_BASE_URL}/search?${params.toString()}`;
    const data = await fetchJson<NominatimResult[]>(url, { provider: 'nominatim', timeoutMs: 6000, headers: { 'User-Agent': 'TAMAM/1.0 (support@tamam.app)' } });
    return data.map((r) => ({
      formatted: r.display_name,
      location: { lat: Number(r.lat), lng: Number(r.lon) },
      city: r.address?.city ?? r.address?.town ?? r.address?.village,
      street: r.address?.road,
      placeId: String(r.place_id),
    }));
  }

  async reverseGeocode(point: GeoPoint, language: 'ar' | 'en'): Promise<GeocodeResult | null> {
    const params = new URLSearchParams({ lat: String(point.lat), lon: String(point.lng), format: 'jsonv2', addressdetails: '1', 'accept-language': language });
    const url = `${this.config.env.NOMINATIM_BASE_URL}/reverse?${params.toString()}`;
    try {
      const r = await fetchJson<NominatimResult>(url, { provider: 'nominatim', timeoutMs: 6000, headers: { 'User-Agent': 'TAMAM/1.0 (support@tamam.app)' } });
      if (!r?.display_name) return null;
      return { formatted: r.display_name, location: point, city: r.address?.city ?? r.address?.town ?? r.address?.village, street: r.address?.road, placeId: String(r.place_id) };
    } catch {
      return null;
    }
  }

  async placeSearch(query: string, language: 'ar' | 'en', bias?: GeoPoint): Promise<PlaceSuggestion[]> {
    const results = await this.geocode(query, language, bias);
    return results.map((r) => {
      const [primary, ...rest] = r.formatted.split(',');
      return { placeId: r.placeId ?? r.formatted, primaryText: (primary ?? r.formatted).trim(), secondaryText: rest.join(',').trim(), location: r.location };
    });
  }
}
