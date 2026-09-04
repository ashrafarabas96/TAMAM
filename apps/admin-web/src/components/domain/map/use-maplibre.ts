'use client';

import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { type RefObject, useEffect, useState } from 'react';

import { env } from '@/lib/env';

/** Ramallah — default centre for the launch region. */
export const DEFAULT_CENTER: [number, number] = [35.2034, 31.9038];
export const DEFAULT_ZOOM = 11;

export interface UseMapLibreOptions {
  center?: [number, number];
  zoom?: number;
  interactive?: boolean;
}

/** Creates one MapLibre instance for the container and destroys it on unmount. */
export function useMapLibre(
  containerRef: RefObject<HTMLDivElement>,
  options: UseMapLibreOptions = {},
): { map: MapLibreMap | null; loaded: boolean } {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { center = DEFAULT_CENTER, zoom = DEFAULT_ZOOM, interactive = true } = options;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const instance = new maplibregl.Map({
      container,
      style: env.mapStyleUrl,
      center,
      zoom,
      interactive,
      attributionControl: false,
    });
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
    instance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    instance.on('load', () => setLoaded(true));
    setMap(instance);
    return () => {
      setLoaded(false);
      setMap(null);
      instance.remove();
    };
    // The map is created once per mount; centre/zoom changes are applied imperatively by callers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  return { map, loaded };
}

export { maplibregl };
export type { MapLibreMap };
