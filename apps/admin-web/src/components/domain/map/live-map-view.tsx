'use client';

import type { Feature, Polygon } from 'geojson';
import type { GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl';
import { useEffect, useRef } from 'react';

import { tokens } from '@tamam/ui-tokens';

import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils/cn';

import { maplibregl, useMapLibre } from './use-maplibre';

export interface MapPartnerPoint {
  id: string;
  lat: number;
  lng: number;
  heading: number | null;
  availability: string;
  activeJobId: string | null;
  stale: boolean;
}
export interface MapJobPoint {
  id: string;
  number: string;
  type: string;
  status: string;
  lat: number;
  lng: number;
  destination: { lat: number; lng: number } | null;
  sos?: boolean;
}

export interface LiveMapViewProps {
  partners: MapPartnerPoint[];
  jobs: MapJobPoint[];
  polygon?: Polygon | null;
  focus?: { lat: number; lng: number; zoom?: number } | null;
  onSelectPartner?: (id: string) => void;
  onSelectJob?: (id: string) => void;
  className?: string;
}

const SRC_PARTNERS = 'partners';
const SRC_JOBS = 'jobs';
const SRC_ZONE = 'zone';

/** MapLibre canvas showing partners (arrows) and jobs (pins) as GeoJSON layers, coloured from the design tokens. */
export function LiveMapView({ partners, jobs, polygon, focus, onSelectPartner, onSelectJob, className }: LiveMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { map, loaded } = useMapLibre(containerRef);
  const { resolved } = useTheme();
  const palette = resolved === 'dark' ? tokens.color.dark : tokens.color.light;

  useEffect(() => {
    if (!map || !loaded) return;
    if (!map.getSource(SRC_ZONE)) {
      map.addSource(SRC_ZONE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'zone-fill', type: 'fill', source: SRC_ZONE, paint: { 'fill-color': tokens.color.brand.purple[500], 'fill-opacity': 0.08 } });
      map.addLayer({ id: 'zone-line', type: 'line', source: SRC_ZONE, paint: { 'line-color': tokens.color.brand.purple[500], 'line-width': 2, 'line-dasharray': [2, 2] } });
    }
    if (!map.getSource(SRC_JOBS)) {
      map.addSource(SRC_JOBS, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'jobs-routes', type: 'line', source: SRC_JOBS, filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': palette.mapRoute, 'line-width': 2, 'line-opacity': 0.7 } });
      map.addLayer({
        id: 'jobs-points',
        type: 'circle',
        source: SRC_JOBS,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': ['case', ['get', 'sos'], 11, 7],
          'circle-color': ['case', ['get', 'sos'], tokens.color.semantic.danger.base, ['==', ['get', 'kind'], 'destination'], palette.mapDestination, palette.mapPickup],
          'circle-stroke-color': tokens.color.neutral[0],
          'circle-stroke-width': 2,
        },
      });
    }
    if (!map.getSource(SRC_PARTNERS)) {
      map.addSource(SRC_PARTNERS, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'partners-points',
        type: 'circle',
        source: SRC_PARTNERS,
        paint: {
          'circle-radius': 8,
          'circle-color': ['case', ['get', 'stale'], tokens.color.neutral[400], ['==', ['get', 'availability'], 'BUSY'], tokens.color.semantic.warning.base, ['==', ['get', 'availability'], 'ONLINE'], tokens.color.brand.purple[500], tokens.color.neutral[500]],
          'circle-stroke-color': tokens.color.brand.yellow[500],
          'circle-stroke-width': 2,
        },
      });
    }
    const handlePartner = (e: MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === 'string') onSelectPartner?.(id);
    };
    const handleJob = (e: MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === 'string') onSelectJob?.(id);
    };
    const pointer = () => (map.getCanvas().style.cursor = 'pointer');
    const unpointer = () => (map.getCanvas().style.cursor = '');
    map.on('click', 'partners-points', handlePartner);
    map.on('click', 'jobs-points', handleJob);
    map.on('mouseenter', 'partners-points', pointer);
    map.on('mouseleave', 'partners-points', unpointer);
    map.on('mouseenter', 'jobs-points', pointer);
    map.on('mouseleave', 'jobs-points', unpointer);
    return () => {
      map.off('click', 'partners-points', handlePartner);
      map.off('click', 'jobs-points', handleJob);
      map.off('mouseenter', 'partners-points', pointer);
      map.off('mouseleave', 'partners-points', unpointer);
      map.off('mouseenter', 'jobs-points', pointer);
      map.off('mouseleave', 'jobs-points', unpointer);
    };
  }, [map, loaded, onSelectPartner, onSelectJob, palette]);

  useEffect(() => {
    if (!map || !loaded) return;
    const source = map.getSource(SRC_PARTNERS) as GeoJSONSource | undefined;
    source?.setData({
      type: 'FeatureCollection',
      features: partners.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { id: p.id, availability: p.availability, stale: p.stale, heading: p.heading ?? 0 } })),
    });
  }, [map, loaded, partners]);

  useEffect(() => {
    if (!map || !loaded) return;
    const source = map.getSource(SRC_JOBS) as GeoJSONSource | undefined;
    const features: Feature[] = [];
    for (const j of jobs) {
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [j.lng, j.lat] }, properties: { id: j.id, kind: 'pickup', sos: !!j.sos, number: j.number } });
      if (j.destination) {
        features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [j.destination.lng, j.destination.lat] }, properties: { id: j.id, kind: 'destination', sos: false, number: j.number } });
        features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[j.lng, j.lat], [j.destination.lng, j.destination.lat]] }, properties: { id: j.id } });
      }
    }
    source?.setData({ type: 'FeatureCollection', features });
  }, [map, loaded, jobs]);

  useEffect(() => {
    if (!map || !loaded) return;
    const source = map.getSource(SRC_ZONE) as GeoJSONSource | undefined;
    source?.setData({ type: 'FeatureCollection', features: polygon ? [{ type: 'Feature', geometry: polygon, properties: {} }] : [] });
    if (polygon) {
      const bounds = new maplibregl.LngLatBounds();
      for (const ring of polygon.coordinates) for (const [lng, lat] of ring) if (lng !== undefined && lat !== undefined) bounds.extend([lng, lat]);
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 40, duration: 600 });
    }
  }, [map, loaded, polygon]);

  useEffect(() => {
    if (!map || !loaded || !focus) return;
    map.flyTo({ center: [focus.lng, focus.lat], zoom: focus.zoom ?? Math.max(map.getZoom(), 14), duration: 600 });
  }, [map, loaded, focus]);

  return <div ref={containerRef} className={cn('h-full w-full rounded-lg', className)} role="application" aria-label="map" />;
}
